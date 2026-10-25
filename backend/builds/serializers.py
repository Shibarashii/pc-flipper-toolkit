from rest_framework import serializers

from .models import Build


class BuildSerializer(serializers.ModelSerializer):
    class Meta:
        model = Build
        fields = [
            "id",
            "name",
            "status",
            "selling_price",
            "sold_at",
            "notes",
            "created_at",
        ]
