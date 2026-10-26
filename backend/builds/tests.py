from decimal import Decimal as D
from io import StringIO

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings
from rest_framework.test import APIClient, APITestCase

from .models import Build, ExtraCost, Part

KEY = "test-access-key"


class KeyedClient(APIClient):
    """Sends the access key with every request, as the unlocked frontend does."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.credentials(HTTP_X_ACCESS_KEY=KEY)


@override_settings(ACCESS_KEY=KEY)
class KeyedApiTestCase(APITestCase):
    client_class = KeyedClient


class BuildApiTests(KeyedApiTestCase):
    def test_list_returns_newest_first_with_money_as_string(self):
        Build.objects.create(name="Old", selling_price="41500.00")
        Build.objects.create(name="New")

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
        build = Build.objects.create(name="Test build", selling_price=selling_price)
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
        build = Build.objects.create(name="X")
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
        build = Build.objects.create(name="X")
        writes = [
            lambda: Build.objects.create(name="Y", selling_price="-1.00"),
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


class DetailApiTests(KeyedApiTestCase):
    def setUp(self):
        self.build = Build.objects.create(name="Spec example", selling_price="50000.00")
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
        build = Build.objects.create(name="Unpriced")

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
        for i in range(5):
            b = Build.objects.create(name=f"B{i}")
            b.parts.create(
                name="P", category="ram", listed_price="1.00", bought_for="1.00"
            )
            b.extra_costs.create(label="C", amount="1.00")

        with self.assertNumQueries(3):  # builds, parts, extra costs
            self.client.get("/api/builds/")
        with self.assertNumQueries(3):
            self.client.get(f"/api/builds/{self.build.id}/")

    def test_deleting_a_build_via_api_deletes_its_children(self):
        res = self.client.delete(f"/api/builds/{self.build.id}/")

        self.assertEqual(res.status_code, 204)
        self.assertEqual(Part.objects.count(), 0)
        self.assertEqual(ExtraCost.objects.count(), 0)


class ChildApiTests(KeyedApiTestCase):
    def setUp(self):
        self.build = Build.objects.create(name="B")

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
        other = Build.objects.create(name="Other")
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


class AccessKeyTests(APITestCase):
    def setUp(self):
        self.build = Build.objects.create(name="B")

    def write(self, key=None):
        headers = {} if key is None else {"HTTP_X_ACCESS_KEY": key}
        return self.client.patch(
            f"/api/builds/{self.build.id}/", {"name": "X"}, format="json", **headers
        )

    @override_settings(ACCESS_KEY=KEY)
    def test_writes_need_the_right_key(self):
        self.assertEqual(self.write().status_code, 403)
        self.assertEqual(self.write("wrong").status_code, 403)
        self.assertEqual(self.write("wrongé").status_code, 403)
        self.assertEqual(
            self.client.post(
                "/api/parts/", {"build": self.build.id}, format="json"
            ).status_code,
            403,
        )
        self.assertEqual(
            self.client.delete(f"/api/builds/{self.build.id}/").status_code, 403
        )
        self.assertEqual(Build.objects.get().name, "B")

        self.assertEqual(self.write(KEY).status_code, 200)
        self.assertEqual(Build.objects.get().name, "X")

    @override_settings(ACCESS_KEY=KEY)
    def test_reads_need_no_key(self):
        for url in ("/api/builds/", f"/api/builds/{self.build.id}/", "/api/parts/"):
            self.assertEqual(self.client.get(url).status_code, 200)

    @override_settings(ACCESS_KEY="")
    def test_no_key_on_the_server_refuses_every_write(self):
        self.assertEqual(self.write().status_code, 403)
        self.assertEqual(self.write("").status_code, 403)

    @override_settings(ACCESS_KEY=KEY, CORS_ALLOWED_ORIGINS=["https://example.com"])
    def test_cors_preflight_allows_the_key_header(self):
        res = self.client.options(
            f"/api/builds/{self.build.id}/",
            HTTP_ORIGIN="https://example.com",
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="PATCH",
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS="x-access-key",
        )
        self.assertIn("x-access-key", res["Access-Control-Allow-Headers"])


class ApiDocsTests(KeyedApiTestCase):
    def test_schema_is_valid_openapi_with_no_warnings(self):
        # Fails if a view or serializer change leaves the docs broken or ambiguous.
        call_command("spectacular", "--validate", "--fail-on-warn", stdout=StringIO())

    def test_docs_page_and_schema_are_served(self):
        self.assertEqual(self.client.get("/api/docs/").status_code, 200)
        self.assertEqual(self.client.get("/api/schema/").status_code, 200)

    def test_put_is_not_offered(self):
        build = Build.objects.create(name="B")

        res = self.client.put(f"/api/builds/{build.id}/", {"name": "X"}, format="json")

        self.assertEqual(res.status_code, 405)


class AdminTests(TestCase):
    def test_admin_pages_load_for_a_superuser(self):
        build = Build.objects.create(name="Admin build")
        Part.objects.create(
            build=build, name="Ryzen", category="cpu", listed_price=1, bought_for=1
        )
        ExtraCost.objects.create(build=build, label="Gas", amount=1)
        self.client.force_login(User.objects.create_superuser("admin", password="x"))

        for url in [
            "/admin/builds/build/",
            f"/admin/builds/build/{build.id}/change/",
            "/admin/builds/part/",
            "/admin/builds/extracost/",
        ]:
            self.assertEqual(self.client.get(url).status_code, 200, url)

    def test_admin_requires_login(self):
        self.assertEqual(self.client.get("/admin/builds/build/").status_code, 302)
