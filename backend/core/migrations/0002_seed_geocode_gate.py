from django.db import migrations
from django.utils import timezone


def seed(apps, schema_editor):
    apps.get_model('core', 'GeocodeGate').objects.using(schema_editor.connection.alias).get_or_create(pk=1, defaults={'next_allowed_at': timezone.now()})


class Migration(migrations.Migration):
    dependencies = [('core', '0001_initial')]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
