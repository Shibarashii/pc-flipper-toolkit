from django.contrib import admin
from django.http import HttpResponse
from rest_framework.throttling import SimpleRateThrottle

from .models import Build, Bundle, ExtraCost, Part, ShopProduct


class PartInline(admin.TabularInline):
    model = Part
    extra = 0


class BundleInline(admin.TabularInline):
    model = Bundle
    extra = 0


class ExtraCostInline(admin.TabularInline):
    model = ExtraCost
    extra = 0


@admin.register(Build)
class BuildAdmin(admin.ModelAdmin):
    list_display = ["name", "owner", "status", "selling_price", "sold_at", "created_at"]
    list_filter = ["status", "owner"]
    list_select_related = ["owner"]
    search_fields = ["name", "notes"]
    inlines = [PartInline, BundleInline, ExtraCostInline]


@admin.register(Part)
class PartAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "category",
        "shop",
        "listed_price",
        "bought_for",
        "bundle",
        "build",
    ]
    list_filter = ["category"]
    search_fields = ["name", "shop"]
    list_select_related = ["build", "bundle"]


@admin.register(Bundle)
class BundleAdmin(admin.ModelAdmin):
    list_display = ["name", "shop", "bought_for", "build"]
    search_fields = ["name", "shop"]
    list_select_related = ["build"]


@admin.register(ShopProduct)
class ShopProductAdmin(admin.ModelAdmin):
    """Read-only: the copy is only ever replaced by `refresh_shop_prices`."""

    list_display = ["title", "shop", "price", "in_stock", "updated_at"]
    list_filter = ["shop", "in_stock"]
    search_fields = ["title"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(ExtraCost)
class ExtraCostAdmin(admin.ModelAdmin):
    list_display = ["label", "amount", "build"]
    search_fields = ["label"]
    list_select_related = ["build"]


class AdminLoginThrottle(SimpleRateThrottle):
    """The API's sign-up/log-in limit (10/min per IP), counted separately."""

    rate = SimpleRateThrottle.THROTTLE_RATES["auth"]

    def get_cache_key(self, request, view):
        return f"throttle_admin_login_{self.get_ident(request)}"


login = admin.site.login


def throttled_login(request, extra_context=None):
    # The admin login is public and a superuser sees every user's builds, so password
    # guesses get the same limit as the API's. Only POSTs (tries) count.
    if request.method == "POST" and not AdminLoginThrottle().allow_request(
        request, None
    ):
        return HttpResponse(
            "Too many attempts. Wait a minute and try again.", status=429
        )
    return login(request, extra_context)


admin.site.login = throttled_login
