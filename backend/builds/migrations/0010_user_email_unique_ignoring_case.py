from django.conf import settings
from django.db import migrations

INDEX = "builds_user_email_lower_uniq"


class Migration(migrations.Migration):
    """One account per email, ignoring case; many can have none (`""`)."""

    dependencies = [
        ("builds", "0009_google_account"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RunSQL(
            f"CREATE UNIQUE INDEX {INDEX} ON auth_user (lower(email)) WHERE email <> ''",
            f"DROP INDEX {INDEX}",
        ),
    ]
