from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter

from builds.auth import DemoView, LoginView, LogoutView, MeView, SignupView
from builds.views import (
    BuildViewSet,
    BundleViewSet,
    ExtraCostViewSet,
    PartViewSet,
    PriceSearchView,
)

router = DefaultRouter()
router.register("builds", BuildViewSet)
router.register("parts", PartViewSet)
router.register("bundles", BundleViewSet)
router.register("extra-costs", ExtraCostViewSet)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
    path("api/auth/signup/", SignupView.as_view()),
    path("api/auth/login/", LoginView.as_view()),
    path("api/auth/logout/", LogoutView.as_view()),
    path("api/auth/demo/", DemoView.as_view()),
    path("api/auth/me/", MeView.as_view()),
    path("api/prices/", PriceSearchView.as_view()),
    path("api/", include(router.urls)),
]
