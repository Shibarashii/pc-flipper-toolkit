"""Prices from PC shops' public Shopify catalogues (docs/specs/price-lookup.md).

Only `/products.json` is fetched (both shops' robots.txt allow it; EasyPC's disallows
`/search`), one page at a time, with an honest user-agent. A search never calls a shop:
it reads the copy that `refresh` keeps in `ShopProduct`.
"""

import json
import re
import time
from datetime import datetime
from decimal import Decimal
from itertools import count
from urllib.request import Request, urlopen

from django.db import transaction
from django.utils import timezone

from .models import ShopProduct

SHOPS = {
    "EasyPC": "https://easypc.com.ph",
    "PC Express": "https://pcx.com.ph",
}
USER_AGENT = (
    "pc-flipper-toolkit/1.0 (+https://github.com/Shibarashii/pc-flipper-toolkit)"
)
PAGE_SIZE = 250  # Shopify's maximum
DELAY = 1  # seconds between requests
TIMEOUT = 30
MAX_PAGES = 200  # EasyPC has 30; stops a shop that never returns an empty page
MAX_PRICE = Decimal("99999999.99")  # what ShopProduct.price (decimal(10,2)) holds


class RefreshError(Exception):
    pass


def _cp1252_byte(char: str) -> int | None:
    try:
        return char.encode("cp1252")[0]
    except UnicodeEncodeError:
        return None


def unmangle(title: str) -> str:
    """Undo symbols that were UTF-8 read as Windows-1252, in the shop's own data.

    That turns each symbol's UTF-8 lead byte (C2) into an "Â" before it: "IntelÂ®" for
    "Intel®", "RadeonÂ™" for "Radeon™". On 2026-10-29, 375 EasyPC titles had it. The
    "Â" is dropped only before a symbol that byte could have led (cp1252 80–BF).
    """
    return re.sub(
        "Â(?=(.))",
        lambda m: "" if 0x80 <= (_cp1252_byte(m[1]) or 0) <= 0xBF else "Â",
        title,
    )


def fetch_page(base: str, page: int) -> list[dict]:
    req = Request(
        f"{base}/products.json?limit={PAGE_SIZE}&page={page}",
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )
    with urlopen(req, timeout=TIMEOUT) as res:
        return json.load(res)["products"]


def parse(shop: str, base: str, product: dict, now: datetime) -> ShopProduct | None:
    """The fields we keep, or None when there's no usable price to suggest.

    Skipped, so one odd product can't fail the whole shop: no variants, a missing field,
    a price that isn't a number above ₱0 that fits the column (`NaN`, `-5`, `Infinity`),
    and ₱0 itself (on 2026-10-29, EasyPC had 48 at ₱0, all discontinued).
    """
    try:
        variants = product["variants"]
        price = min(Decimal(v["price"]) for v in variants)
        in_stock = any(v["available"] for v in variants)
        title, handle = unmangle(product["title"]), product["handle"]
        usable = 0 < price <= MAX_PRICE and title and handle  # comparing NaN raises
    except (KeyError, TypeError, ValueError, ArithmeticError):
        return None
    if not usable:
        return None
    return ShopProduct(
        shop=shop,
        title=title,
        url=f"{base}/products/{handle}",
        price=price,
        in_stock=in_stock,
        updated_at=now,
    )


def fetch_catalogue(shop: str) -> list[ShopProduct]:
    base = SHOPS[shop]
    now = timezone.now()
    # By url: page-numbered results can shift (and repeat a product) if the shop
    # changes its catalogue mid-refresh.
    rows: dict[str, ShopProduct] = {}
    for page in count(1):
        if page > MAX_PAGES:
            raise RefreshError(f"more than {MAX_PAGES} pages")
        if page > 1:
            time.sleep(DELAY)
        products = fetch_page(base, page)
        if not products:
            break
        for product in products:
            if row := parse(shop, base, product, now):
                rows[row.url] = row
    return list(rows.values())


def refresh(shop: str) -> int:
    """Replace the shop's copy, only once every page has downloaded. Returns the count."""
    rows = fetch_catalogue(shop)
    if not rows:
        raise RefreshError("the shop returned no products")
    with transaction.atomic():
        ShopProduct.objects.filter(shop=shop).delete()
        ShopProduct.objects.bulk_create(rows, batch_size=1000)
    return len(rows)
