"""Prices from PC shops' public Shopify catalogues (docs/specs/price-lookup.md).

Only `/products.json` is fetched (both shops' robots.txt allow it; EasyPC's disallows
`/search`), one page at a time, with an honest user-agent. A search never calls a shop:
it reads the copy that `refresh` keeps in `ShopProduct`.
"""

import json
import time
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


class RefreshError(Exception):
    pass


def fetch_page(base: str, page: int) -> list[dict]:
    req = Request(
        f"{base}/products.json?limit={PAGE_SIZE}&page={page}",
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )
    with urlopen(req, timeout=TIMEOUT) as res:
        return json.load(res)["products"]


def parse(shop: str, base: str, product: dict, now) -> ShopProduct | None:
    """The fields we keep, or None when there's no price to suggest.

    That's a product with no variants, or one listed at ₱0 (on 2026-10-29, EasyPC had 48,
    all discontinued and out of stock).
    """
    variants = product["variants"]
    price = min((Decimal(v["price"]) for v in variants), default=Decimal(0))
    if not price:
        return None
    return ShopProduct(
        shop=shop,
        title=product["title"],
        url=f"{base}/products/{product['handle']}",
        price=price,
        in_stock=any(v["available"] for v in variants),
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
        ShopProduct.objects.bulk_create(rows)
    return len(rows)
