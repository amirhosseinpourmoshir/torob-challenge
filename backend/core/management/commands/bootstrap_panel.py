from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = 'Create the first panel owner from backend-only environment settings.'

    def handle(self, *args, **kwargs):
        users = get_user_model().objects
        if users.filter(is_superuser=True, is_active=True).exists():
            self.stdout.write('An admin account already exists; credentials were not changed.')
            return
        username, password = settings.PANEL_ADMIN_USERNAME, settings.PANEL_ADMIN_PASSWORD
        if not username or len(password) < 12:
            raise CommandError('Set PANEL_ADMIN_USERNAME and a PANEL_ADMIN_PASSWORD of at least 12 characters.')
        if users.filter(username=username).exists():
            raise CommandError('This username already exists; choose another username.')
        users.create_superuser(username=username, password=password)
        self.stdout.write(self.style.SUCCESS('Panel owner created. Password was not printed.'))
