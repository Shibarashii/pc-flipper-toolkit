from django.contrib import admin

from .models import Build, ExtraCost, Part


class PartInline(admin.TabularInline):
    model = Part
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
    inlines = [PartInline, ExtraCostInline]


@admin.register(Part)
class PartAdmin(admin.ModelAdmin):
    list_display = ["name", "category", "shop", "listed_price", "bought_for", "build"]
    list_filter = ["category"]
    search_fields = ["name", "shop"]
    list_select_related = ["build"]


@admin.register(ExtraCost)
class ExtraCostAdmin(admin.ModelAdmin):
    list_display = ["label", "amount", "build"]
    search_fields = ["label"]
    list_select_related = ["build"]
