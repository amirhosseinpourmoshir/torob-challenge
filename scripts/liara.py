"""Project-scoped Liara CLI wrapper. Never uploads .env or local database credentials."""
import argparse
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]
CLI_VERSION = '9.6.0'


def settings():
    return {**dotenv_values(ROOT / '.env'), **os.environ}


def required(values, name):
    value = (values.get(name) or '').strip()
    if name == 'LIARA_TEAM_ID' and '://' in value:
        raise ValueError('LIARA_TEAM_ID must be the team ID, not its console URL.')
    if not value:
        raise ValueError(f'Set {name} in the local .env file.')
    return value


def runtime_env(values):
    host = required(values, 'LIARA_PUBLIC_HOST')
    if not re.fullmatch(r'[a-zA-Z0-9.-]+', host):
        raise ValueError('LIARA_PUBLIC_HOST must be a hostname without https:// or a path.')
    db_host = required(values, 'LIARA_POSTGRES_HOST')
    if db_host in ('localhost', '127.0.0.1', 'db'):
        raise ValueError('Use the managed PostgreSQL host, not the local Docker database.')
    result = {name: required(values, name) for name in ('DJANGO_SECRET_KEY', 'AI_BASE_URL', 'AI_API_KEY', 'AI_MODEL', 'PANEL_ADMIN_USERNAME', 'PANEL_ADMIN_PASSWORD')}
    if len(result['PANEL_ADMIN_PASSWORD']) < 12:
        raise ValueError('PANEL_ADMIN_PASSWORD must contain at least 12 characters.')
    result.update({
        'POSTGRES_HOST': db_host,
        'POSTGRES_PORT': values.get('LIARA_POSTGRES_PORT') or '5432',
        'POSTGRES_DB': required(values, 'LIARA_POSTGRES_DB'),
        'POSTGRES_USER': required(values, 'LIARA_POSTGRES_USER'),
        'POSTGRES_PASSWORD': required(values, 'LIARA_POSTGRES_PASSWORD'),
        'DJANGO_DEBUG': 'false',
        'DJANGO_ALLOWED_HOSTS': f'{host},localhost,127.0.0.1',
        'DJANGO_CSRF_TRUSTED_ORIGINS': f'https://{host}',
        'COOKIE_SECURE': 'true', 'WEB_CONCURRENCY': '1', 'WEB_THREADS': '4',
        'AI_TIMEOUT_SECONDS': values.get('AI_TIMEOUT_SECONDS') or '60',
        'AGENT_TURN_TIMEOUT_SECONDS': values.get('AGENT_TURN_TIMEOUT_SECONDS') or '90',
    })
    for key in ('GEOCODER_BASE_URL', 'GEOCODER_USER_AGENT'):
        if values.get(key):
            result[key] = values[key]
    return result


def cli_command():
    cli = ROOT / '.venv/liara-cli/node_modules/@liara/cli/bin/run.js'
    node = shutil.which('node')
    if not cli.exists() or not node:
        raise ValueError(f'Install Node.js, then run: npm install --prefix .venv/liara-cli @liara/cli@{CLI_VERSION} --no-audit --no-fund')
    return [node, str(cli)]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['check', 'login', 'teams', 'apps', 'databases', 'status', 'configure', 'deploy', 'logs', 'shell'])
    args = parser.parse_args()
    values = settings()
    if args.action == 'login':
        return subprocess.call([*cli_command(), 'login'], cwd=ROOT)
    if args.action == 'check':
        cli_command()
        required(values, 'LIARA_TEAM_ID')
        required(values, 'LIARA_APP_ID')
        env = runtime_env(values)
        print(f'Local prerequisites valid: {len(env)} runtime variables. Values hidden. No remote changes made.')
        return 0
    flags = []
    if values.get('LIARA_API_TOKEN'):
        flags.extend(['--api-token', values['LIARA_API_TOKEN']])
    if args.action != 'teams':
        flags.extend(['--team-id', required(values, 'LIARA_TEAM_ID')])
    command = {'teams': ['team', 'list'], 'apps': ['app', 'list'], 'databases': ['db', 'list'], 'status': ['account', 'whoami'], 'configure': ['env', 'set'], 'deploy': ['deploy'], 'logs': ['logs'], 'shell': ['shell']}[args.action]
    if args.action in ('configure', 'deploy', 'logs', 'shell'):
        flags.extend(['--app', required(values, 'LIARA_APP_ID')])
    if args.action == 'logs':
        flags.append('--last-lines')
    if args.action == 'configure':
        env = runtime_env(values)
        flags.extend(['--force', *[f'{key}={value}' for key, value in env.items()]])
    elif args.action == 'deploy':
        runtime_env(values)
        flags.extend(['--path', str(ROOT), '--platform', 'docker', '--port', '8080', '--dockerfile', 'Dockerfile.liara', '--build-location', 'germany', '--no-app-logs'])
        if values.get('VITE_MAP_STYLE_URL'):
            flags.extend(['--build-arg', f"VITE_MAP_STYLE_URL={values['VITE_MAP_STYLE_URL']}"])
    return subprocess.call([*cli_command(), *command, *flags], cwd=ROOT)


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except ValueError as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(2)
