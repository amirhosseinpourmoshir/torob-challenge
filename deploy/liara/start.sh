#!/bin/sh
set -eu
cd /app
python manage.py migrate --noinput
python manage.py collectstatic --noinput
python manage.py bootstrap_panel
exec supervisord -c /etc/supervisor/torob.conf
