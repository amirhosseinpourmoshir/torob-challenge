import time
from django.core.management.base import BaseCommand
from agent.worker import work_once


class Command(BaseCommand):
    help = 'Process durable shopping-agent turns and catalogue preparation jobs.'

    def add_arguments(self, parser):
        parser.add_argument('--once', action='store_true')
        parser.add_argument('--turn')

    def handle(self, *args, **options):
        if options.get('turn'):
            from agent.models import AgentTurn
            from agent.worker import execute_turn
            turn = AgentTurn.objects.filter(pk=options['turn'], status='running').first()
            if turn:
                execute_turn(turn)
            return
        if options['once']:
            work_once()
            return
        self.stdout.write('Shopping agent worker is ready.')
        while True:
            try:
                if not work_once():
                    time.sleep(1)
            except KeyboardInterrupt:
                return
            except Exception:
                self.stderr.write('Worker cycle interrupted; retrying shortly.')
                time.sleep(3)
