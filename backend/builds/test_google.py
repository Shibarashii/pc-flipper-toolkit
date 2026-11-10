"""Sign in with Google (docs/specs/google-sign-in.md). Nothing here calls Google."""

import json
import time
from datetime import timedelta
from types import SimpleNamespace
from unittest import mock

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from google.auth import crypt
from google.auth import jwt as google_jwt
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from . import google
from .demo import delete_expired_demos
from .models import GoogleAccount

CLIENT_ID = "test-client.apps.googleusercontent.com"
SIGN_IN = "/api/auth/google/"


def signs_in_as(sub="1234567890", email="seanrei.ethan23@gmail.com"):
    """Stands in for Google's check: every credential is this Google account."""
    return mock.patch.object(google, "verify", return_value=(sub, email))


@override_settings(GOOGLE_CLIENT_ID=CLIENT_ID)
class GoogleSignInTests(APITestCase):
    def setUp(self):
        cache.clear()  # shares the auth rate limit

    def sign_in(self):
        return self.client.post(SIGN_IN, {"credential": "a-token"}, format="json")

    def test_a_new_google_account_gets_an_account_then_logs_into_it(self):
        with signs_in_as():
            res = self.sign_in()
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.json()["username"], "seanrei.ethan23")
        user = User.objects.get(username="seanrei.ethan23")
        self.assertEqual(Token.objects.get(user=user).key, res.json()["token"])
        self.assertFalse(user.has_usable_password())
        self.assertEqual(user.google.sub, "1234567890")
        self.assertEqual(user.google.email, "seanrei.ethan23@gmail.com")

        # Same Google account, new email: same user, found by sub.
        with signs_in_as(email="renamed@gmail.com"):
            res = self.sign_in()
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["username"], "seanrei.ethan23")
        self.assertEqual(User.objects.count(), 1)

    def test_a_connected_password_account_is_who_you_sign_in_as(self):
        carol = User.objects.create_user("carol", password="x-Long-enough-1")
        GoogleAccount.objects.create(user=carol, sub="777", email="c@gmail.com")
        with signs_in_as(sub="777", email="c@gmail.com"):
            res = self.sign_in()
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["username"], "carol")

    def test_a_bad_token_is_400_on_credential_and_creates_nothing(self):
        with mock.patch.object(google, "verify", side_effect=google.InvalidToken):
            res = self.sign_in()
        self.assertEqual(res.status_code, 400)
        self.assertEqual(
            res.json()["credential"], ["Google sign-in didn't work. Try again."]
        )
        self.assertFalse(User.objects.exists())

    def test_a_missing_credential_is_400(self):
        with signs_in_as():
            res = self.client.post(SIGN_IN, {}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("credential", res.json())

    @override_settings(GOOGLE_CLIENT_ID="")
    def test_without_a_client_id_it_isnt_set_up_and_never_checks(self):
        with signs_in_as() as verify:
            res = self.sign_in()
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()["credential"], ["Google sign-in isn't set up."])
        verify.assert_not_called()
        self.assertFalse(User.objects.exists())

    def test_it_shares_the_auth_rate_limit_with_log_in(self):
        for _ in range(5):
            self.client.post(
                "/api/auth/login/", {"username": "x", "password": "y"}, format="json"
            )
        with signs_in_as():
            codes = [self.sign_in().status_code for _ in range(6)]
        self.assertEqual(codes, [201, 200, 200, 200, 200, 429])

    def test_a_username_taken_meanwhile_is_retried(self):
        User.objects.create_user("carol")
        with (
            signs_in_as(),
            mock.patch.object(google, "username_for", side_effect=["carol", "carol2"]),
        ):
            res = self.sign_in()
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.json()["username"], "carol2")

    def test_three_lost_races_is_400_and_creates_nothing_more(self):
        User.objects.create_user("carol")
        with (
            signs_in_as(),
            mock.patch.object(google, "username_for", return_value="carol"),
        ):
            res = self.sign_in()
        self.assertEqual(res.status_code, 400)
        self.assertEqual(
            res.json()["credential"], ["Google sign-in didn't work. Try again."]
        )
        self.assertFalse(GoogleAccount.objects.exists())

    def test_demo_cleanup_never_deletes_a_google_only_account(self):
        with signs_in_as(email="demo-tricky@gmail.com"):
            res = self.sign_in()
        user = User.objects.get(username=res.json()["username"])
        self.assertFalse(user.username.startswith("demo-"))
        User.objects.filter(pk=user.pk).update(
            date_joined=timezone.now() - timedelta(days=30)
        )
        delete_expired_demos()
        self.assertTrue(User.objects.filter(pk=user.pk).exists())


class UsernameTests(TestCase):
    def test_the_part_before_the_at(self):
        self.assertEqual(
            google.username_for("seanrei.ethan23@gmail.com"), "seanrei.ethan23"
        )

    def test_taken_names_are_numbered_ignoring_case(self):
        User.objects.create_user("Carol")
        User.objects.create_user("carol2")
        self.assertEqual(google.username_for("carol@gmail.com"), "carol3")

    def test_characters_usernames_dont_allow_are_dropped(self):
        self.assertEqual(google.username_for("o'brien!#$%@x.com"), "obrien")

    def test_never_demo(self):
        self.assertEqual(google.username_for("Demo-x@gmail.com"), "user-Demo-x")

    def test_nothing_left_is_user(self):
        self.assertEqual(google.username_for("'!#@x.com"), "user")
        User.objects.create_user("user")
        self.assertEqual(google.username_for("!!@x.com"), "user2")

    def test_long_names_fit_with_a_number(self):
        User.objects.create_user("a" * 140)
        name = google.username_for("a" * 200 + "@x.com")
        self.assertEqual(name, "a" * 140 + "2")
        self.assertLessEqual(len(name), 150)


def key_pair():
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )
    public = key.public_key().public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
    )
    return private, public.decode()


@override_settings(GOOGLE_CLIENT_ID=CLIENT_ID)
class RealVerificationTests(TestCase):
    """google-auth's own checks, on tokens signed by a test key it fetches from us."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.private, public = key_pair()
        cls.other_private, _ = key_pair()
        certs = json.dumps({"test-key": public}).encode()
        fetch = mock.Mock(
            return_value=SimpleNamespace(status=200, data=certs, headers={})
        )
        cls.patch = mock.patch.object(google, "REQUEST", fetch)
        cls.patch.start()

    @classmethod
    def tearDownClass(cls):
        cls.patch.stop()
        super().tearDownClass()

    def token(self, key=None, **claims):
        now = int(time.time())
        payload = {
            "iss": "https://accounts.google.com",
            "aud": CLIENT_ID,
            "sub": "1234567890",
            "email": "seanrei.ethan23@gmail.com",
            "iat": now,
            "exp": now + 3600,
            **claims,
        }
        signer = crypt.RSASigner.from_string(key or self.private, key_id="test-key")
        return google_jwt.encode(signer, payload).decode()

    def test_a_good_token_gives_its_sub_and_email(self):
        self.assertEqual(
            google.verify(self.token()), ("1234567890", "seanrei.ethan23@gmail.com")
        )

    @override_settings(GOOGLE_CLIENT_ID="")
    def test_never_verifies_without_a_client_id(self):
        with self.assertRaises(google.InvalidToken):
            google.verify(self.token(aud=""))

    def test_bad_tokens_are_refused(self):
        now = int(time.time())
        for why, credential in [
            (
                "another app's",
                self.token(aud="someone-else.apps.googleusercontent.com"),
            ),
            ("not Google's", self.token(iss="https://evil.example")),
            ("expired", self.token(iat=now - 7200, exp=now - 3600)),
            ("another key's", self.token(key=self.other_private)),
            ("garbage", "not.a.token"),
            ("no email", self.token(email=None)),
        ]:
            with self.subTest(why), self.assertRaises(google.InvalidToken):
                google.verify(credential)


CONNECT = "/api/auth/google/connect/"


@override_settings(GOOGLE_CLIENT_ID=CLIENT_ID)
class ConnectTests(APITestCase):
    """The Account page: connect and disconnect Google on an account you're logged into."""

    def setUp(self):
        cache.clear()
        self.carol = User.objects.create_user("carol", password="x-Long-enough-1")
        self.client.force_authenticate(self.carol)

    def connect(self):
        return self.client.post(CONNECT, {"credential": "a-token"}, format="json")

    def me(self):
        return self.client.get("/api/auth/me/").json()

    def test_me_says_whats_connected_and_how_you_can_get_in(self):
        self.assertEqual(
            self.me(),
            {
                "username": "carol",
                "google": None,
                "has_password": True,
                "is_demo": False,
            },
        )

    def test_connecting_then_google_sign_in_opens_this_account(self):
        with signs_in_as(sub="777", email="c@gmail.com"):
            res = self.connect()
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.json(), {"google": {"email": "c@gmail.com"}})
        self.assertEqual(self.me()["google"], {"email": "c@gmail.com"})

        self.client.force_authenticate(None)
        with signs_in_as(sub="777", email="c@gmail.com"):
            res = self.client.post(SIGN_IN, {"credential": "t"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["username"], "carol")

    def test_a_google_account_connected_elsewhere_is_refused(self):
        dave = User.objects.create_user("dave")
        GoogleAccount.objects.create(user=dave, sub="777", email="d@gmail.com")
        with signs_in_as(sub="777"):
            res = self.connect()
        self.assertEqual(res.status_code, 400)
        self.assertEqual(
            res.json()["non_field_errors"],
            ["This Google account is connected to another account."],
        )
        self.assertEqual(dave.google.sub, "777")
        self.assertIsNone(self.me()["google"])

    def test_a_second_google_account_is_refused(self):
        GoogleAccount.objects.create(user=self.carol, sub="1", email="c@gmail.com")
        with signs_in_as(sub="2") as verify:
            res = self.connect()
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()["non_field_errors"], ["Disconnect Google first."])
        verify.assert_not_called()

    def test_a_demo_cant_connect(self):
        demo = User.objects.create_user("demo-abc")  # no usable password
        self.client.force_authenticate(demo)
        self.assertTrue(self.me()["is_demo"])
        self.assertFalse(self.me()["has_password"])
        with signs_in_as() as verify:
            res = self.connect()
        self.assertEqual(res.status_code, 400)
        self.assertEqual(
            res.json()["non_field_errors"],
            ["Demo accounts can't connect Google. Sign up for your own account first."],
        )
        verify.assert_not_called()
        self.assertFalse(GoogleAccount.objects.exists())

    def test_a_bad_token_is_400_on_credential(self):
        with mock.patch.object(google, "verify", side_effect=google.InvalidToken):
            res = self.connect()
        self.assertEqual(res.status_code, 400)
        self.assertEqual(
            res.json()["credential"], ["Google sign-in didn't work. Try again."]
        )

    def test_disconnecting_with_a_password(self):
        GoogleAccount.objects.create(user=self.carol, sub="1", email="c@gmail.com")
        self.assertEqual(self.client.delete(CONNECT).status_code, 204)
        self.assertFalse(GoogleAccount.objects.exists())
        self.assertIsNone(self.me()["google"])

    def test_disconnecting_without_a_password_is_refused(self):
        self.carol.set_unusable_password()
        self.carol.save()
        GoogleAccount.objects.create(user=self.carol, sub="1", email="c@gmail.com")
        res = self.client.delete(CONNECT)
        self.assertEqual(res.status_code, 400)
        self.assertEqual(
            res.json()["non_field_errors"],
            ["Set up a password first; it's the only other way in."],
        )
        self.assertTrue(GoogleAccount.objects.exists())

    def test_disconnecting_with_nothing_connected_is_400(self):
        res = self.client.delete(CONNECT)
        self.assertEqual(res.status_code, 400)
        self.assertIn("non_field_errors", res.json())

    def test_logged_out_its_401(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.connect().status_code, 401)
        self.assertEqual(self.client.delete(CONNECT).status_code, 401)
