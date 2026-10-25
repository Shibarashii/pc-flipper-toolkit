from django.core.validators import MinValueValidator
from django.db import models


class Build(models.Model):
    class Status(models.TextChoices):
        PLANNING = "planning"
        BUILDING = "building"
        LISTED = "listed"
        SOLD = "sold"

    name = models.CharField(max_length=200)
    status = models.CharField(max_length=10, choices=Status, default=Status.PLANNING)
    selling_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)],
    )
    sold_at = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self) -> str:
        return self.name
