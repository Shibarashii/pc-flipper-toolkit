from rest_framework import viewsets

from .models import Build, ExtraCost, Part
from .serializers import (
    BuildDetailSerializer,
    BuildSerializer,
    ExtraCostSerializer,
    PartSerializer,
)


class BuildViewSet(viewsets.ModelViewSet):
    # The totals read parts and extra costs; prefetching keeps every endpoint at 3 queries.
    queryset = Build.objects.prefetch_related("parts", "extra_costs")

    def get_serializer_class(self):
        return BuildSerializer if self.action == "list" else BuildDetailSerializer


class PartViewSet(viewsets.ModelViewSet):
    queryset = Part.objects.all()
    serializer_class = PartSerializer


class ExtraCostViewSet(viewsets.ModelViewSet):
    queryset = ExtraCost.objects.all()
    serializer_class = ExtraCostSerializer
