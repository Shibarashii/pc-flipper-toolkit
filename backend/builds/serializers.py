from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import models
from rest_framework import serializers

from .models import Build, Bundle, ExtraCost, Part, ShopProduct
from .prices import shorten


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
    parts_cost = money(
        "What was actually paid for the parts: loose parts' `bought_for` plus each "
        "bundle's `bought_for` (bundled parts' own amounts don't count)."
    )
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


class SoldSummarySerializer(serializers.Serializer):
    profit = money(
        "Sum of the sold builds' `profit`. Negative is a loss. A sold build with no "
        "selling price adds nothing."
    )
    sold = serializers.IntegerField(read_only=True, help_text="How many builds sold.")


class TiedUpSerializer(serializers.Serializer):
    cost = money("Sum of the unsold builds' `total_cost`.")
    builds = serializers.IntegerField(
        read_only=True, help_text="How many unsold builds have money in them."
    )


class BuildsSummarySerializer(serializers.Serializer):
    """The builds list's summary line (docs/specs/builds-summary.md). Read-only."""

    this_month = SoldSummarySerializer(
        read_only=True,
        help_text="Sold builds whose `sold_at` is in this calendar month, Manila time.",
    )
    all_time = SoldSummarySerializer(
        read_only=True, help_text="Every sold build, with or without a `sold_at`."
    )
    tied_up = TiedUpSerializer(
        read_only=True,
        help_text="Builds not sold yet whose `total_cost` is above 0.",
    )


class MoneyField(serializers.DecimalField):
    # DRF turns the models' MinValueValidator(0) into its own min_value check,
    # so the plain-language message has to live here.
    default_error_messages = {
        **serializers.DecimalField.default_error_messages,
        "min_value": "Must be 0 or more.",
    }


class PublicIdField(serializers.SlugRelatedField):
    """Another record, by its public UUID (docs/specs/public-ids.md)."""

    default_error_messages = {
        "does_not_exist": "No such record: {value}.",
        "invalid": "Must be a UUID.",
    }

    def __init__(self, **kwargs):
        super().__init__(slug_field="public_id", **kwargs)

    def to_internal_value(self, data):
        # Django rejects a malformed UUID with its own ValidationError, which DRF's
        # field doesn't catch: without this, "nope" is a 500 instead of a 400.
        try:
            return super().to_internal_value(data)
        except DjangoValidationError:
            self.fail("invalid")


class ModelSerializer(serializers.ModelSerializer):
    """ModelSerializer whose decimal (money) fields use MoneyField, and whose `id` is
    the record's public UUID: the integer id never leaves the database."""

    id = serializers.UUIDField(
        source="public_id", read_only=True, help_text="A random UUID."
    )

    serializer_field_mapping = {
        **serializers.ModelSerializer.serializer_field_mapping,
        models.DecimalField: MoneyField,
    }


def peso(amount) -> str:
    return f"₱{amount:,.2f}"


class ChildSerializer(ModelSerializer):
    """A part, bundle or extra cost: it goes in one of the user's own builds, and stays there."""

    build = PublicIdField(
        queryset=Build.objects.all(), help_text="`id` of the build it belongs to."
    )

    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get("request")
        # Another user's build (or bundle) is "no such record", as if it weren't
        # there. (No user while the API docs are generated.)
        if request and request.user.is_authenticated:
            fields["build"].queryset = Build.objects.filter(owner=request.user)
            if "bundle" in fields:
                fields["bundle"].queryset = Bundle.objects.filter(
                    build__owner=request.user
                )
        return fields

    def validate_build(self, build):
        if self.instance is not None and build != self.instance.build:
            raise serializers.ValidationError("Can't be moved to another build.")
        return build


class PartSerializer(ChildSerializer):
    bundle = PublicIdField(
        queryset=Bundle.objects.all(),
        allow_null=True,
        required=False,
        help_text="`id` of the bundle it was bought in (same build), or `null`.",
    )

    class Meta:
        model = Part
        fields = [
            "id",
            "build",
            "bundle",
            "name",
            "category",
            "shop",
            "condition",
            "listed_price",
            "bought_for",
        ]
        extra_kwargs = {
            "name": {"help_text": 'Part name, e.g. "Ryzen 5 7600".'},
            "condition": {
                "help_text": "`new`, `like_new`, `good` or `fair` (Facebook "
                "Marketplace's New, Used – Like New, Used – Good, Used – Fair); "
                '`""` when not set.'
            },
            "shop": {"help_text": 'Where it was bought, e.g. "Shopee - DynaQuest".'},
            "listed_price": {"help_text": f"Market price. {MONEY_INPUT}"},
            "bought_for": {
                "help_text": f"What was actually paid, after vouchers. {MONEY_INPUT} "
                "Required unless the part is in a bundle, where it's an optional "
                "breakdown of the bundle's price."
            },
        }

    def validate(self, attrs):
        def value(field):
            return (
                attrs[field] if field in attrs else getattr(self.instance, field, None)
            )

        bundle, bought_for = value("bundle"), value("bought_for")
        if bundle is None:
            if bought_for is None:
                raise serializers.ValidationError(
                    {"bought_for": "Required for a part that isn't in a bundle."}
                )
        elif bundle.build != value("build"):
            raise serializers.ValidationError(
                {"bundle": "Must be a bundle in the same build."}
            )
        # ponytail: no row lock, so two edits at the same moment could both pass.
        elif (
            bought_for is not None
            and bundle.assigned(leaving_out=self.instance) + bought_for
            > bundle.bought_for
        ):
            raise serializers.ValidationError(
                {
                    "bought_for": "Bundled parts can't add up to more than the "
                    f"bundle's {peso(bundle.bought_for)}."
                }
            )
        return attrs


class BundleSerializer(ChildSerializer):
    listed_total = money("Sum of its parts' listed prices.")
    unassigned = money(
        "`bought_for` minus its parts' typed `bought_for` amounts: the part of the "
        "price not yet split between them."
    )

    class Meta:
        model = Bundle
        fields = [
            "id",
            "build",
            "name",
            "shop",
            "bought_for",
            "listed_total",
            "unassigned",
        ]
        extra_kwargs = {
            "name": {"help_text": 'What it was sold as, e.g. "B550m + R5 5600".'},
            "shop": {"help_text": "Where it was bought."},
            "bought_for": {
                "help_text": f"The one price paid for everything in it. {MONEY_INPUT}"
            },
        }

    def validate_bought_for(self, price):
        assigned = self.instance.assigned() if self.instance else 0
        if price < assigned:
            raise serializers.ValidationError(
                f"Its parts' bought-for amounts already add up to {peso(assigned)}."
            )
        return price


class ExtraCostSerializer(ChildSerializer):
    class Meta:
        model = ExtraCost
        fields = ["id", "build", "label", "amount"]
        extra_kwargs = {
            "label": {"help_text": 'What it was for, e.g. "Shipping".'},
            "amount": {"help_text": MONEY_INPUT},
        }


NOTES_MAX = 10_000


class BuildSerializer(ModelSerializer):
    totals = TotalsSerializer(source="*", read_only=True)
    number = serializers.SerializerMethodField(
        help_text="1 for the user's oldest build, then 2, 3… Deleting one renumbers "
        "the later ones. Use it in the UI; `id` is a random UUID."
    )

    class Meta:
        model = Build
        fields = [
            "id",
            "number",
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
            # A cap on what one request can store; the column itself stays unbounded.
            "notes": {"max_length": NOTES_MAX},
        }

    def get_number(self, build) -> int:
        # The view annotates it; a build just created hasn't been through that query.
        if hasattr(build, "number"):
            return build.number
        return Build.objects.filter(owner_id=build.owner_id, id__lte=build.id).count()

    def validate(self, attrs):
        # Only when one of them changes, so older data never blocks an unrelated edit.
        if "status" in attrs or "sold_at" in attrs:
            status = attrs.get("status", getattr(self.instance, "status", None))
            sold_at = attrs.get("sold_at", getattr(self.instance, "sold_at", None))
            if sold_at is not None and status != Build.Status.SOLD:
                raise serializers.ValidationError(
                    {"sold_at": "Only a sold build has a sold date."}
                )
        return attrs


class BuildDetailSerializer(BuildSerializer):
    parts = PartSerializer(many=True, read_only=True)
    bundles = BundleSerializer(many=True, read_only=True)
    extra_costs = ExtraCostSerializer(many=True, read_only=True)

    class Meta(BuildSerializer.Meta):
        fields = [*BuildSerializer.Meta.fields, "parts", "bundles", "extra_costs"]


class PriceQuerySerializer(serializers.Serializer):
    q = serializers.CharField(
        min_length=2,
        max_length=100,
        help_text='What to look for, e.g. "rtx 3060". Every word must be in the '
        "product's name, in any order and case.",
    )


class ShopProductSerializer(serializers.ModelSerializer):
    price = money("The shop's price (its cheapest variant).")
    short_title = serializers.SerializerMethodField(
        help_text='A short part name from the title, e.g. "Palit RTX 3060 Dual 12gb". '
        "Fills a part's `name`."
    )

    class Meta:
        model = ShopProduct
        fields = ["shop", "title", "short_title", "url", "price", "in_stock"]
        extra_kwargs = {
            "shop": {"help_text": 'e.g. "EasyPC". Fills a part\'s `shop`.'},
            "title": {"help_text": "The product's name at the shop."},
            "url": {"help_text": "The product's page at the shop."},
            "in_stock": {"help_text": "Whether the shop lists it as available."},
        }

    def get_short_title(self, product) -> str:
        return shorten(product.title)


class PriceSearchSerializer(serializers.Serializer):
    results = ShopProductSerializer(many=True, read_only=True)
    updated_at = serializers.DateTimeField(
        read_only=True,
        allow_null=True,
        help_text="When the oldest shop's prices were fetched; `null` before the "
        "first refresh.",
    )
