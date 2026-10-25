from rest_framework import viewsets

from .models import Build
from .serializers import BuildSerializer


class BuildViewSet(viewsets.ModelViewSet):
    queryset = Build.objects.all()
    serializer_class = BuildSerializer
