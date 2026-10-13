import json
import re
import sys
from datetime import date
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlparse


def validate_public_data(data):
    errors = []
    if not isinstance(data, dict):
        return ["Public data must be an object"]
    for key in ["clubName", "sessions", "policy", "venue"]:
        if key not in data:
            errors.append(f"docs/data/public.json is missing key: {key}")
    sessions = data.get("sessions")
    if not isinstance(sessions, list):
        return errors + ["sessions must be an array"]
    public_fields = {
        "sessionId", "date", "time", "location", "status", "reservationStatus",
        "reservationTime", "responseStatus", "attendingCount", "absentCount",
        "unansweredCount", "guestCount", "roleStatus", "keyPickupStatus",
        "publicNote", "formUrl",
    }
    seen = set()
    for session in sessions:
        if not isinstance(session, dict):
            errors.append("Each session must be an object")
            continue
        session_id = session.get("sessionId")
        if not isinstance(session_id, str) or not session_id or session_id in seen:
            errors.append("Session IDs must be nonempty unique strings")
        else:
            seen.add(session_id)
        if set(session) - public_fields:
            errors.append(f"session {session_id} contains unapproved public fields")
        value = session.get("date")
        try:
            if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
                raise ValueError()
            date.fromisoformat(value)
        except ValueError:
            errors.append(f"session {session_id} has an invalid practice date")
        status = session.get("status")
        response_status = session.get("responseStatus")
        if status not in {"scheduled", "tentative", "cancelled"}:
            errors.append(f"session {session_id} has invalid status")
        if response_status not in {"open", "changes-open", "closed", "upcoming", "cancelled", "unavailable"}:
            errors.append(f"session {session_id} has invalid responseStatus")
        if (status == "cancelled") != (response_status == "cancelled"):
            errors.append(f"session {session_id} has inconsistent cancellation status")
        if session.get("roleStatus") not in {"pending", "assigned", "unassigned"}:
            errors.append(f"session {session_id} has invalid roleStatus")
        for key in ["attendingCount", "absentCount", "unansweredCount", "guestCount"]:
            if key not in session:
                errors.append(f"session {session_id} is missing key: {key}")
                continue
            count = session[key]
            if response_status in {"upcoming", "cancelled"}:
                if count is not None:
                    errors.append(f"{response_status} session {session_id} must use null for {key}")
            elif count is not None and (type(count) is not int or count < 0):
                errors.append(f"session {session_id} has invalid {key}")
    return errors

def main():
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
        failures.extend(validate_public_data(public_data))
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
            self.ids = set()

        def handle_starttag(self, tag, attrs):
            attrs = dict(attrs)
            if attrs.get("id"):
                self.ids.add(attrs["id"])
            for attr in ["href", "src"]:
                value = attrs.get(attr)
                if value:
                    self.refs.append(value)

    pages = {}
    for html_path in root.glob("*.html"):
        parser = LinkParser()
        parser.feed(html_path.read_text())
        pages[html_path.resolve()] = parser

    for html_path, parser in pages.items():
        for ref in parser.refs:
            parsed = urlparse(ref)
            if parsed.scheme or parsed.netloc:
                continue
            local = unquote(parsed.path)
            target = ((root / local.lstrip("/")) if local.startswith("/") else (html_path.parent / local)).resolve() if local else html_path
            try:
                target.relative_to(root.resolve())
            except ValueError:
                failures.append(f"{html_path}: link escapes repository: {ref}")
                continue
            if not target.exists():
                failures.append(f"{html_path}: missing local link target: {ref}")
            if parsed.fragment and target in pages and unquote(parsed.fragment) not in pages[target].ids:
                failures.append(f"{html_path}: missing local anchor: {ref}")

    if failures:
        print("\n".join(failures))
        sys.exit(1)
    print("Static site validation passed.")


if __name__ == "__main__":
    main()
