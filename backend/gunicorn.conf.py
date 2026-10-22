"""Small demo-server defaults; tune worker counts through environment variables."""
import os

bind = '0.0.0.0:8000'
workers = int(os.getenv('WEB_CONCURRENCY', '2'))
threads = int(os.getenv('WEB_THREADS', '4'))
worker_class = 'gthread'
timeout = 120
graceful_timeout = 30
accesslog = '-'
errorlog = '-'
capture_output = True
