from django.db.models import Count, Min, OuterRef, Prefetch, Subquery
from django.utils import timezone
from drf_spectacular.utils import OpenApiExample, extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ZERO, Build, Bundle, ExtraCost, Part, ShopProduct
from .serializers import (
    BuildDetailSerializer,
    BuildSerializer,
    BuildsSummarySerializer,
    BundleSerializer,
    ExtraCostSerializer,
    PartSerializer,
    PriceQuerySerializer,
    PriceSearchSerializer,
)


class OwnedViewSet(viewsets.ModelViewSet):
    """A user's builds, parts, bundles or extra costs."""

    # The SPEC only supports partial updates; PUT is left out so the docs don't offer it.
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    # Looked up by the public UUID, still called `id` in paths. Anything else, an
    # integer id included, is a 404 (docs/specs/public-ids.md).
    lookup_field = "public_id"
    lookup_url_kwarg = "id"


# A build's number is its place among its owner's builds, oldest first: how many of
# theirs have an id up to its own. Ids only grow, so that's creation order.
numbers = (
    Build.objects.filter(owner=OuterRef("owner"), id__lte=OuterRef("id"))
    .order_by()
    .values("owner")
    .annotate(n=Count("id"))
    .values("n")
)


BUILD_EXAMPLE = OpenApiExample(
    "A priced build",
    response_only=True,
    value={
        "id": "3f2c9a4e-0b6d-4c1e-9a57-2d8f6e1b4c90",
        "number": 1,
        "name": "Ryzen 5 7600 + RTX 4060",
        "status": "listed",
        "selling_price": "50000.00",
        "sold_at": None,
        "notes": "",
        "created_at": "2026-10-26T14:30:00+08:00",
        "totals": {
            "listed_total": "52000.00",
            "parts_cost": "45500.00",
            "extra_costs": "800.00",
            "total_cost": "46300.00",
            "profit": "3700.00",
            "profit_margin": "7.40",
            "below_market": "2000.00",
            "below_market_pct": "3.85",
            "voucher_savings": "6500.00",
        },
        "parts": [
            {
                "id": "8d1e4b2a-6c3f-4f7e-b0a9-5e2d7c1f9a36",
                "build": "3f2c9a4e-0b6d-4c1e-9a57-2d8f6e1b4c90",
                "name": "RTX 4060",
                "category": "gpu",
                "shop": "Shopee - DynaQuest",
                "bundle": None,
                "listed_price": "30000.00",
                "bought_for": "26000.00",
            },
            {
                "id": "c47a9f10-2e5b-4d8c-9b3e-71f6a0d2e584",
                "build": "3f2c9a4e-0b6d-4c1e-9a57-2d8f6e1b4c90",
                "name": "Ryzen 5 7600",
                "category": "cpu",
                "shop": "",
                "bundle": None,
                "listed_price": "22000.00",
                "bought_for": "19500.00",
            },
        ],
        "bundles": [],
        "extra_costs": [
            {
                "id": "5b9e2c7d-1a4f-4e6b-8d3c-0f7a2e9b1c45",
                "build": "3f2c9a4e-0b6d-4c1e-9a57-2d8f6e1b4c90",
                "label": "Shipping",
                "amount": "500.00",
            },
            {
                "id": "e2a6d8f4-7b1c-4a9e-a5d2-3c8f0b6e7a19",
                "build": "3f2c9a4e-0b6d-4c1e-9a57-2d8f6e1b4c90",
                "label": "Platform fee",
                "amount": "300.00",
            },
        ],
    },
)


@extend_schema_view(
    list=extend_schema(
        summary="List builds",
        description="All builds, newest first, each with its totals. "
        "Parts and extra costs are not included; fetch a single build for those.",
    ),
    create=extend_schema(
        summary="Create a build",
        description="Only `name` is required. New builds start in `planning`.",
    ),
    retrieve=extend_schema(
        summary="Get a build",
        description="The build with its parts, bundles, extra costs and totals.",
        examples=[BUILD_EXAMPLE],
    ),
    partial_update=extend_schema(
        summary="Update a build",
        description="Send only the fields to change. Returns the updated build.",
    ),
    destroy=extend_schema(
        summary="Delete a build",
        description="Also deletes its parts, bundles and extra costs. "
        "Cannot be undone.",
    ),
)
class BuildViewSet(OwnedViewSet):
    queryset = Build.objects.all()

    def get_queryset(self):
        # Only the user's own builds: anyone else's are a 404. The totals read parts,
        # bundles and extra costs; prefetching keeps the query count flat. Only the
        # detail shows bundles, which read their own parts; the list and the summary
        # don't need those parts.
        many = self.action in ("list", "summary")
        bundles = "bundles" if many else "bundles__parts"
        # On the detail, a part names its bundle by UUID, so the bundle row comes with
        # it. The list and the summary don't show parts.
        parts = (
            "parts"
            if many
            else Prefetch("parts", queryset=Part.objects.select_related("bundle"))
        )
        return (
            Build.objects.filter(owner=self.request.user)
            .annotate(number=Subquery(numbers))
            .prefetch_related(parts, bundles, "extra_costs")
        )

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def get_serializer_class(self):
        return BuildSerializer if self.action == "list" else BuildDetailSerializer

    @extend_schema(
        summary="Summary of your builds",
        description="This month's and all-time profit from sold builds, and the money "
        "tied up in builds not sold yet. Worked out from each build's `totals`.",
        responses={200: BuildsSummarySerializer},
        examples=[
            OpenApiExample(
                "A few flips",
                response_only=True,
                value={
                    "this_month": {"profit": "8400.00", "sold": 2},
                    "all_time": {"profit": "41200.00", "sold": 9},
                    "tied_up": {"cost": "23500.00", "builds": 3},
                },
            )
        ],
    )
    @action(detail=False)
    def summary(self, request):
        # ponytail: sums every build in Python, so the bundle rules stay in the model.
        # Fine for a flipper's few hundred; a database aggregate if it gets slow.
        builds = list(self.get_queryset())
        sold = [b for b in builds if b.status == Build.Status.SOLD]
        month = timezone.localdate().replace(day=1)
        this_month = [
            b for b in sold if b.sold_at and b.sold_at.replace(day=1) == month
        ]
        tied_up = [
            b for b in builds if b.status != Build.Status.SOLD and b.total_cost > ZERO
        ]

        def sales(builds):
            return {
                "profit": sum((b.profit for b in builds if b.profit is not None), ZERO),
                "sold": len(builds),
            }

        return Response(
            BuildsSummarySerializer(
                {
                    "this_month": sales(this_month),
                    "all_time": sales(sold),
                    "tied_up": {
                        "cost": sum((b.total_cost for b in tied_up), ZERO),
                        "builds": len(tied_up),
                    },
                }
            ).data
        )


@extend_schema_view(
    list=extend_schema(
        summary="List all parts", description="Every part, across all your builds."
    ),
    create=extend_schema(summary="Add a part to a build"),
    retrieve=extend_schema(summary="Get a part"),
    partial_update=extend_schema(summary="Update a part"),
    destroy=extend_schema(summary="Delete a part"),
)
class PartViewSet(OwnedViewSet):
    queryset = Part.objects.all()
    serializer_class = PartSerializer

    def get_queryset(self):
        # Its build and bundle are named by UUID, so their rows come with it.
        return Part.objects.filter(build__owner=self.request.user).select_related(
            "build", "bundle"
        )


@extend_schema_view(
    list=extend_schema(
        summary="List all bundles", description="Every bundle, across all your builds."
    ),
    create=extend_schema(
        summary="Add a bundle to a build",
        description="Parts bought together for one price. Add parts to it with "
        "their `bundle` set to its `id`.",
    ),
    retrieve=extend_schema(summary="Get a bundle"),
    partial_update=extend_schema(summary="Update a bundle"),
    destroy=extend_schema(
        summary="Delete a bundle", description="Also deletes its parts."
    ),
)
class BundleViewSet(OwnedViewSet):
    queryset = Bundle.objects.all()
    serializer_class = BundleSerializer

    def get_queryset(self):
        return (
            Bundle.objects.filter(build__owner=self.request.user)
            .select_related("build")
            .prefetch_related("parts")
        )


@extend_schema_view(
    list=extend_schema(
        summary="List all extra costs",
        description="Every extra cost, across all your builds.",
    ),
    create=extend_schema(
        summary="Add an extra cost to a build",
        description="Costs that aren't parts: shipping, platform fees, thermal paste.",
    ),
    retrieve=extend_schema(summary="Get an extra cost"),
    partial_update=extend_schema(summary="Update an extra cost"),
    destroy=extend_schema(summary="Delete an extra cost"),
)
class ExtraCostViewSet(OwnedViewSet):
    queryset = ExtraCost.objects.all()
    serializer_class = ExtraCostSerializer

    def get_queryset(self):
        return ExtraCost.objects.filter(build__owner=self.request.user).select_related(
            "build"
        )


PRICE_RESULTS = 20


class PriceSearchView(APIView):
    @extend_schema(
        summary="Find shop prices",
        description="Products whose name has every word of `q`, from the copy of the "
        "PC shops' catalogues that's refreshed daily (never a live call to a shop). "
        f"In stock first, then cheapest first; at most {PRICE_RESULTS}. "
        'Matches are loose ("rtx 3060" also finds "RTX 3060 Ti"), so show the names '
        "and let the user pick.",
        parameters=[PriceQuerySerializer],
        responses={200: PriceSearchSerializer},
        examples=[
            OpenApiExample(
                "Two matches",
                response_only=True,
                value={
                    "results": [
                        {
                            "shop": "PC Express",
                            "title": "MSI GeForce RTX 3060 VENTUS 2X OC 12GB GDDR6",
                            "url": "https://pcx.com.ph/products/msi-rtx-3060-ventus",
                            "price": "26000.00",
                            "in_stock": True,
                        },
                        {
                            "shop": "EasyPC",
                            "title": "MSI RTX 3060 Ti Ventus 2X OC 8GB",
                            "url": "https://easypc.com.ph/products/msi-rtx-3060ti",
                            "price": "23390.00",
                            "in_stock": False,
                        },
                    ],
                    "updated_at": "2026-10-30T02:04:11+08:00",
                },
            )
        ],
        tags=["prices"],
    )
    def get(self, request):
        query = PriceQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        products = ShopProduct.objects.all()
        for word in query.validated_data["q"].split():
            products = products.filter(title__icontains=word)
        # A shop's rows share one refresh time, so the oldest row is the oldest shop.
        updated = ShopProduct.objects.aggregate(t=Min("updated_at"))["t"]
        results = products.order_by("-in_stock", "price", "title")[:PRICE_RESULTS]
        return Response(
            PriceSearchSerializer({"results": results, "updated_at": updated}).data
        )
