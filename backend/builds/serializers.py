from django.db import models
from rest_framework import serializers

from .models import Build, ExtraCost, Part


def money(help_text: str, source: str | None = None, nullable: bool = False):
    return serializers.DecimalField(
        max_digits=None,
        decimal_places=2,
        read_only=True,
        source=source,
        allow_null=nullable,
        help_text=help_text,
    )


class TotalsSerializer(serializers.Serializer):
    """Money totals for a build, computed by the server. Read-only."""

    listed_total = money("Sum of the parts' listed (market) prices.")
    parts_cost = money("Sum of what was actually paid for the parts.")
    extra_costs = money("Sum of the extra costs.", source="extra_costs_total")
    total_cost = money("`parts_cost` + `extra_costs`.")
    profit = money(
        "`selling_price` − `total_cost`. Negative is a loss. "
        "`null` until a selling price is set.",
        nullable=True,
    )
    profit_margin = money(
        "`profit` as a % of `selling_price`, rounded half-up to 2 places. "
        "`null` without a selling price, or when it is 0.",
        nullable=True,
    )
    below_market = money(
        "`listed_total` − `selling_price`: how far under market the PC is priced. "
        "Negative means above market. `null` until a selling price is set.",
        nullable=True,
    )
    below_market_pct = money(
        "`below_market` as a % of `listed_total`, rounded half-up to 2 places. "
        "`null` without a selling price, or when `listed_total` is 0.",
        nullable=True,
    )
    voucher_savings = money(
        "`listed_total` − `parts_cost`: saved by vouchers and sales."
    )


MONEY_INPUT = "Decimal string in PHP, ≥ 0, up to 2 decimal places."


class MoneyField(serializers.DecimalField):
    # DRF turns the models' MinValueValidator(0) into its own min_value check,
    # so the plain-language message has to live here.
    default_error_messages = {
        **serializers.DecimalField.default_error_messages,
        "min_value": "Must be 0 or more.",
    }


class ModelSerializer(serializers.ModelSerializer):
    """ModelSerializer whose decimal (money) fields use MoneyField."""

    serializer_field_mapping = {
        **serializers.ModelSerializer.serializer_field_mapping,
        models.DecimalField: MoneyField,
    }


class PartSerializer(ModelSerializer):
    class Meta:
        model = Part
        fields = [
            "id",
            "build",
            "name",
            "category",
            "shop",
            "listed_price",
            "bought_for",
        ]
        extra_kwargs = {
            "build": {"help_text": "ID of the build this part belongs to."},
            "name": {"help_text": 'Part name, e.g. "Ryzen 5 7600".'},
            "shop": {"help_text": 'Where it was bought, e.g. "Shopee - DynaQuest".'},
            "listed_price": {"help_text": f"Market price. {MONEY_INPUT}"},
            "bought_for": {
                "help_text": f"What was actually paid, after vouchers. {MONEY_INPUT}"
            },
        }


class ExtraCostSerializer(ModelSerializer):
    class Meta:
        model = ExtraCost
        fields = ["id", "build", "label", "amount"]
        extra_kwargs = {
            "build": {"help_text": "ID of the build this cost belongs to."},
            "label": {"help_text": 'What it was for, e.g. "Shipping".'},
            "amount": {"help_text": MONEY_INPUT},
        }


class BuildSerializer(ModelSerializer):
    totals = TotalsSerializer(source="*", read_only=True)

    class Meta:
        model = Build
        fields = [
            "id",
            "name",
            "status",
            "selling_price",
            "sold_at",
            "notes",
            "created_at",
            "totals",
        ]
        extra_kwargs = {
            "name": {"help_text": 'Display name, e.g. "Ryzen 5 7600 + RTX 4060".'},
            "selling_price": {
                "help_text": f"Price the PC is (or was) sold for. {MONEY_INPUT} "
                "`null` if not priced yet."
            },
            "sold_at": {"help_text": "Date sold (YYYY-MM-DD). `null` unless sold."},
        }


class BuildDetailSerializer(BuildSerializer):
    parts = PartSerializer(many=True, read_only=True)
    extra_costs = ExtraCostSerializer(many=True, read_only=True)

    class Meta(BuildSerializer.Meta):
        fields = [*BuildSerializer.Meta.fields, "parts", "extra_costs"]
