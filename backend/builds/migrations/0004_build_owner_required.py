from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("builds", "0003_build_owner")]

    operations = [
        migrations.AlterField(
            model_name="build",
            name="owner",
            field=models.ForeignKey(
                on_delete=models.deletion.CASCADE,
                related_name="builds",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
