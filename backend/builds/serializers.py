from rest_framework import serializers

from .models import Build, ExtraCost, Part


def money(source: str | None = None) -> serializers.DecimalField:
    return serializers.DecimalField(
        max_digits=None, decimal_places=2, read_only=True, source=source
    )


class TotalsSerializer(serializers.Serializer):
    """Read-only view of the Build totals properties. None stays null in JSON."""

    listed_total = money()
    parts_cost = money()
    extra_costs = money("extra_costs_total")
    total_cost = money()
    profit = money()
    profit_margin = money()
    below_market = money()
    below_market_pct = money()
    voucher_savings = money()


class PartSerializer(serializers.ModelSerializer):
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


class ExtraCostSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExtraCost
        fields = ["id", "build", "label", "amount"]


class BuildSerializer(serializers.ModelSerializer):
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


class BuildDetailSerializer(BuildSerializer):
    parts = PartSerializer(many=True, read_only=True)
    extra_costs = ExtraCostSerializer(many=True, read_only=True)

    class Meta(BuildSerializer.Meta):
        fields = [*BuildSerializer.Meta.fields, "parts", "extra_costs"]
