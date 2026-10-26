from decimal import ROUND_HALF_UP, Decimal

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

    # Totals. Callers must prefetch_related("parts", "extra_costs"), even for a
    # single build: each total re-reads them, which is 14 queries without it.

    @property
    def listed_total(self) -> Decimal:
        return sum((p.listed_price for p in self.parts.all()), ZERO)

    @property
    def parts_cost(self) -> Decimal:
        return sum((p.bought_for for p in self.parts.all()), ZERO)

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
    bought_for = money_field()

    class Meta:
        ordering = ["id"]
        constraints = non_negative("listed_price", "bought_for")

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
