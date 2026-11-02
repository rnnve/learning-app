import io
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import sync_latest_apk as sync


class CdnUploadTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.apk = Path(self.temporary.name) / "studyapp-1.0.3-4.apk"
        self.apk.write_bytes(b"verified APK fixture")
        self.key = patch.dict(os.environ, {"CDN_UPLOAD_KEY": "unit-test-token"})
        self.key.start()
        self.addCleanup(self.key.stop)

    def successful_response(self, command, **kwargs):
        self.assertNotIn("unit-test-token", " ".join(command))
        self.assertIn("key=unit-test-token", kwargs["input"])
        self.assertIn("path=%2Fapks%2F", kwargs["input"])
        response = {"url": "https://objects.example/apks/random.apk", "size": self.apk.stat().st_size}
        Path(command[command.index("--output") + 1]).write_text(json.dumps(response))
        return subprocess.CompletedProcess(command, 0, "201", "")

    @patch.object(sync, "urlopen")
    @patch.object(sync.subprocess, "run")
    def test_key_stays_out_of_arguments_and_returned_file_is_verified(self, run, download):
        run.side_effect = self.successful_response
        download.return_value = io.BytesIO(self.apk.read_bytes())
        url = sync.upload_cdn(self.apk, "https://cdn.example/upload", "/apks/")
        self.assertEqual(url, "https://objects.example/apks/random.apk")

    @patch.object(sync, "urlopen")
    @patch.object(sync.subprocess, "run")
    def test_rejects_a_corrupted_cdn_download(self, run, download):
        run.side_effect = self.successful_response
        download.return_value = io.BytesIO(b"corrupted")
        with self.assertRaisesRegex(ValueError, "SHA-256"):
            sync.upload_cdn(self.apk, "https://cdn.example/upload", "/apks/")

    @patch.object(sync.subprocess, "run")
    def test_reports_upload_limit_without_exposing_key(self, run):
        run.return_value = subprocess.CompletedProcess([], 22, "413", "")
        with self.assertRaisesRegex(RuntimeError, "HTTP 413") as caught:
            sync.upload_cdn(self.apk, "https://cdn.example/upload", "/apks/")
        self.assertNotIn("unit-test-token", str(caught.exception))

    @patch.object(sync.subprocess, "run")
    def test_rejects_http_before_sending_credentials(self, run):
        with self.assertRaisesRegex(ValueError, "HTTPS"):
            sync.upload_cdn(self.apk, "http://cdn.example/upload", "/apks/")
        run.assert_not_called()


if __name__ == "__main__":
    unittest.main()
