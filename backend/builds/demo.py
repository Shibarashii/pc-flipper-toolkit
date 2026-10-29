"""Demo accounts: a throwaway user with two sample builds, gone after 24 hours.

A demo user is an ordinary user named `demo-…` with no usable password (SPEC: Demo
accounts). Cleanup needs both, so a real account can't be caught.
"""

from datetime import timedelta
from decimal import Decimal as D

from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import UNUSABLE_PASSWORD_PREFIX
from django.db import transaction
from django.utils import timezone
from django.utils.crypto import get_random_string

from .models import Build, Bundle, ExtraCost, Part

User = get_user_model()

PREFIX = "demo-"
LIFETIME = timedelta(hours=24)


def is_expired_demo(user) -> bool:
    return (
        user.username.startswith(PREFIX)
        and not user.has_usable_password()
        and user.date_joined < timezone.now() - LIFETIME
    )


def delete_expired_demos() -> None:
    User.objects.filter(
        username__startswith=PREFIX,
        password__startswith=UNUSABLE_PASSWORD_PREFIX,
        date_joined__lt=timezone.now() - LIFETIME,
    ).delete()


# (name, category, shop, listed price, bought for); None = not known, inside a bundle.
IN_PROGRESS_PARTS = [
    ("Intel Core i5-12400F", "cpu", "Shopee", "7000", "6200"),
    ("RTX 3060 12GB", "gpu", "Facebook Marketplace", "15000", "13500"),
    ("16GB DDR4 3200 (2×8GB)", "ram", "Lazada", "2000", "1600"),
]
BUNDLE_PARTS = [
    ("Ryzen 5 5600", "cpu", "", "6500", None),
    ("MSI B550M Pro-VDH", "motherboard", "", "5500", "4000"),
    ("16GB DDR4 3200", "ram", "", "2200", None),
]
SOLD_PARTS = [
    ("RX 6600 8GB", "gpu", "Shopee", "13000", "11000"),
    ("1TB NVMe SSD", "storage", "Lazada", "3200", "2600"),
    ("650W 80+ Bronze", "psu", "PC Express", "3000", "2400"),
    ("Tecware Nexus Air", "case", "PC Express", "2500", "1800"),
]


def add_parts(build: Build, parts, bundle: Bundle | None = None) -> None:
    Part.objects.bulk_create(
        Part(
            build=build,
            bundle=bundle,
            name=n,
            category=c,
            shop=s,
            listed_price=D(lp),
            bought_for=None if bf is None else D(bf),
        )
        for n, c, s, lp, bf in parts
    )


@transaction.atomic
def create_demo_user():
    """A new demo user with the sample builds; expired demos are deleted first."""
    delete_expired_demos()
    # Shown in the header, so no look-alikes (l, o, 0, 1).
    user = User(
        username=PREFIX + get_random_string(12, "abcdefghijkmnpqrstuvwxyz23456789")
    )
    user.set_unusable_password()
    user.save()

    # Created first, so the sold flip lists on top (newest first).
    building = Build.objects.create(
        owner=user, name="i5-12400F + RTX 3060", status=Build.Status.BUILDING
    )
    add_parts(building, IN_PROGRESS_PARTS)

    sold = Build.objects.create(
        owner=user,
        name="Ryzen 5 5600 + RX 6600",
        status=Build.Status.SOLD,
        selling_price=D(32000),
        sold_at=timezone.localdate() - timedelta(days=3),
        notes="Buyer from Quezon City, paid by GCash. Asked for the box of the GPU.",
    )
    bundle = Bundle.objects.create(
        build=sold,
        name="Board + CPU + RAM",
        shop="Facebook Marketplace",
        bought_for=D(9500),
    )
    add_parts(sold, BUNDLE_PARTS, bundle)
    add_parts(sold, SOLD_PARTS)
    ExtraCost.objects.bulk_create(
        [
            ExtraCost(build=sold, label="Shipping", amount=D(350)),
            ExtraCost(build=sold, label="Thermal paste", amount=D(150)),
        ]
    )
    return user
