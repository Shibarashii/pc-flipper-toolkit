from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

ZERO = Decimal("0.00")
CENT = Decimal("0.01")


def money_field(**kwargs) -> models.DecimalField:
    return models.DecimalField(
        max_digits=10, decimal_places=2, validators=[MinValueValidator(0)], **kwargs
    )


def non_negative(*fields: str) -> list[models.CheckConstraint]:
    """DB-level >= 0 checks, so bad money can't sneak in around the validators."""
    return [
        models.CheckConstraint(
            condition=models.Q(**{f"{f}__gte": 0}), name=f"%(class)s_{f}_gte_0"
        )
        for f in fields
    ]


def percent(part: Decimal, whole: Decimal) -> Decimal | None:
    """part / whole as a percentage rounded half-up to 2 places; None if whole is 0."""
    if not whole:
        return None
    return (part / whole * 100).quantize(CENT, rounding=ROUND_HALF_UP)


class Build(models.Model):
    class Status(models.TextChoices):
        PLANNING = "planning"
        BUILDING = "building"
        LISTED = "listed"
        SOLD = "sold"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="builds"
    )
    name = models.CharField(max_length=200)
    status = models.CharField(max_length=10, choices=Status, default=Status.PLANNING)
    selling_price = money_field(null=True, blank=True)
    sold_at = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = non_negative("selling_price")

    def __str__(self) -> str:
        return self.name

    # Totals. Callers must prefetch_related("parts", "bundles", "extra_costs"), even
    # for a single build: each total re-reads them, which is 14 queries without it.

    @property
    def listed_total(self) -> Decimal:
        return sum((p.listed_price for p in self.parts.all()), ZERO)

    @property
    def parts_cost(self) -> Decimal:
        # A bundled part's own bought-for is only a breakdown; its bundle's price counts.
        loose = (p.bought_for for p in self.parts.all() if p.bundle_id is None)
        bundles = (b.bought_for for b in self.bundles.all())
        return sum(loose, ZERO) + sum(bundles, ZERO)

    @property
    def extra_costs_total(self) -> Decimal:
        return sum((c.amount for c in self.extra_costs.all()), ZERO)

    @property
    def total_cost(self) -> Decimal:
        return self.parts_cost + self.extra_costs_total

    @property
    def voucher_savings(self) -> Decimal:
        return self.listed_total - self.parts_cost

    @property
    def profit(self) -> Decimal | None:
        if self.selling_price is None:
            return None
        return self.selling_price - self.total_cost

    @property
    def profit_margin(self) -> Decimal | None:
        profit = self.profit
        return None if profit is None else percent(profit, self.selling_price)

    @property
    def below_market(self) -> Decimal | None:
        if self.selling_price is None:
            return None
        return self.listed_total - self.selling_price

    @property
    def below_market_pct(self) -> Decimal | None:
        below = self.below_market
        return None if below is None else percent(below, self.listed_total)


class Bundle(models.Model):
    """Parts bought together for one price, e.g. a motherboard + CPU + RAM deal."""

    build = models.ForeignKey(Build, on_delete=models.CASCADE, related_name="bundles")
    name = models.CharField(max_length=200)
    shop = models.CharField(max_length=200, blank=True)
    bought_for = money_field()

    class Meta:
        ordering = ["id"]
        constraints = non_negative("bought_for")

    def __str__(self) -> str:
        return self.name

    @property
    def listed_total(self) -> Decimal:
        return sum((p.listed_price for p in self.parts.all()), ZERO)

    def assigned(self, leaving_out: "Part | None" = None) -> Decimal:
        """Its parts' typed bought-for amounts, added up (optionally without one part)."""
        return sum(
            (
                p.bought_for
                for p in self.parts.all()
                if p.bought_for is not None and p != leaving_out
            ),
            ZERO,
        )

    @property
    def unassigned(self) -> Decimal:
        return self.bought_for - self.assigned()


class Part(models.Model):
    class Category(models.TextChoices):
        CPU = "cpu", "CPU"
        GPU = "gpu", "GPU"
        MOTHERBOARD = "motherboard"
        RAM = "ram", "RAM"
        STORAGE = "storage"
        PSU = "psu", "PSU"
        CASE = "case"
        COOLER = "cooler"
        OTHER = "other"

    build = models.ForeignKey(Build, on_delete=models.CASCADE, related_name="parts")
    name = models.CharField(max_length=200)
    category = models.CharField(max_length=12, choices=Category)
    shop = models.CharField(max_length=200, blank=True)
    listed_price = money_field()
    # Blank only inside a bundle, where it's an optional breakdown of the bundle's price.
    bought_for = money_field(null=True, blank=True)
    bundle = models.ForeignKey(
        Bundle, on_delete=models.CASCADE, null=True, blank=True, related_name="parts"
    )

    class Meta:
        ordering = ["id"]
        constraints = [
            *non_negative("listed_price", "bought_for"),
            models.CheckConstraint(
                condition=models.Q(bundle__isnull=False)
                | models.Q(bought_for__isnull=False),
                name="part_bought_for_unless_bundled",
            ),
        ]

    def __str__(self) -> str:
        return self.name


class ExtraCost(models.Model):
    build = models.ForeignKey(
        Build, on_delete=models.CASCADE, related_name="extra_costs"
    )
    label = models.CharField(max_length=200)
    amount = money_field()

    class Meta:
        ordering = ["id"]
        constraints = non_negative("amount")

    def __str__(self) -> str:
        return self.label


class ShopProduct(models.Model):
    """One product from a shop's public catalogue, kept for the price lookup.

    Each shop's rows are replaced together by `manage.py refresh_shop_prices`
    (docs/specs/price-lookup.md), so they all share one `updated_at`.
    """

    shop = models.CharField(max_length=50)
    title = models.TextField()
    url = models.TextField()
    price = money_field()  # the cheapest variant's
    in_stock = models.BooleanField()
    updated_at = models.DateTimeField()

    class Meta:
        ordering = ["shop", "title"]
        constraints = [
            *non_negative("price"),
            models.UniqueConstraint(
                fields=["shop", "url"], name="shopproduct_unique_url"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.shop}: {self.title}"
