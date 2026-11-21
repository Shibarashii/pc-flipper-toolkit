"""Sign up, log in, log out, and who's logged in. Everything else needs the token."""

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core import signing
from django.core.cache import cache
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.utils.crypto import constant_time_compare, salted_hmac
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.authtoken.models import Token
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from . import emails, google
from .authentication import expired
from .demo import PREFIX as DEMO_PREFIX
from .demo import create_demo_user, is_demo
from .models import GoogleAccount

User = get_user_model()

TAKEN = "That username is taken."
TAKEN_EMAIL = "That email is used by another account."
LINK_GONE = "This link no longer works."
# Confirmation links: signed, so they can't be changed; checked against the account's
# current email when opened, so each works once (specs/account-management.md).
CONFIRM_SALT = "builds.confirm-email"
CONFIRM_MAX_AGE = 24 * 60 * 60


def email_mark(email: str) -> str:
    """Stands for the account's current email in a link, which anyone can decode."""
    return salted_hmac(CONFIRM_SALT, email).hexdigest()


GOOGLE_FAILED = "Google sign-in didn't work. Try again."
CONNECTED_ELSEWHERE = "This Google account is connected to another account."


class CredentialsSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(
        write_only=True, trim_whitespace=False, style={"input_type": "password"}
    )


# A new username: sign-up's, or a rename (`context["user"]` is the one renaming).
class UsernameSerializer(serializers.Serializer):
    username = serializers.CharField(
        max_length=150,
        validators=User._meta.get_field("username").validators,
        help_text="Letters, digits and @/./+/-/_ only.",
    )

    def validate_username(self, username):
        username = User.normalize_username(username)  # as create_user does (NFKC)
        taken = User.objects.filter(username__iexact=username)
        if user := self.context.get("user"):
            taken = taken.exclude(pk=user.pk)  # changing only your own name's case
        if taken.exists():
            raise serializers.ValidationError(TAKEN)
        # Reserved: cleanup deletes demo accounts by this prefix (and no password).
        if username.lower().startswith(DEMO_PREFIX):
            raise serializers.ValidationError(
                f'Usernames can\'t start with "{DEMO_PREFIX}".'
            )
        return username


class SignupSerializer(UsernameSerializer, CredentialsSerializer):
    email = serializers.EmailField(
        max_length=254, help_text="Gets a link to confirm it; saved once it's opened."
    )

    def validate(self, data):
        try:
            validate_password(data["password"], User(username=data["username"]))
        except DjangoValidationError as e:
            raise serializers.ValidationError({"password": list(e.messages)})
        return data


def email_taken(email: str, user=None) -> bool:
    """Another account (than `user`, if given) has this email, in any case."""
    others = User.objects.filter(email__iexact=email)
    return (others.exclude(pk=user.pk) if user else others).exists()


class EmailSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)

    def validate_email(self, email):
        user = self.context["user"]
        if email.lower() == user.email.lower():
            raise serializers.ValidationError("That’s already your email.")
        if email_taken(email, user):
            raise serializers.ValidationError(TAKEN_EMAIL)
        return email


class ConfirmEmailSerializer(serializers.Serializer):
    token = serializers.CharField(help_text="From the link in the email.")


class ConfirmedEmailSerializer(serializers.Serializer):
    email = serializers.EmailField(read_only=True)


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(
        write_only=True, trim_whitespace=False, style={"input_type": "password"}
    )
    new_password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
        style={"input_type": "password"},
        help_text="Must pass Django's password validators.",
    )

    def validate_current_password(self, password):
        if not self.context["user"].check_password(password):
            raise serializers.ValidationError("That isn’t your current password.")
        return password

    def validate_new_password(self, password):
        try:
            validate_password(password, self.context["user"])
        except DjangoValidationError as e:
            raise serializers.ValidationError(list(e.messages))
        return password


class UserSerializer(serializers.Serializer):
    username = serializers.CharField(read_only=True)


class ConnectedGoogleSerializer(serializers.Serializer):
    email = serializers.EmailField(read_only=True)


class ConnectSerializer(serializers.Serializer):
    google = ConnectedGoogleSerializer(read_only=True)


class MeSerializer(UserSerializer):
    google = ConnectedGoogleSerializer(
        read_only=True,
        allow_null=True,
        help_text="The connected Google account, if any.",
    )
    has_password = serializers.BooleanField(
        read_only=True, help_text="False for Google-only and demo accounts."
    )
    is_demo = serializers.BooleanField(read_only=True)
    email = serializers.CharField(
        read_only=True, help_text='The confirmed email, or "" when there is none.'
    )


def connected_google(user) -> dict | None:
    account = GoogleAccount.objects.filter(user=user).first()
    return {"email": account.email} if account else None


class TokenSerializer(UserSerializer):
    token = serializers.CharField(
        read_only=True, help_text="Send as `Authorization: Token <token>`."
    )


def token_response(user, status_code=status.HTTP_200_OK) -> Response:
    token, _ = Token.objects.get_or_create(user=user)
    if expired(token):
        # ponytail: two log-ins at the same moment on an expired token can 500 the second
        # (one token per user); retrying works. Catch IntegrityError if it ever shows up.
        token.delete()
        token = Token.objects.create(user=user)
    return Response({"token": token.key, "username": user.username}, status_code)


class PublicAuthView(APIView):
    """No token needed; rate-limited per IP so passwords can't be guessed quickly."""

    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"


class SignupView(PublicAuthView):
    @extend_schema(
        summary="Sign up",
        description="Creates an account and logs it in, then emails a link to confirm "
        "`email`; the email is saved once it's opened. Passwords must pass Django's "
        "password validators; their messages come back under `password`. An email another "
        "account has gets no link, and the answer is the same.",
        request=SignupSerializer,
        responses={201: TokenSerializer},
        tags=["auth"],
    )
    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data.pop("email")
        try:
            with transaction.atomic():
                user = User.objects.create_user(**serializer.validated_data)
        except IntegrityError:
            # Someone took the name between the check above and now.
            raise serializers.ValidationError({"username": [TAKEN]})
        # Public, so the answer can't say whether another account has the email.
        if not email_taken(email):
            send_confirmation(user, email)
        return token_response(user, status.HTTP_201_CREATED)


class LoginView(PublicAuthView):
    @extend_schema(
        summary="Log in",
        description="Returns the user's token. A wrong username or password is a 400 "
        "with the message under `non_field_errors`.",
        request=CredentialsSerializer,
        responses={200: TokenSerializer},
        tags=["auth"],
    )
    def post(self, request):
        serializer = CredentialsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        username = serializer.validated_data["username"]
        # Sign-up treats "Carol" and "carol" as one name, so log-in does too. An exact
        # match still wins, in case two older accounts differ only by case.
        if not User.objects.filter(username=username).exists():
            match = User.objects.filter(username__iexact=username).first()
            username = match.username if match else username
        user = authenticate(
            request,
            username=username,
            password=serializer.validated_data["password"],
        )
        if user is None:
            raise serializers.ValidationError(
                {"non_field_errors": ["Wrong username or password."]}
            )
        return token_response(user)


class GoogleCredentialSerializer(serializers.Serializer):
    credential = serializers.CharField(
        write_only=True,
        help_text="The ID token Google's sign-in button gives the page.",
    )


def google_account(request) -> google.Identity:
    """The Google account in the request's credential, checked."""
    if not settings.GOOGLE_CLIENT_ID:
        raise serializers.ValidationError(
            {"credential": ["Google sign-in isn't set up."]}
        )
    serializer = GoogleCredentialSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    try:
        return google.verify(serializer.validated_data["credential"])
    except google.InvalidToken:
        raise serializers.ValidationError({"credential": [GOOGLE_FAILED]})


class GoogleView(PublicAuthView):
    @extend_schema(
        summary="Sign in with Google",
        description="Checks the ID token from Google's sign-in button. A Google account "
        "connected to a user logs that user in (200); a new one creates an account named "
        "after its email, with no password, and logs it in (201). A bad token is a 400 on "
        "`credential`. Shares the sign-up/log-in rate limit.",
        request=GoogleCredentialSerializer,
        responses={200: TokenSerializer, 201: TokenSerializer},
        tags=["auth"],
    )
    def post(self, request):
        sub, email, vouched = google_account(request)
        # A few tries: two first sign-ins at once can race for the same sub or username.
        for _ in range(3):
            account = (
                GoogleAccount.objects.select_related("user").filter(sub=sub).first()
            )
            if account:
                # Password log-in refuses inactive users too (Django's authenticate).
                if not account.user.is_active:
                    break
                if account.email != email:  # shown on Account; Google's can change
                    account.email = email
                    account.save(update_fields=["email"])
                return token_response(account.user)
            try:
                with transaction.atomic():
                    # Only a new account takes Google's email, and only one Google vouches
                    # for that no account has: existing accounts are never matched by it.
                    user = User.objects.create_user(
                        google.username_for(email),
                        email=email if vouched and not email_taken(email) else "",
                    )
                    GoogleAccount.objects.create(user=user, sub=sub, email=email)
            except IntegrityError:
                continue
            return token_response(user, status.HTTP_201_CREATED)
        raise serializers.ValidationError({"credential": [GOOGLE_FAILED]})


class DemoView(PublicAuthView):
    @extend_schema(
        summary="Try the demo",
        description="Creates a throwaway account with two sample builds (one sold, one in "
        "progress) and logs it in. It works for 24 hours, then its token returns `401` "
        "and it's deleted. Shares the sign-up/log-in rate limit.",
        request=None,
        responses={201: TokenSerializer},
        tags=["auth"],
    )
    def post(self, request):
        return token_response(create_demo_user(), status.HTTP_201_CREATED)


class LogoutView(APIView):
    @extend_schema(
        summary="Log out",
        description="Deletes the token, so it stops working everywhere.",
        request=None,
        responses={204: None},
        tags=["auth"],
    )
    def post(self, request):
        request.auth.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    throttle_scope = "auth"

    def get_throttles(self):
        # Renames only: each says whether a name is taken, like sign-up.
        return [ScopedRateThrottle()] if self.request.method == "PATCH" else []

    @extend_schema(
        summary="Who's logged in",
        responses={200: MeSerializer},
        tags=["auth"],
    )
    def get(self, request):
        user = request.user
        return Response(
            {
                "username": user.username,
                "google": connected_google(user),
                "has_password": user.has_usable_password(),
                "is_demo": is_demo(user),
                "email": user.email,
            }
        )

    @extend_schema(
        summary="Change your username",
        description="The sign-up rules apply, except that changing only the case of your "
        "own name is allowed. Refused (403) for a demo. Rate-limited (`auth`).",
        request=UsernameSerializer,
        responses={200: MeSerializer},
        tags=["auth"],
    )
    def patch(self, request):
        user = request.user
        refuse_demo(user)
        serializer = UsernameSerializer(data=request.data, context={"user": user})
        serializer.is_valid(raise_exception=True)
        user.username = serializer.validated_data["username"]
        try:
            with transaction.atomic():
                user.save(update_fields=["username"])
        except IntegrityError:
            # Someone took the name between the check above and now.
            raise serializers.ValidationError({"username": [TAKEN]})
        return self.get(request)


class PasswordView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    @extend_schema(
        summary="Change your password",
        description="Checks the current password, then sets the new one and replaces the "
        "token, so every other device is logged out; use the one returned. A wrong current "
        "password is a 400 on `current_password`; an account without a password "
        "(Google-only) is a 400; a demo is a 403.",
        request=PasswordChangeSerializer,
        responses={200: TokenSerializer},
        tags=["auth"],
    )
    def post(self, request):
        user = request.user
        refuse_demo(user)
        if not user.has_usable_password():
            refuse("You log in with Google, so there's no password to change.")
        serializer = PasswordChangeSerializer(data=request.data, context={"user": user})
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            user.set_password(serializer.validated_data["new_password"])
            user.save(update_fields=["password"])
            Token.objects.filter(user=user).delete()
            return token_response(user)


class EmailView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "email"  # 5 an hour per user: each send is an email

    @extend_schema(
        summary="Add or change your email",
        description="Emails a confirmation link to the address (202); nothing is saved "
        "until it's opened. Another account's email, or your own again, is a 400 on "
        "`email`; a demo is a 403. 5 an hour per account.",
        request=EmailSerializer,
        responses={202: None},
        tags=["auth"],
    )
    def post(self, request):
        user = request.user
        refuse_demo(user)
        serializer = EmailSerializer(data=request.data, context={"user": user})
        serializer.is_valid(raise_exception=True)
        send_confirmation(user, serializer.validated_data["email"])
        return Response(status=status.HTTP_202_ACCEPTED)


class ConfirmEmailView(PublicAuthView):
    @extend_schema(
        summary="Confirm an email",
        description="Saves the email from a confirmation link (no log-in needed: it may be "
        "opened on another device). Expired (24 hours), used, outdated or changed links are "
        "a 400 on `token`; an email another account took meanwhile is a 400 on `email`. A "
        "replaced email gets a notice.",
        request=ConfirmEmailSerializer,
        responses={200: ConfirmedEmailSerializer},
        tags=["auth"],
    )
    def post(self, request):
        serializer = ConfirmEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            link = signing.loads(
                serializer.validated_data["token"],
                salt=CONFIRM_SALT,
                max_age=CONFIRM_MAX_AGE,
            )
        except signing.BadSignature:  # expired is a kind of bad signature
            raise serializers.ValidationError({"token": [LINK_GONE]})
        user = User.objects.filter(pk=link["user"], is_active=True).first()
        # Used, or changed since: the account's email isn't the one it was sent from.
        if user is None or not constant_time_compare(
            email_mark(user.email), link["was"]
        ):
            raise serializers.ValidationError({"token": [LINK_GONE]})
        if email_taken(link["email"], user):
            raise serializers.ValidationError({"email": [TAKEN_EMAIL]})
        was, user.email = user.email, link["email"]
        try:
            with transaction.atomic():
                user.save(update_fields=["email"])
        except IntegrityError:
            # Another account confirmed it between the check above and now.
            raise serializers.ValidationError({"email": [TAKEN_EMAIL]})
        if was:
            emails.email_changed(user.username, was, user.email)
        return Response({"email": user.email})


RESET_SENT = "If an account has that email, we've sent it a link."
RESET_WAIT = 15 * 60  # seconds between reset emails to one address


class ResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)


class ResetSentSerializer(serializers.Serializer):
    detail = serializers.CharField(read_only=True)


class ResetSerializer(serializers.Serializer):
    uid = serializers.CharField(help_text="From the link in the email.")
    token = serializers.CharField(help_text="From the link in the email.")
    new_password = serializers.CharField(
        write_only=True, trim_whitespace=False, style={"input_type": "password"}
    )


class ResetRequestView(PublicAuthView):
    @extend_schema(
        summary="Forgot your username or password",
        description="Always 202 with the same message, whether or not an account has the "
        "email. An active account with that email (any case) gets its username and a "
        "link to set a new password, valid for 1 hour; a Google-only account sets its "
        "first one this way. One email per address "
        "per 15 minutes; asking again within that sends nothing, and nothing is locked.",
        request=ResetRequestSerializer,
        responses={202: ResetSentSerializer},
        tags=["auth"],
    )
    def post(self, request):
        serializer = ResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        user = User.objects.filter(email__iexact=email, is_active=True).first()
        # A Google-only account gets the link too: it's how one adds a password. A demo
        # never does: a password would make it a normal account that cleanup never deletes.
        # The wait is marked only when an email goes out, so made-up addresses can't fill
        # the cache and push real marks out. add() is False while a mark is still there.
        # ponytail: in each process's memory, like the rate limit; a shared cache if
        # there's ever more than one worker.
        if (
            user
            and not is_demo(user)
            and cache.add(f"reset:{email_mark(email.lower())}", True, RESET_WAIT)
        ):
            emails.reset_password(
                user.username,
                user.email,
                urlsafe_base64_encode(force_bytes(user.pk)),
                default_token_generator.make_token(user),
            )
        return Response({"detail": RESET_SENT}, status=status.HTTP_202_ACCEPTED)


class ResetView(PublicAuthView):
    @extend_schema(
        summary="Set a new password from a reset link",
        description="Sets the password and deletes the token, so every device is logged "
        "out; it doesn't log in (204). The account's email gets a notice. A link works "
        "once, for 1 hour, and stops working once the password changes: otherwise, or "
        "when changed, a 400 on `token`. The new password must pass the validators (a 400 "
        "on `new_password`).",
        request=ResetSerializer,
        responses={204: None},
        tags=["auth"],
    )
    def post(self, request):
        serializer = ResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            pk = int(urlsafe_base64_decode(data["uid"]))
        except ValueError:
            pk = None
        user = User.objects.filter(pk=pk, is_active=True).first() if pk else None
        if user is None or not default_token_generator.check_token(user, data["token"]):
            raise serializers.ValidationError({"token": [LINK_GONE]})
        try:
            validate_password(data["new_password"], user)
        except DjangoValidationError as e:
            raise serializers.ValidationError({"new_password": list(e.messages)})
        with transaction.atomic():
            user.set_password(data["new_password"])
            user.save(update_fields=["password"])
            Token.objects.filter(user=user).delete()
        emails.password_changed(user.username, user.email)
        return Response(status=status.HTTP_204_NO_CONTENT)


def send_confirmation(user, email: str):
    """Emails a link that saves `email` on `user` once opened, if their email hasn't
    changed by then."""
    token = signing.dumps(
        {"user": user.pk, "email": email, "was": email_mark(user.email)},
        salt=CONFIRM_SALT,
    )
    emails.confirm_email(email, token)


def refuse_demo(user):
    if is_demo(user):
        raise PermissionDenied(
            "Demo accounts can't change their account. Sign up for your own account first."
        )


def refuse(message: str):
    raise serializers.ValidationError({"non_field_errors": [message]})


class GoogleConnectView(APIView):
    """The Account page: link the logged-in user to a Google account, or unlink it."""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    @extend_schema(
        summary="Connect Google",
        description="Links the Google account in the ID token to the logged-in user, so "
        "signing in with Google opens this account. Refused (400) for a demo, an account "
        "that already has one, and a Google account connected to someone else.",
        request=GoogleCredentialSerializer,
        responses={200: ConnectSerializer},
        tags=["auth"],
    )
    def post(self, request):
        user = request.user
        if is_demo(user):
            refuse(
                "Demo accounts can't connect Google. Sign up for your own account first."
            )
        if GoogleAccount.objects.filter(user=user).exists():
            refuse("Disconnect Google first.")
        sub, email, _ = google_account(request)
        try:
            with transaction.atomic():
                GoogleAccount.objects.create(user=user, sub=sub, email=email)
        except IntegrityError:
            # Taken: by another user, or by this one meanwhile (a second request).
            account = GoogleAccount.objects.filter(sub=sub).first()
            if account and account.user_id == user.pk:
                return Response({"google": {"email": account.email}})
            refuse(CONNECTED_ELSEWHERE if account else "Disconnect Google first.")
        return Response({"google": {"email": email}})

    @extend_schema(
        summary="Disconnect Google",
        description="Unlinks the Google account. Refused (400) without a password, the "
        "only other way in, or when none is connected.",
        request=None,
        responses={204: None},
        tags=["auth"],
    )
    def delete(self, request):
        user = request.user
        if not user.has_usable_password():
            refuse("Set up a password first; it's the only other way in.")
        if not GoogleAccount.objects.filter(user=user).delete()[0]:
            refuse("No Google account is connected.")
        return Response(status=status.HTTP_204_NO_CONTENT)
