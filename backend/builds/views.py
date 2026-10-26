from drf_spectacular.utils import OpenApiExample, extend_schema, extend_schema_view
from rest_framework import viewsets

from .models import Build, ExtraCost, Part
from .serializers import (
    BuildDetailSerializer,
    BuildSerializer,
    ExtraCostSerializer,
    PartSerializer,
)

# The SPEC only supports partial updates; PUT is left out so the docs don't offer it.
METHODS = ["get", "post", "patch", "delete", "head", "options"]

BUILD_EXAMPLE = OpenApiExample(
    "A priced build",
    response_only=True,
    value={
        "id": 1,
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
                "id": 1,
                "build": 1,
                "name": "RTX 4060",
                "category": "gpu",
                "shop": "Shopee - DynaQuest",
                "listed_price": "30000.00",
                "bought_for": "26000.00",
            },
            {
                "id": 2,
                "build": 1,
                "name": "Ryzen 5 7600",
                "category": "cpu",
                "shop": "",
                "listed_price": "22000.00",
                "bought_for": "19500.00",
            },
        ],
        "extra_costs": [
            {"id": 1, "build": 1, "label": "Shipping", "amount": "500.00"},
            {"id": 2, "build": 1, "label": "Platform fee", "amount": "300.00"},
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
        description="The build with its parts, extra costs and totals.",
        examples=[BUILD_EXAMPLE],
    ),
    partial_update=extend_schema(
        summary="Update a build",
        description="Send only the fields to change. Returns the updated build.",
    ),
    destroy=extend_schema(
        summary="Delete a build",
        description="Also deletes its parts and extra costs. Cannot be undone.",
    ),
)
class BuildViewSet(viewsets.ModelViewSet):
    # The totals read parts and extra costs; prefetching keeps every endpoint at 3 queries.
    queryset = Build.objects.prefetch_related("parts", "extra_costs")
    http_method_names = METHODS

    def get_serializer_class(self):
        return BuildSerializer if self.action == "list" else BuildDetailSerializer


@extend_schema_view(
    list=extend_schema(
        summary="List all parts", description="Every part, across all builds."
    ),
    create=extend_schema(summary="Add a part to a build"),
    retrieve=extend_schema(summary="Get a part"),
    partial_update=extend_schema(summary="Update a part"),
    destroy=extend_schema(summary="Delete a part"),
)
class PartViewSet(viewsets.ModelViewSet):
    queryset = Part.objects.all()
    serializer_class = PartSerializer
    http_method_names = METHODS


@extend_schema_view(
    list=extend_schema(
        summary="List all extra costs",
        description="Every extra cost, across all builds.",
    ),
    create=extend_schema(
        summary="Add an extra cost to a build",
        description="Costs that aren't parts: shipping, platform fees, thermal paste.",
    ),
    retrieve=extend_schema(summary="Get an extra cost"),
    partial_update=extend_schema(summary="Update an extra cost"),
    destroy=extend_schema(summary="Delete an extra cost"),
)
class ExtraCostViewSet(viewsets.ModelViewSet):
    queryset = ExtraCost.objects.all()
    serializer_class = ExtraCostSerializer
    http_method_names = METHODS
