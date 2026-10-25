from django.urls import include, path
from rest_framework.routers import DefaultRouter

from builds.views import BuildViewSet

router = DefaultRouter()
router.register("builds", BuildViewSet)

urlpatterns = [
    path("api/", include(router.urls)),
]
