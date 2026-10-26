from django.urls import include, path
from rest_framework.routers import DefaultRouter

from builds.views import BuildViewSet, ExtraCostViewSet, PartViewSet

router = DefaultRouter()
router.register("builds", BuildViewSet)
router.register("parts", PartViewSet)
router.register("extra-costs", ExtraCostViewSet)

urlpatterns = [
    path("api/", include(router.urls)),
]
