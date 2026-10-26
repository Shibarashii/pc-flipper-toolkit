from django.conf import settings
from django.db import migrations, models


def give_builds_to_first_superuser(apps, schema_editor):
    """Builds made before accounts existed go to the first superuser."""
    Build = apps.get_model("builds", "Build")
    if not Build.objects.exists():
        return
    User = apps.get_model(*settings.AUTH_USER_MODEL.split("."))
    owner = User.objects.filter(is_superuser=True).order_by("id").first()
    if owner is None:
        raise RuntimeError(
            "Existing builds need an owner: run `python manage.py createsuperuser` "
            "first, then migrate again."
        )
    Build.objects.update(owner=owner)


class Migration(migrations.Migration):
    dependencies = [
        ("builds", "0002_part_extracost"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    # Nullable here; 0004 makes it required. Separate migrations, because Postgres
    # can't alter a table in the same transaction that just updated its foreign keys.
    operations = [
        migrations.AddField(
            model_name="build",
            name="owner",
            field=models.ForeignKey(
                null=True,
                on_delete=models.deletion.CASCADE,
                related_name="builds",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(give_builds_to_first_superuser, migrations.RunPython.noop),
    ]
