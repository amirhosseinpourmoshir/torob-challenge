from unittest.mock import patch
from django.db import DatabaseError
from django.test import SimpleTestCase


class HealthTests(SimpleTestCase):
    @patch("core.views.connection")
    def test_connected_database(self, connection):
        response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok", "database": "connected"})
        connection.cursor.return_value.__enter__.return_value.execute.assert_called_once_with("SELECT 1")

    @patch("core.views.connection")
    def test_database_outage(self, connection):
        connection.cursor.side_effect = DatabaseError("private connection information")
        response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("private", response.content.decode())

    def test_only_get_is_supported(self):
        self.assertEqual(self.client.post("/api/health/").status_code, 405)
