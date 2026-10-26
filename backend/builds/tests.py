from decimal import Decimal as D

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase
from rest_framework.test import APITestCase

from .models import Build, ExtraCost, Part


class BuildApiTests(APITestCase):
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
