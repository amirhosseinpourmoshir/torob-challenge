import unittest
from liara import runtime_env, required


class DeploymentSettingsTests(unittest.TestCase):
    def values(self):
        return dict(DJANGO_SECRET_KEY='test-only', AI_BASE_URL='https://example.com/v1', AI_API_KEY='test-only', AI_MODEL='gpt-6-luna', PANEL_ADMIN_USERNAME='admin', PANEL_ADMIN_PASSWORD='test-password-12345', LIARA_PUBLIC_HOST='demo.example.com', LIARA_POSTGRES_HOST='postgres.internal', LIARA_POSTGRES_DB='torob_hakatoon', LIARA_POSTGRES_USER='cloud_user', LIARA_POSTGRES_PASSWORD='cloud-test-only', POSTGRES_HOST='db', POSTGRES_PASSWORD='local-test-only', LIARA_API_TOKEN='control-plane-test-only')

    def test_runtime_uses_cloud_database_and_never_sends_cli_token(self):
        result = runtime_env(self.values())
        self.assertEqual(result['POSTGRES_HOST'], 'postgres.internal')
        self.assertEqual(result['POSTGRES_PASSWORD'], 'cloud-test-only')
        self.assertNotIn('LIARA_API_TOKEN', result)
        self.assertEqual(result['DJANGO_CSRF_TRUSTED_ORIGINS'], 'https://demo.example.com')
        self.assertEqual(result['COOKIE_SECURE'], 'true')

    def test_rejects_missing_or_local_database_target(self):
        for host in ('', 'localhost', '127.0.0.1', 'db'):
            values = self.values(); values['LIARA_POSTGRES_HOST'] = host
            with self.assertRaises(ValueError):
                runtime_env(values)

    def test_rejects_url_in_team_or_hostname_field(self):
        with self.assertRaises(ValueError):
            required({'LIARA_TEAM_ID': 'https://console.liara.ir/teams/123'}, 'LIARA_TEAM_ID')
        values = self.values(); values['LIARA_PUBLIC_HOST'] = 'https://demo.example.com/path'
        with self.assertRaises(ValueError):
            runtime_env(values)


if __name__ == '__main__':
    unittest.main()
