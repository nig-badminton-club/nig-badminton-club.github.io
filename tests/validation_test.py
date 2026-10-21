import copy
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("validate_site", ROOT / "scripts/validate_site.py")
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)
DATA = json.loads((ROOT / "docs/data/public.json").read_text())


class PublicDataTest(unittest.TestCase):
    def test_published_payload_and_unknown_counts_are_supported(self):
        self.assertEqual(validator.validate_public_data(DATA), [])
        data = copy.deepcopy(DATA)
        data["sessions"][0]["attendingCount"] = None
        self.assertEqual(validator.validate_public_data(data), [])

    def test_bad_dates_counts_and_unapproved_fields_are_rejected(self):
        for field, value in [
            ("date", "2026-02-30"), ("date", "2026-2-3"),
            ("attendingCount", -1), ("attendingCount", True),
            ("attendingCount", "3"), ("guestCount", 1.5),
            ("assignedMember", "private person"),
        ]:
            with self.subTest(field=field, value=value):
                data = copy.deepcopy(DATA)
                data["sessions"][0][field] = value
                self.assertTrue(validator.validate_public_data(data))

    def test_cancelled_counts_are_null_and_statuses_agree(self):
        data = copy.deepcopy(DATA)
        session = next(s for s in data["sessions"] if s["status"] == "cancelled")
        session["guestCount"] = 0
        self.assertTrue(validator.validate_public_data(data))
        session["guestCount"] = None
        session["responseStatus"] = "closed"
        self.assertTrue(validator.validate_public_data(data))

    def test_invalid_shapes_and_duplicate_ids_are_rejected(self):
        for data in [None, [], {"sessions": {}}, {**DATA, "sessions": [None]},
                     {**DATA, "sessions": [DATA["sessions"][0]] * 2}]:
            with self.subTest(data_type=type(data).__name__):
                self.assertTrue(validator.validate_public_data(data))

    def test_entrypoint_checks_fragments_and_preserves_nested_scan_coverage(self):
        with tempfile.TemporaryDirectory(prefix="nig-site-validation-") as directory:
            root = Path(directory)
            docs = root / "docs"
            (docs / "assets").mkdir(parents=True)
            (docs / "data").mkdir()
            for name in [".nojekyll", "favicon.svg", "index.html", "about.html", "attendance.html",
                         "workflow.html", "role-assignment.html", "admin.html", "join.html", "privacy.html"]:
                (docs / name).write_text("")
            for name in ["admin.js", "practice-scene.jpg"]:
                (docs / "assets" / name).write_text("")
            (docs / "data/public.json").write_text(json.dumps(DATA))
            (docs / "data/config.js").write_text('window.NIG_BADMINTON_PUBLIC_JSONP_URL = "";')
            (root / "VERSION").write_text("1.0.0")
            (root / "package.json").write_text('{"version":"1.0.0"}')
            (root / "package-lock.json").write_text('{"version":"1.0.0","packages":{"":{"version":"1.0.0"}}}')
            (docs / "privacy.html").write_text('<h2 id="details">Details</h2>')
            for fragment in ["details", "missing"]:
                (docs / "index.html").write_text(f'<a href="privacy.html#{fragment}">Privacy</a>')
                result = subprocess.run([sys.executable, str(ROOT / "scripts/validate_site.py")],
                                        cwd=root, capture_output=True, text=True)
                self.assertEqual(result.returncode, 0 if fragment == "details" else 1, result.stdout + result.stderr)
                if fragment == "missing":
                    self.assertIn("missing local anchor", result.stdout)
            (docs / "index.html").write_text('<a href="privacy.html#details">Privacy</a>')
            private_pattern = "spreadsheets" + "/d/"
            for excluded in ["node_modules", ".git", "build"]:
                target = root / "nested" / excluded / "deeper" / "private.txt"
                target.parent.mkdir(parents=True)
                target.write_text(private_pattern)
            result = subprocess.run([sys.executable, str(ROOT / "scripts/validate_site.py")],
                                    cwd=root, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            target = root / "nested" / "source" / ".private.txt"
            target.parent.mkdir()
            target.write_text(private_pattern)
            result = subprocess.run([sys.executable, str(ROOT / "scripts/validate_site.py")],
                                    cwd=root, capture_output=True, text=True)
            self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
            self.assertIn("nested/source/.private.txt", result.stdout)

    def test_no_practice_weeks_have_valid_nonconflicting_public_ranges(self):
        week = {"weekStart": "2026-10-19", "weekEnd": "2026-10-25", "reason": "no-reservation"}
        data = {**copy.deepcopy(DATA), "sessions": [], "noPracticeWeeks": [week]}
        self.assertEqual(validator.validate_public_data(data), [])
        for invalid in [None, {}, [None], [week, week],
                        [{**week, "weekStart": "2026-10-20"}],
                        [{**week, "weekEnd": "2026-10-26"}],
                        [{**week, "reason": "unknown"}],
                        [{**week, "privateContact": "private@example.invalid"}]]:
            with self.subTest(invalid=invalid):
                self.assertTrue(validator.validate_public_data({**data, "noPracticeWeeks": invalid}))
        conflicting = copy.deepcopy(DATA["sessions"][0])
        conflicting["date"] = "2026-10-23"
        self.assertTrue(validator.validate_public_data({**data, "sessions": [conflicting]}))
