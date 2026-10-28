from decimal import Decimal as D
from io import StringIO
from unittest import mock

from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.db import IntegrityError, transaction
from django.test import TestCase
from rest_framework.test import APITestCase

from .models import Build, Bundle, ExtraCost, Part


def alice() -> User:
    """Owns the test builds, and is who the API tests are logged in as."""
    return User.objects.get_or_create(username="alice")[0]


def new_build(owner: User | None = None, **fields) -> Build:
    return Build.objects.create(owner=owner or alice(), **fields)


class LoggedInApiTestCase(APITestCase):
    def setUp(self):
        self.client.force_authenticate(alice())


class BuildApiTests(LoggedInApiTestCase):
    def test_list_returns_newest_first_with_money_as_string(self):
        new_build(name="Old", selling_price="41500.00")
        new_build(name="New")

        res = self.client.get("/api/builds/")

        self.assertEqual(res.status_code, 200)
        self.assertEqual([b["name"] for b in res.json()], ["New", "Old"])
        self.assertEqual(res.json()[1]["selling_price"], "41500.00")
        self.assertIsNone(res.json()[0]["selling_price"])

    def test_create_defaults_to_planning(self):
        res = self.client.post(
            "/api/builds/", {"name": "Ryzen 5 5600 + RTX 4060"}, format="json"
        )

        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.json()["status"], "planning")

    def test_rejects_negative_selling_price(self):
        res = self.client.post(
            "/api/builds/", {"name": "X", "selling_price": "-1.00"}, format="json"
        )

        self.assertEqual(res.status_code, 400)
        self.assertIn("selling_price", res.json())


class BuildTotalsTests(TestCase):
    def make_build(self, selling_price=None, parts=(), extras=()):
        """parts: (listed_price, bought_for) pairs; extras: amounts. Returns a fresh
        instance so money comes back from Postgres as Decimal, not the str we passed."""
        build = new_build(name="Test build", selling_price=selling_price)
        for listed, bought in parts:
            build.parts.create(
                name="Part",
                category=Part.Category.OTHER,
                listed_price=listed,
                bought_for=bought,
            )
        for amount in extras:
            build.extra_costs.create(label="Cost", amount=amount)
        return Build.objects.get(pk=build.pk)

    def test_matches_the_spec_example(self):
        b = self.make_build(
            selling_price="50000.00",
            parts=[("30000.00", "26000.00"), ("22000.00", "19500.00")],
            extras=["500.00", "300.00"],
        )

        self.assertEqual(b.listed_total, D("52000.00"))
        self.assertEqual(b.parts_cost, D("45500.00"))
        self.assertEqual(b.extra_costs_total, D("800.00"))
        self.assertEqual(b.total_cost, D("46300.00"))
        self.assertEqual(b.profit, D("3700.00"))
        self.assertEqual(b.profit_margin, D("7.40"))
        self.assertEqual(b.below_market, D("2000.00"))
        self.assertEqual(b.below_market_pct, D("3.85"))
        self.assertEqual(b.voucher_savings, D("6500.00"))

    def test_empty_build_is_all_zero_and_no_selling_price_fields(self):
        b = self.make_build()

        for field in [
            "listed_total",
            "parts_cost",
            "extra_costs_total",
            "total_cost",
            "voucher_savings",
        ]:
            self.assertEqual(getattr(b, field), D("0.00"), field)
        for field in ["profit", "profit_margin", "below_market", "below_market_pct"]:
            self.assertIsNone(getattr(b, field), field)

    def test_selling_price_of_zero_is_a_full_loss_with_no_margin(self):
        b = self.make_build(selling_price="0.00", parts=[("1000.00", "800.00")])

        self.assertEqual(b.profit, D("-800.00"))
        self.assertIsNone(b.profit_margin)  # would divide by zero
        self.assertEqual(b.below_market, D("1000.00"))
        self.assertEqual(b.below_market_pct, D("100.00"))

    def test_below_market_pct_is_none_without_listed_prices(self):
        b = self.make_build(selling_price="5000.00", extras=["100.00"])

        self.assertEqual(b.below_market, D("-5000.00"))
        self.assertIsNone(b.below_market_pct)

    def test_a_loss_is_negative(self):
        b = self.make_build(
            selling_price="9000.00", parts=[("10000.00", "9500.00")], extras=["200.00"]
        )

        self.assertEqual(b.profit, D("-700.00"))
        self.assertEqual(b.profit_margin, D("-7.78"))

    def test_percentages_round_half_up_to_two_places(self):
        third = self.make_build(selling_price="3.00", parts=[("2.00", "2.00")])
        half = self.make_build(selling_price="800.00", parts=[("799.00", "799.00")])

        self.assertEqual(third.profit_margin, D("33.33"))
        self.assertEqual(half.profit_margin, D("0.13"))  # 0.125, not banker's 0.12

    def test_deleting_a_build_deletes_its_parts_and_extra_costs(self):
        b = self.make_build(parts=[("1.00", "1.00")], extras=["1.00"])

        b.delete()

        self.assertEqual(Part.objects.count(), 0)
        self.assertEqual(ExtraCost.objects.count(), 0)


class PriceValidationTests(TestCase):
    def test_negative_prices_fail_validation(self):
        build = new_build(name="X")
        part = Part(
            build=build,
            name="CPU",
            category="cpu",
            listed_price="-1.00",
            bought_for="-1.00",
        )
        cost = ExtraCost(build=build, label="Fee", amount="-1.00")

        with self.assertRaises(ValidationError) as ctx:
            part.full_clean()
        self.assertEqual(
            set(ctx.exception.message_dict), {"listed_price", "bought_for"}
        )
        with self.assertRaises(ValidationError):
            cost.full_clean()

    def test_database_rejects_negative_money_even_without_validation(self):
        build = new_build(name="X")
        writes = [
            lambda: new_build(name="Y", selling_price="-1.00"),
            lambda: build.parts.create(
                name="CPU", category="cpu", listed_price="-1.00", bought_for="1.00"
            ),
            lambda: build.parts.create(
                name="CPU", category="cpu", listed_price="1.00", bought_for="-1.00"
            ),
            lambda: build.extra_costs.create(label="Fee", amount="-1.00"),
        ]
        for write in writes:
            with self.assertRaises(IntegrityError), transaction.atomic():
                write()


class DetailApiTests(LoggedInApiTestCase):
    def setUp(self):
        super().setUp()
        self.build = new_build(name="Spec example", selling_price="50000.00")
        self.build.parts.create(
            name="RTX 4060",
            category="gpu",
            shop="Shopee",
            listed_price="30000.00",
            bought_for="26000.00",
        )
        self.build.parts.create(
            name="Ryzen 5 7600",
            category="cpu",
            listed_price="22000.00",
            bought_for="19500.00",
        )
        self.build.extra_costs.create(label="Shipping", amount="500.00")
        self.build.extra_costs.create(label="Platform fee", amount="300.00")

    def test_detail_nests_parts_extra_costs_and_spec_totals(self):
        res = self.client.get(f"/api/builds/{self.build.id}/")

        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(
            [p["name"] for p in body["parts"]], ["RTX 4060", "Ryzen 5 7600"]
        )
        self.assertEqual(body["parts"][0]["listed_price"], "30000.00")
        self.assertEqual(
            [c["label"] for c in body["extra_costs"]], ["Shipping", "Platform fee"]
        )
        self.assertEqual(
            body["totals"],
            {
                "listed_total": "52000.00",
                "parts_cost": "45500.00",
                "extra_costs": "800.00",
                "total_cost": "46300.00",
                "profit": "3700.00",
                "profit_margin": "7.40",
                "below_market": "2000.00",
                "below_market_pct": "3.85",
                "voucher_savings": "6500.00",
            },
        )

    def test_without_selling_price_the_dependent_totals_are_null(self):
        build = new_build(name="Unpriced")

        totals = self.client.get(f"/api/builds/{build.id}/").json()["totals"]

        self.assertEqual(totals["total_cost"], "0.00")
        for key in ["profit", "profit_margin", "below_market", "below_market_pct"]:
            self.assertIsNone(totals[key], key)

    def test_list_has_totals_but_no_nesting(self):
        row = self.client.get("/api/builds/").json()[0]

        self.assertEqual(row["totals"]["profit"], "3700.00")
        self.assertNotIn("parts", row)
        self.assertNotIn("extra_costs", row)

    def test_query_counts_do_not_grow_with_data(self):
        for b in [self.build, *(new_build(name=f"B{i}") for i in range(5))]:
            b.parts.create(
                name="P", category="ram", listed_price="1.00", bought_for="1.00"
            )
            b.extra_costs.create(label="C", amount="1.00")
            b.bundles.create(name="Deal", bought_for="1.00").parts.create(
                build=b, name="Q", category="cpu", listed_price="1.00"
            )

        with self.assertNumQueries(4):  # builds, parts, bundles, extra costs
            self.client.get("/api/builds/")
        with self.assertNumQueries(5):  # ... and the bundles' parts
            self.client.get(f"/api/builds/{self.build.id}/")

    def test_deleting_a_build_via_api_deletes_its_children(self):
        res = self.client.delete(f"/api/builds/{self.build.id}/")

        self.assertEqual(res.status_code, 204)
        self.assertEqual(Part.objects.count(), 0)
        self.assertEqual(ExtraCost.objects.count(), 0)


class ChildApiTests(LoggedInApiTestCase):
    def setUp(self):
        super().setUp()
        self.build = new_build(name="B")

    def test_part_create_update_delete(self):
        res = self.client.post(
            "/api/parts/",
            {
                "build": self.build.id,
                "name": "Ryzen 5 7600",
                "category": "cpu",
                "shop": "Shopee",
                "listed_price": "12000.00",
                "bought_for": "10500.00",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        part_id = res.json()["id"]

        res = self.client.patch(
            f"/api/parts/{part_id}/", {"bought_for": "10000.00"}, format="json"
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(Part.objects.get(pk=part_id).bought_for, D("10000.00"))

        self.assertEqual(self.client.delete(f"/api/parts/{part_id}/").status_code, 204)
        self.assertFalse(Part.objects.exists())

    def test_extra_cost_create_update_delete(self):
        res = self.client.post(
            "/api/extra-costs/",
            {
                "build": self.build.id,
                "label": "Shipping",
                "amount": "150.00",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        cost_id = res.json()["id"]

        res = self.client.patch(
            f"/api/extra-costs/{cost_id}/", {"amount": "180.00"}, format="json"
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(ExtraCost.objects.get(pk=cost_id).amount, D("180.00"))

        self.assertEqual(
            self.client.delete(f"/api/extra-costs/{cost_id}/").status_code, 204
        )

    def test_negative_prices_are_400_with_the_field_name(self):
        res = self.client.post(
            "/api/parts/",
            {
                "build": self.build.id,
                "name": "X",
                "category": "cpu",
                "listed_price": "-1.00",
                "bought_for": "5.00",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()["listed_price"], ["Must be 0 or more."])

        res = self.client.post(
            "/api/extra-costs/",
            {
                "build": self.build.id,
                "label": "Fee",
                "amount": "-1.00",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("amount", res.json())

    def test_unknown_build_or_category_is_400(self):
        res = self.client.post(
            "/api/parts/",
            {
                "build": 999999,
                "name": "X",
                "category": "toaster",
                "listed_price": "1.00",
                "bought_for": "1.00",
            },
            format="json",
        )

        self.assertEqual(res.status_code, 400)
        self.assertEqual(set(res.json()), {"build", "category"})

    def test_a_part_or_cost_cant_move_to_another_build(self):
        other = new_build(name="Other")
        part = self.build.parts.create(
            name="P", category="cpu", listed_price="1.00", bought_for="1.00"
        )
        cost = self.build.extra_costs.create(label="Shipping", amount="1.00")

        for url in (f"/api/parts/{part.id}/", f"/api/extra-costs/{cost.id}/"):
            res = self.client.patch(url, {"build": other.id}, format="json")
            self.assertEqual(res.status_code, 400)
            self.assertIn("build", res.json())
        # Sending its own build is fine.
        res = self.client.patch(
            f"/api/parts/{part.id}/", {"build": self.build.id}, format="json"
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(Part.objects.get(pk=part.id).build, self.build)
        self.assertEqual(ExtraCost.objects.get(pk=cost.id).build, self.build)


class BundleTests(LoggedInApiTestCase):
    """The SPEC's example: a ₱7,500 board + CPU + RAM bundle, CPU's share typed in."""

    def setUp(self):
        super().setUp()
        self.build = new_build(name="Bundle build", selling_price="10000.00")
        self.build.parts.create(
            name="RX 580", category="gpu", listed_price="4000.00", bought_for="3000.00"
        )
        self.bundle = self.build.bundles.create(
            name="B550m + R5 5600 + 16GB", bought_for="7500.00"
        )
        for name, category, listed, bought in [
            ("Ryzen 5 5600", "cpu", "7199.00", "3500.00"),
            ("Asrock B550m", "motherboard", "6000.00", None),
            ("Kingston 16GB", "ram", "2000.00", None),
        ]:
            self.build.parts.create(
                bundle=self.bundle,
                name=name,
                category=category,
                listed_price=listed,
                bought_for=bought,
            )
        self.cpu = Part.objects.get(name="Ryzen 5 5600")

    def post_part(self, **fields):
        return self.client.post(
            "/api/parts/",
            {
                "build": self.build.id,
                "name": "X",
                "category": "other",
                "listed_price": "1.00",
                **fields,
            },
            format="json",
        )

    def test_the_bundle_price_counts_once_and_typed_amounts_dont(self):
        body = self.client.get(f"/api/builds/{self.build.id}/").json()

        self.assertEqual(body["totals"]["listed_total"], "19199.00")
        self.assertEqual(body["totals"]["parts_cost"], "10500.00")  # 3000 + 7500
        self.assertEqual(body["totals"]["profit"], "-500.00")
        self.assertEqual(
            body["bundles"],
            [
                {
                    "id": self.bundle.id,
                    "build": self.build.id,
                    "name": "B550m + R5 5600 + 16GB",
                    "shop": "",
                    "bought_for": "7500.00",
                    "listed_total": "15199.00",
                    "unassigned": "4000.00",
                }
            ],
        )
        board = next(p for p in body["parts"] if p["category"] == "motherboard")
        self.assertEqual((board["bundle"], board["bought_for"]), (self.bundle.id, None))

    def test_an_empty_bundle_still_counts(self):
        build = new_build(name="Empty")
        build.bundles.create(name="Deal", bought_for="500.00")

        body = self.client.get(f"/api/builds/{build.id}/").json()

        self.assertEqual(body["totals"]["parts_cost"], "500.00")
        self.assertEqual(body["bundles"][0]["unassigned"], "500.00")

    def test_a_loose_part_needs_a_bought_for(self):
        res = self.post_part()
        self.assertEqual(res.status_code, 400)
        self.assertIn("bought_for", res.json())

        # Moving a part out of its bundle with nothing typed in, too.
        board = Part.objects.get(category="motherboard")
        res = self.client.patch(
            f"/api/parts/{board.id}/", {"bundle": None}, format="json"
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("bought_for", res.json())

        with self.assertRaises(IntegrityError), transaction.atomic():
            Part.objects.create(
                build=self.build, name="X", category="other", listed_price=1
            )

    def test_a_bundled_part_can_leave_bought_for_blank(self):
        res = self.post_part(bundle=self.bundle.id)

        self.assertEqual(res.status_code, 201)
        self.assertIsNone(res.json()["bought_for"])

    def test_bundled_amounts_cant_pass_the_bundle_price(self):
        # 3500 typed already: 4000 more fits exactly, 4000.01 doesn't.
        self.assertEqual(
            self.post_part(bundle=self.bundle.id, bought_for="4000.00").status_code, 201
        )
        res = self.post_part(bundle=self.bundle.id, bought_for="0.01")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(
            res.json()["bought_for"],
            ["Bundled parts can't add up to more than the bundle's ₱7,500.00."],
        )

        # Editing a part doesn't count its old amount against itself.
        res = self.client.patch(
            f"/api/parts/{self.cpu.id}/", {"bought_for": "3500.00"}, format="json"
        )
        self.assertEqual(res.status_code, 200)

    def test_moving_a_part_checks_the_bundle_it_goes_into(self):
        small = self.build.bundles.create(name="Small", bought_for="1000.00")
        roomy = self.build.bundles.create(name="Roomy", bought_for="5000.00")
        gpu = Part.objects.get(name="RX 580")

        def move(part, bundle):
            return self.client.patch(
                f"/api/parts/{part.id}/", {"bundle": bundle.id}, format="json"
            )

        # The CPU's ₱3,500 doesn't fit in ₱1,000, but fits in ₱5,000.
        res = move(self.cpu, small)
        self.assertEqual(res.status_code, 400)
        self.assertIn("bought_for", res.json())
        self.assertEqual(move(self.cpu, roomy).status_code, 200)

        # The loose GPU's ₱3,000 fits back in the first bundle, now empty of amounts.
        self.assertEqual(move(gpu, self.bundle).status_code, 200)
        self.assertEqual(
            self.client.get(f"/api/builds/{self.build.id}/").json()["totals"][
                "parts_cost"
            ],
            "13500.00",  # 7500 + 1000 + 5000, no loose parts left
        )

    def test_lowering_the_bundle_price_below_its_parts_is_400(self):
        url = f"/api/bundles/{self.bundle.id}/"

        res = self.client.patch(url, {"bought_for": "3499.99"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("bought_for", res.json())

        res = self.client.patch(url, {"bought_for": "3500.00"}, format="json")
        self.assertEqual(res.json()["unassigned"], "0.00")

    def test_a_bundle_from_another_build_is_400(self):
        other = new_build(name="Other").bundles.create(name="D", bought_for="1.00")

        res = self.post_part(bundle=other.id, bought_for="1.00")
        self.assertEqual(res.status_code, 400)
        self.assertIn("bundle", res.json())

    def test_bundle_create_and_delete_takes_its_parts(self):
        res = self.client.post(
            "/api/bundles/",
            {"build": self.build.id, "name": "Deal", "bought_for": "100.00"},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.json()["listed_total"], "0.00")

        res = self.client.delete(f"/api/bundles/{self.bundle.id}/")
        self.assertEqual(res.status_code, 204)
        self.assertEqual(list(Part.objects.values_list("name", flat=True)), ["RX 580"])

    def test_a_bundle_cant_move_to_another_build(self):
        other = new_build(name="Other")

        res = self.client.patch(
            f"/api/bundles/{self.bundle.id}/", {"build": other.id}, format="json"
        )

        self.assertEqual(res.status_code, 400)
        self.assertIn("build", res.json())


class AuthTests(APITestCase):
    def setUp(self):
        cache.clear()  # the sign-up/log-in rate limit counts live in the cache

    def post(self, url, data=None):
        return self.client.post(url, data or {}, format="json")

    def test_sign_up_log_in_and_log_out(self):
        res = self.post(
            "/api/auth/signup/", {"username": "carol", "password": "a long passphrase"}
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.json()["username"], "carol")
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {res.json()['token']}")
        self.assertEqual(self.client.get("/api/auth/me/").json(), {"username": "carol"})
        self.assertEqual(self.client.get("/api/builds/").json(), [])

        self.assertEqual(self.post("/api/auth/logout/").status_code, 204)
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)

        self.client.credentials()
        res = self.post(
            "/api/auth/login/", {"username": "carol", "password": "wrong password"}
        )
        self.assertEqual(res.status_code, 400)
        self.assertEqual(
            res.json(), {"non_field_errors": ["Wrong username or password."]}
        )
        res = self.post(
            "/api/auth/login/", {"username": "carol", "password": "a long passphrase"}
        )
        self.assertEqual(res.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {res.json()['token']}")
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 200)

    def test_sign_up_errors_are_under_their_field(self):
        User.objects.create_user("carol", password="x")

        res = self.post(
            "/api/auth/signup/", {"username": "Carol", "password": "a long passphrase"}
        )
        self.assertEqual(res.json(), {"username": ["That username is taken."]})

        res = self.post("/api/auth/signup/", {"username": "dave", "password": "123"})
        self.assertEqual(res.status_code, 400)
        self.assertEqual(set(res.json()), {"password"})
        self.assertIn("This password is entirely numeric.", res.json()["password"])
        self.assertFalse(User.objects.filter(username="dave").exists())

    def test_without_a_token_everything_is_401(self):
        build = new_build(name="B")
        for url in [
            "/api/builds/",
            f"/api/builds/{build.id}/",
            "/api/parts/",
            "/api/extra-costs/",
            "/api/auth/me/",
        ]:
            self.assertEqual(self.client.get(url).status_code, 401, url)
        self.assertEqual(self.post("/api/builds/", {"name": "X"}).status_code, 401)
        self.assertEqual(self.post("/api/auth/logout/").status_code, 401)

        self.client.credentials(HTTP_AUTHORIZATION="Token not-a-real-token")
        self.assertEqual(self.client.get("/api/builds/").status_code, 401)

    def test_log_in_ignores_username_case_like_sign_up(self):
        # Sign-up already treats "Carol" and "carol" as the same name.
        User.objects.create_user("Carol", password="a long passphrase")

        res = self.post(
            "/api/auth/login/", {"username": "carol", "password": "a long passphrase"}
        )

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["username"], "Carol")

    def test_log_in_is_rate_limited(self):
        wrong = {"username": "carol", "password": "nope"}
        for _ in range(10):
            self.assertEqual(self.post("/api/auth/login/", wrong).status_code, 400)
        self.assertEqual(self.post("/api/auth/login/", wrong).status_code, 429)

    def test_a_faked_forwarded_for_header_doesnt_reset_the_limit(self):
        wrong = {"username": "carol", "password": "nope"}
        codes = [
            self.client.post(
                "/api/auth/login/",
                wrong,
                format="json",
                HTTP_X_FORWARDED_FOR=f"10.0.0.{i}",
            ).status_code
            for i in range(11)
        ]
        self.assertEqual(codes, [400] * 10 + [429])

    def test_a_username_taken_at_the_same_moment_is_a_400(self):
        User.objects.create_user("carol", password="x")
        # As if the "taken" check ran just before another sign-up created carol.
        with mock.patch(
            "builds.auth.SignupSerializer.validate_username", lambda self, name: name
        ):
            res = self.post(
                "/api/auth/signup/",
                {"username": "carol", "password": "a long passphrase"},
            )
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json(), {"username": ["That username is taken."]})


class IsolationTests(LoggedInApiTestCase):
    """alice is logged in. Everything set up here belongs to bob."""

    def setUp(self):
        super().setUp()
        bob = User.objects.create_user("bob")
        self.build = new_build(owner=bob, name="Bob's build")
        self.part = self.build.parts.create(
            name="P", category="cpu", listed_price="1.00", bought_for="1.00"
        )
        self.cost = self.build.extra_costs.create(label="Shipping", amount="1.00")
        self.bundle = self.build.bundles.create(name="Deal", bought_for="1.00")

    def test_another_users_build_part_and_cost_are_404(self):
        for url, patch in [
            (f"/api/builds/{self.build.id}/", {"name": "Mine now"}),
            (f"/api/parts/{self.part.id}/", {"name": "Mine now"}),
            (f"/api/extra-costs/{self.cost.id}/", {"label": "Mine now"}),
            (f"/api/bundles/{self.bundle.id}/", {"name": "Mine now"}),
        ]:
            self.assertEqual(self.client.get(url).status_code, 404, url)
            self.assertEqual(
                self.client.patch(url, patch, format="json").status_code, 404, url
            )
            self.assertEqual(self.client.delete(url).status_code, 404, url)

        self.assertEqual(Build.objects.get().name, "Bob's build")
        self.assertEqual(Part.objects.get().name, "P")
        self.assertEqual(ExtraCost.objects.get().label, "Shipping")
        self.assertEqual(Bundle.objects.get().name, "Deal")

    def test_lists_only_show_your_own(self):
        new_build(name="Mine")

        self.assertEqual(
            [b["name"] for b in self.client.get("/api/builds/").json()], ["Mine"]
        )
        self.assertEqual(self.client.get("/api/parts/").json(), [])
        self.assertEqual(self.client.get("/api/extra-costs/").json(), [])
        self.assertEqual(self.client.get("/api/bundles/").json(), [])

    def test_cant_add_to_another_users_build(self):
        for url, data in [
            (
                "/api/parts/",
                {
                    "name": "X",
                    "category": "cpu",
                    "listed_price": "1.00",
                    "bought_for": "1.00",
                },
            ),
            ("/api/extra-costs/", {"label": "X", "amount": "1.00"}),
            ("/api/bundles/", {"name": "X", "bought_for": "1.00"}),
        ]:
            res = self.client.post(url, {"build": self.build.id, **data}, format="json")
            self.assertEqual(res.status_code, 400, url)
            self.assertIn("build", res.json())
        self.assertEqual(Part.objects.count(), 1)
        self.assertEqual(ExtraCost.objects.count(), 1)
        self.assertEqual(Bundle.objects.count(), 1)

    def test_cant_put_a_part_in_another_users_bundle(self):
        mine = new_build(name="Mine")

        res = self.client.post(
            "/api/parts/",
            {
                "build": mine.id,
                "bundle": self.bundle.id,
                "name": "X",
                "category": "cpu",
                "listed_price": "1.00",
            },
            format="json",
        )

        self.assertEqual(res.status_code, 400)
        self.assertIn("bundle", res.json())

    def test_a_new_build_belongs_to_whoever_created_it(self):
        res = self.client.post("/api/builds/", {"name": "New"}, format="json")

        self.assertEqual(Build.objects.get(pk=res.json()["id"]).owner, alice())


class ApiDocsTests(LoggedInApiTestCase):
    def test_schema_is_valid_openapi_with_no_warnings(self):
        # Fails if a view or serializer change leaves the docs broken or ambiguous.
        call_command("spectacular", "--validate", "--fail-on-warn", stdout=StringIO())

    def test_docs_page_and_schema_are_public(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get("/api/docs/").status_code, 200)
        self.assertEqual(self.client.get("/api/schema/").status_code, 200)

    def test_put_is_not_offered(self):
        build = new_build(name="B")

        res = self.client.put(f"/api/builds/{build.id}/", {"name": "X"}, format="json")

        self.assertEqual(res.status_code, 405)


class AdminTests(TestCase):
    def test_admin_pages_load_for_a_superuser(self):
        build = new_build(name="Admin build")
        Part.objects.create(
            build=build, name="Ryzen", category="cpu", listed_price=1, bought_for=1
        )
        ExtraCost.objects.create(build=build, label="Gas", amount=1)
        Bundle.objects.create(build=build, name="Deal", bought_for=1)
        self.client.force_login(User.objects.create_superuser("admin", password="x"))

        for url in [
            "/admin/builds/build/",
            f"/admin/builds/build/{build.id}/change/",
            "/admin/builds/part/",
            "/admin/builds/extracost/",
            "/admin/builds/bundle/",
        ]:
            self.assertEqual(self.client.get(url).status_code, 200, url)

    def test_admin_login_is_rate_limited(self):
        cache.clear()
        wrong = {"username": "admin", "password": "nope"}
        codes = [
            self.client.post("/admin/login/", wrong).status_code for _ in range(11)
        ]
        # A wrong password re-shows the form (200); the 11th try in a minute is refused.
        self.assertEqual(codes, [200] * 10 + [429])
        self.assertEqual(self.client.get("/admin/login/").status_code, 200)

    def test_admin_requires_login(self):
        self.assertEqual(self.client.get("/admin/builds/build/").status_code, 302)
