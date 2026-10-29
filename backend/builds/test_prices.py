"""Price lookup tests (docs/specs/price-lookup.md). No test touches a real shop."""

import json
from datetime import datetime, timedelta
from decimal import Decimal as D
from io import BytesIO, StringIO
from unittest import mock
from urllib.error import URLError
from urllib.parse import parse_qs, urlsplit

from django.core.management import CommandError, call_command
from django.db import DatabaseError
from django.test import TestCase
from django.utils import timezone

from . import prices
from .models import ShopProduct
from .tests import LoggedInApiTestCase


def product(handle: str, *variants: tuple[str, bool], title: str = "") -> dict:
    """A product as Shopify's /products.json lists it: variants are (price, available)."""
    return {
        "title": title or handle,
        "handle": handle,
        "body_html": "<p>Dropped: we only keep title, link, price and stock.</p>",
        "variants": [{"price": p, "available": a} for p, a in variants],
    }


class FakeShops:
    """Stands in for urlopen: serves each shop's pages and records every request.

    `pages[base]` is the list of pages (lists of products); later pages are empty.
    A page that is an Exception is raised instead.
    """

    def __init__(self, pages: dict[str, list]):
        self.pages = pages
        self.requests = []

    def __call__(self, req, timeout):
        self.requests.append(req)
        url = urlsplit(req.full_url)
        page = int(parse_qs(url.query)["page"][0])
        shop_pages = self.pages[f"{url.scheme}://{url.netloc}"]
        body = shop_pages[page - 1] if page <= len(shop_pages) else []
        if isinstance(body, Exception):
            raise body
        return BytesIO(json.dumps({"products": body}).encode())


EASYPC = prices.SHOPS["EasyPC"]
PCX = prices.SHOPS["PC Express"]


@mock.patch("builds.prices.time.sleep")
class RefreshShopPricesTests(TestCase):
    def refresh(self, pages, *args):
        """Run the command against fake shops; returns (fake, stdout, stderr)."""
        fake = FakeShops(pages)
        out, err = StringIO(), StringIO()
        with mock.patch("builds.prices.urlopen", fake):
            call_command("refresh_shop_prices", *args, stdout=out, stderr=err)
        return fake, out.getvalue(), err.getvalue()

    def old_copy(self, shop="EasyPC"):
        return ShopProduct.objects.create(
            shop=shop,
            title="Old",
            url="x",
            price=1,
            in_stock=True,
            updated_at=timezone.now() - timedelta(days=1),
        )

    def test_keeps_the_cheapest_variant_and_any_stock_but_no_free_items(self, sleep):
        self.refresh(
            {
                EASYPC: [
                    [
                        product("rtx-3060", ("15999.00", False), ("14500.50", False)),
                        product("ryzen-5600", ("6500.00", False), ("6800.00", True)),
                        product("no-variants"),
                        product("discontinued", ("0.00", False)),
                    ]
                ],
                PCX: [[product("case", ("2500.00", True))]],
            }
        )

        rows = {p.url: p for p in ShopProduct.objects.filter(shop="EasyPC")}
        self.assertEqual(
            set(rows), {f"{EASYPC}/products/rtx-3060", f"{EASYPC}/products/ryzen-5600"}
        )
        gpu = rows[f"{EASYPC}/products/rtx-3060"]
        self.assertEqual(gpu.price, D("14500.50"))
        self.assertIsInstance(gpu.price, D)
        self.assertFalse(gpu.in_stock)
        self.assertTrue(rows[f"{EASYPC}/products/ryzen-5600"].in_stock)
        self.assertEqual(ShopProduct.objects.get(shop="PC Express").title, "case")

    def test_pages_until_an_empty_page_politely(self, sleep):
        fake, out, _ = self.refresh(
            {
                EASYPC: [
                    [product("a", ("1.00", True))],
                    [product("b", ("2.00", True))],
                ],
                PCX: [[product("c", ("3.00", True))]],
            }
        )

        self.assertEqual(ShopProduct.objects.filter(shop="EasyPC").count(), 2)
        self.assertIn("EasyPC: 2 products", out)
        self.assertEqual(
            [r.full_url for r in fake.requests],
            [
                f"{EASYPC}/products.json?limit=250&page=1",
                f"{EASYPC}/products.json?limit=250&page=2",
                f"{EASYPC}/products.json?limit=250&page=3",
                f"{PCX}/products.json?limit=250&page=1",
                f"{PCX}/products.json?limit=250&page=2",
            ],
        )
        self.assertTrue(
            all(r.get_header("User-agent") == prices.USER_AGENT for r in fake.requests)
        )
        # A pause before every request but each shop's first.
        self.assertEqual(sleep.call_count, 3)

    def test_replaces_the_shops_copy_with_one_refresh_time(self, sleep):
        self.old_copy()
        pcx_row = self.old_copy("PC Express")

        self.refresh(
            {EASYPC: [[product("a", ("1.00", True)), product("b", ("2.00", True))]]},
            "--shop",
            "EasyPC",
        )

        easypc = ShopProduct.objects.filter(shop="EasyPC")
        self.assertEqual(sorted(p.title for p in easypc), ["a", "b"])
        self.assertEqual(len({p.updated_at for p in easypc}), 1)
        self.assertGreater(easypc[0].updated_at, pcx_row.updated_at)
        # --shop leaves the other shop alone.
        self.assertTrue(ShopProduct.objects.filter(pk=pcx_row.pk).exists())

    def test_a_product_repeated_across_pages_is_kept_once(self, sleep):
        self.refresh(
            {
                EASYPC: [
                    [product("a", ("1.00", True))],
                    [product("a", ("1.00", True)), product("b", ("2.00", True))],
                ]
            },
            "--shop",
            "EasyPC",
        )
        self.assertEqual(ShopProduct.objects.filter(shop="EasyPC").count(), 2)

    def test_a_failed_page_keeps_the_old_copy_and_still_refreshes_the_other(
        self, sleep
    ):
        old = self.old_copy()
        fake = FakeShops(
            {
                EASYPC: [[product("a", ("1.00", True))], URLError("timed out")],
                PCX: [[product("c", ("3.00", True))]],
            }
        )
        err = StringIO()

        with (
            mock.patch("builds.prices.urlopen", fake),
            self.assertRaisesMessage(CommandError, "Refresh failed for EasyPC"),
        ):
            call_command("refresh_shop_prices", stdout=StringIO(), stderr=err)

        self.assertEqual(list(ShopProduct.objects.filter(shop="EasyPC")), [old])
        self.assertIn("EasyPC: failed, kept the previous copy", err.getvalue())
        self.assertEqual(ShopProduct.objects.get(shop="PC Express").title, "c")

    def test_no_products_counts_as_a_failure(self, sleep):
        old = self.old_copy()
        with (
            mock.patch("builds.prices.urlopen", FakeShops({EASYPC: []})),
            self.assertRaises(CommandError),
        ):
            call_command("refresh_shop_prices", "--shop", "EasyPC", stderr=StringIO())
        self.assertEqual(list(ShopProduct.objects.all()), [old])

    def test_an_odd_product_is_skipped_not_the_whole_shop(self, sleep):
        odd = [
            {"title": "No price", "handle": "a", "variants": [{"price": "?"}]},
            product("nan", ("NaN", True)),
            product("negative", ("-5.00", True)),
            product("infinite", ("Infinity", True)),
            product("too-big", ("100000000.00", True)),
            {"title": "No handle", "variants": [{"price": "1.00", "available": True}]},
            {"handle": "no-title", "variants": [{"price": "1.00", "available": True}]},
            {"title": "No stock field", "handle": "b", "variants": [{"price": "1.00"}]},
        ]
        _, out, _ = self.refresh(
            {EASYPC: [[*odd, product("fine", ("1999.00", True))]]}, "--shop", "EasyPC"
        )
        self.assertIn("EasyPC: 1 products", out)
        self.assertEqual(ShopProduct.objects.get().title, "fine")

    def test_only_odd_products_counts_as_no_products(self, sleep):
        old = self.old_copy()
        odd = {"title": "No price", "handle": "x", "variants": [{"price": "?"}]}
        with (
            mock.patch("builds.prices.urlopen", FakeShops({EASYPC: [[odd]]})),
            self.assertRaises(CommandError),
        ):
            call_command("refresh_shop_prices", "--shop", "EasyPC", stderr=StringIO())
        self.assertEqual(list(ShopProduct.objects.all()), [old])

    def test_a_database_error_rolls_back_and_is_reported_by_type_only(self, sleep):
        old = self.old_copy()
        err = StringIO()
        leak = DatabaseError('connection to server at "ep-x.neon.tech" failed')
        with (
            mock.patch(
                "builds.prices.urlopen",
                FakeShops({EASYPC: [[product("a", ("1.00", True))]]}),
            ),
            mock.patch.object(ShopProduct.objects, "bulk_create", side_effect=leak),
            self.assertRaises(CommandError),
        ):
            call_command("refresh_shop_prices", "--shop", "EasyPC", stderr=err)

        self.assertEqual(list(ShopProduct.objects.all()), [old])  # the delete undone
        self.assertIn("kept the previous copy (DatabaseError)", err.getvalue())
        self.assertNotIn("neon.tech", err.getvalue())

    @mock.patch("builds.prices.MAX_PAGES", 3)
    def test_a_shop_that_never_ends_fails_after_max_pages(self, sleep):
        old = self.old_copy()
        endless = FakeShops(
            {EASYPC: [[product(f"p{n}", ("1.00", True))] for n in range(9)]}
        )
        with (
            mock.patch("builds.prices.urlopen", endless),
            self.assertRaisesMessage(CommandError, "Refresh failed for EasyPC"),
        ):
            call_command("refresh_shop_prices", "--shop", "EasyPC", stderr=StringIO())
        self.assertEqual(len(endless.requests), 3)
        self.assertEqual(list(ShopProduct.objects.all()), [old])


class UnmangleTests(TestCase):
    def test_drops_the_stray_a_before_a_symbol(self):
        self.assertEqual(
            prices.unmangle("IntelÂ® CoreÂ™ i5Â\xa0laptop 18.5Â” Â¿"),
            "Intel® Core™ i5\xa0laptop 18.5” ¿",  # ¿ is cp1252 BF, the top of the range
        )

    def test_leaves_everything_else_alone(self):
        # ÂÀ: À is cp1252 C0, just past the range, so a real "Â" before it stays.
        for title in ["Intel® Core™ i5", "ÂBC", "Â", "120Â\x8d wide", "ÂÂ", "ÂÀ"]:
            self.assertEqual(prices.unmangle(title), title)

    def test_refresh_stores_the_fixed_title(self):
        with (
            mock.patch("builds.prices.time.sleep"),
            mock.patch(
                "builds.prices.urlopen",
                FakeShops(
                    {EASYPC: [[product("gpu", ("1.00", True), title="RTXÂ™ 3060")]]}
                ),
            ),
        ):
            call_command("refresh_shop_prices", "--shop", "EasyPC", stdout=StringIO())
        self.assertEqual(ShopProduct.objects.get().title, "RTX™ 3060")


class PriceSearchTests(LoggedInApiTestCase):
    def shop_product(self, title, price="1000.00", in_stock=True, **fields):
        return ShopProduct.objects.create(
            **{
                "shop": "EasyPC",
                "title": title,
                "url": f"{EASYPC}/products/{title}",
                "price": price,
                "in_stock": in_stock,
                "updated_at": timezone.now(),
                **fields,
            }
        )

    def search(self, q):
        return self.client.get("/api/prices/", {"q": q})

    def titles(self, q):
        return [r["title"] for r in self.search(q).json()["results"]]

    def test_every_word_in_any_order_and_case(self):
        self.shop_product("MSI GeForce RTX™ 3060 Ventus 12GB")
        self.shop_product("ASUS Dual RTX 3060 Ti")
        self.shop_product("ASUS Dual RTX 4060")
        self.shop_product("Ryzen 5 5600 50% off")

        self.assertEqual(
            sorted(self.titles("  3060   rtx ")),
            ["ASUS Dual RTX 3060 Ti", "MSI GeForce RTX™ 3060 Ventus 12GB"],
        )
        self.assertEqual(self.titles("RYZEN"), ["Ryzen 5 5600 50% off"])
        # LIKE wildcards are matched literally.
        self.assertEqual(self.titles("5_%"), [])

    def test_in_stock_first_then_cheapest(self):
        self.shop_product("GPU cheap gone", "9000.00", in_stock=False)
        self.shop_product("GPU dear", "30000.00")
        self.shop_product("GPU cheap", "26000.00")

        self.assertEqual(
            self.titles("gpu"), ["GPU cheap", "GPU dear", "GPU cheap gone"]
        )

    def test_the_fields_and_at_most_20(self):
        for n in range(25):
            self.shop_product(f"SSD {n:02}", "2600.50")

        res = self.search("ssd")

        self.assertEqual(res.status_code, 200)
        results = res.json()["results"]
        self.assertEqual(len(results), 20)
        self.assertEqual(
            results[0],
            {
                "shop": "EasyPC",
                "title": "SSD 00",
                "url": f"{EASYPC}/products/SSD 00",
                "price": "2600.50",
                "in_stock": True,
            },
        )

    def test_updated_at_is_the_oldest_shops_refresh(self):
        self.assertEqual(self.search("ssd").json(), {"results": [], "updated_at": None})

        old = timezone.now() - timedelta(days=2)
        self.shop_product("SSD", shop="PC Express", updated_at=old)
        self.shop_product("SSD")

        updated = self.search("nothing like it").json()["updated_at"]
        self.assertEqual(datetime.fromisoformat(updated), old)

    def test_q_needs_two_characters(self):
        for params in [{"q": "a"}, {"q": "  a  "}, {"q": ""}, {}]:
            res = self.client.get("/api/prices/", params)
            self.assertEqual(res.status_code, 400, params)
            self.assertEqual(list(res.json()), ["q"], params)
        self.assertEqual(self.search("x" * 101).status_code, 400)

    def test_needs_a_login(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.search("ssd").status_code, 401)
