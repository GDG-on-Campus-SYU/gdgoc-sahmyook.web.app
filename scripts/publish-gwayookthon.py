"""Create the approved activity and its private audit record in one transaction."""

import json
import re
from datetime import datetime, timezone
from urllib.request import Request, urlopen

PROJECT = "gdgoc-sahmyook"
SLUG = "gwayookthon-2026"
TITLE = "과육톤 | GDGoC 서울과학기술대학교 × 삼육대학교 연합 세션"
SOURCE = (
    "https://gdg.community.dev/events/details/google-gdg-on-campus-seoul-national-university-of-science-and-technology-"
    "seoul-south-korea-presents-gwayugton-gdgoc-seoulgwahaggisuldaehaggyo-x-samyugdaehaggyo-yeonhab-sesyeon/"
)
START = datetime.fromisoformat("2026-11-24T09:30:00+00:00")
END = datetime.fromisoformat("2026-11-24T13:00:00+00:00")
PLACE = "서울과학기술대학교"


def verify_source():
    request = Request(SOURCE, headers={"Cache-Control": "no-cache", "User-Agent": "GDGOC-Sahmyook-event-verification"})
    with urlopen(request, timeout=20) as response:
        html = response.read().decode("utf-8")
    for block in re.findall(r"""<script\b[^>]*type=["']application/ld\+json["'][^>]*>(.*?)</script>""", html, re.I | re.S):
        event = json.loads(block)
        if isinstance(event, dict) and event.get("name") == TITLE:
            if (datetime.fromisoformat(event["startDate"]) == START
                    and datetime.fromisoformat(event["endDate"]) == END
                    and event["location"]["name"] == PLACE
                    and event.get("eventStatus", "").rsplit("/", 1)[-1] != "EventCancelled"):
                return
    raise RuntimeError("The official event title, schedule, place or status changed. Review before publishing.")


def matches_event(document_id, data):
    return (document_id == SLUG or data.get("slug") == SLUG or "과육톤" in data.get("title", "").replace(" ", "")
            or any(link.rstrip("/") == SOURCE.rstrip("/") for link in data.get("links", []) if isinstance(link, str)))


def requires_creation(existing, history, payload):
    if existing is None and history is None:
        return True
    if (existing and history and "archivedAt" not in existing and history.get("createdBy") and history.get("updatedBy")
            and all(existing.get(key) == value for key, value in payload.items())):
        return False
    raise RuntimeError("The activity or audit path is already occupied by different data.")


def current_generation(db, transaction):
    current = db.document("generations/current").get(transaction=transaction).to_dict() or {}
    generation = current.get("generationId")
    if not isinstance(generation, str) or not generation or generation == "current" or "/" in generation:
        raise RuntimeError("No current generation was found.")
    catalog = db.document("generations/" + generation).get(transaction=transaction).to_dict() or {}
    if catalog.get("published") is not True or "archivedAt" in catalog:
        raise RuntimeError("The current generation has no active, published catalog entry.")
    return generation


def publish():
    import google.auth
    from google.cloud import firestore

    credentials, project = google.auth.default(scopes=["https://www.googleapis.com/auth/datastore"])
    if project != PROJECT or getattr(credentials, "project_id", None) != PROJECT:
        raise RuntimeError("The ADC project must match the production site.")
    actor = getattr(credentials, "service_account_email", None)
    if not actor:
        raise RuntimeError("The authenticated service account is required for the audit record.")
    db = firestore.Client(project=PROJECT, credentials=credentials)
    activities = db.collection("activities")
    activity = activities.document(SLUG)
    audit = db.document("internalMetadata/activities/documents/" + SLUG)

    @firestore.transactional
    def create(transaction):
        generation = current_generation(db, transaction)
        payload = {
            "title": TITLE, "slug": SLUG, "category": "Session", "status": "예정",
            "summary": "GDGoC 서울과학기술대학교와 삼육대학교가 함께 여는 네트워킹 세션입니다.",
            "content": "2026년 11월 24일 화요일 오후 6시 30분부터 10시까지 서울과학기술대학교에서 만납니다.\n"
                       "장소는 서울 노원구 공릉로 232입니다. 자세한 행사 안내는 아래 공식 행사 페이지에서 확인해 주세요.",
            "startDate": "2026-11-24", "endDate": "2026-11-24", "generation": generation,
            "host": "GDGoC 서울과학기술대학교 · GDGoC 삼육대학교", "links": [SOURCE], "order": 0, "published": True,
        }
        existing = activity.get(transaction=transaction).to_dict()
        history = audit.get(transaction=transaction).to_dict()
        candidates = activities.select(["slug", "title", "links"]).stream(transaction=transaction)
        if any(row.id != SLUG and matches_event(row.id, row.to_dict()) for row in candidates):
            raise RuntimeError("Another activity may describe this event. Its contents were left untouched.")
        if not requires_creation(existing, history, payload):
            return "already published"
        if datetime.now(timezone.utc) >= END:
            raise RuntimeError("The event has ended. No new upcoming activity was created.")
        transaction.create(activity, {**payload, "createdAt": firestore.SERVER_TIMESTAMP, "updatedAt": firestore.SERVER_TIMESTAMP})
        transaction.create(audit, {"createdBy": actor, "updatedBy": actor})
        return "created"

    result = create(db.transaction())
    url = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/activities/{SLUG}"
    with urlopen(url, timeout=20) as response:
        fields = json.load(response)["fields"]
    if (fields.get("published", {}).get("booleanValue") is not True or fields["title"]["stringValue"] != TITLE
            or fields["slug"]["stringValue"] != SLUG or fields["startDate"]["stringValue"] != "2026-11-24"
            or fields["links"]["arrayValue"]["values"] != [{"stringValue": SOURCE}]
            or {"archivedAt", "createdBy", "updatedBy"}.intersection(fields)):
        raise RuntimeError("Public verification failed after the transaction. Inspect the existing activity before retrying.")
    print(f"{result}: https://gdgoc-sahmyook.web.app/activities/detail/?slug={SLUG}")


if __name__ == "__main__":
    verify_source()
    publish()
