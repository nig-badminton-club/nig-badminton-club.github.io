import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

root = Path("docs")
failures = []

package = json.loads(Path("package.json").read_text())
lock = json.loads(Path("package-lock.json").read_text())
if not (Path("VERSION").read_text().strip() == package["version"] == lock["version"] == lock["packages"][""]["version"]):
    failures.append("VERSION, package.json and package-lock.json must use the same version")

required = [
    root / ".nojekyll",
    root / "favicon.svg",
    root / "index.html",
    root / "about.html",
    root / "attendance.html",
    root / "workflow.html",
    root / "role-assignment.html",
    root / "admin.html",
    root / "join.html",
    root / "privacy.html",
    root / "data" / "public.json",
    root / "data" / "config.js",
    root / "assets" / "admin.js",
    root / "assets" / "practice-scene.jpg",
]
for path in required:
    if not path.exists():
        failures.append(f"Missing required file: {path}")

try:
    public_data = json.loads((root / "data" / "public.json").read_text())
    for key in ["clubName", "sessions", "policy", "venue"]:
        if key not in public_data:
            failures.append(f"docs/data/public.json is missing key: {key}")
    for session in public_data.get("sessions", []):
        if session.get("responseStatus") not in {"open", "changes-open", "closed", "upcoming", "cancelled", "unavailable"}:
            failures.append(f"session {session.get('sessionId')} has invalid responseStatus")
        if session.get("roleStatus") not in {"pending", "assigned", "unassigned"}:
            failures.append(f"session {session.get('sessionId')} has invalid roleStatus")
        for key in ["attendingCount", "absentCount", "unansweredCount", "guestCount"]:
            if key not in session:
                failures.append(f"session {session.get('sessionId')} is missing key: {key}")
        if session.get("responseStatus") == "upcoming":
            for key in ["attendingCount", "absentCount", "unansweredCount", "guestCount"]:
                if session.get(key) is not None:
                    failures.append(f"upcoming session {session.get('sessionId')} must use null for {key}")
except Exception as error:
    failures.append(f"docs/data/public.json is invalid: {error}")

config_js = (root / "data" / "config.js").read_text()
if "NIG_BADMINTON_PUBLIC_JSONP_URL" not in config_js:
    failures.append("docs/data/config.js must define NIG_BADMINTON_PUBLIC_JSONP_URL")

forbidden_patterns = [
    r"spreadsheets/d/",
    r"script\.google\.com/home/projects",
    r"refresh_token",
    r"access_token",
    r"client_secret",
    r"confirmation_token",
    r"nig\.badminton-club\+managers",
]
for path in [
    p
    for p in Path(".").rglob("*")
    if p.is_file()
    and ".git" not in p.parts
    and "node_modules" not in p.parts
    and str(p) != "scripts/validate_site.py"
    and "build" not in p.parts
]:
    text = path.read_text(errors="ignore")
    for pattern in forbidden_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            failures.append(f"Forbidden public pattern {pattern!r} found in {path}")

class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for attr in ["href", "src"]:
            value = attrs.get(attr)
            if value:
                self.refs.append(value)

for html_path in root.glob("*.html"):
    parser = LinkParser()
    parser.feed(html_path.read_text())
    for ref in parser.refs:
        parsed = urlparse(ref)
        if parsed.scheme or ref.startswith("#"):
            continue
        local = ref.split("#", 1)[0].split("?", 1)[0]
        if not local:
            continue
        target = (html_path.parent / local).resolve()
        try:
            target.relative_to(root.resolve())
        except ValueError:
            failures.append(f"{html_path}: link escapes repository: {ref}")
            continue
        if not target.exists():
            failures.append(f"{html_path}: missing local link target: {ref}")

if failures:
    print("\n".join(failures))
    sys.exit(1)
print("Static site validation passed.")
