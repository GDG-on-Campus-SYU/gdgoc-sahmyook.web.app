"""Publish or close the approved activity together with its private audit record."""

import argparse
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
EVENT_FIELDS = {"title": TITLE, "slug": SLUG, "startDate": "2026-11-24", "endDate": "2026-11-24"}
ANNOUNCEMENT = {
    "status": "예정",
    "summary": "GDGoC 서울과학기술대학교와 삼육대학교가 함께 여는 네트워킹 세션입니다.",
    "content": "2026년 11월 24일 화요일 오후 6시 30분부터 10시까지 서울과학기술대학교에서 만납니다.\n"
               "장소는 서울 노원구 공릉로 232입니다. 자세한 행사 안내는 아래 공식 행사 페이지에서 확인해 주세요.",
}
INITIAL_CLOSED_RECORD = {
    "status": "종료",
    "summary": "GDGoC 서울과학기술대학교와 삼육대학교의 연합 네트워킹 세션입니다.",
    "content": "공식 행사 페이지에 안내된 일정은 2026년 11월 24일 화요일 오후 6시 30분부터 10시까지였으며, "
               "장소는 서울과학기술대학교(서울 노원구 공릉로 232)였습니다.",
}
CLOSED_RECORD = {
    "status": "종료",
    "summary": "Gemini로 대학생의 생활비를 어떻게 줄일 수 있을까요? "
               "서울과기대와 삼육대 학생들이 80분 동안 서비스를 기획하고, 3분 발표로 서로의 아이디어를 나눴습니다.",
    "content": (
        "서울과학기술대학교에 모인 두 학교 학생들은 먼저 서로를 소개하고 팀 이름을 정했습니다. "
        "이어진 QR 빙고에서는 빙고판에 적힌 특징에 맞는 사람을 찾아 말을 걸고, 서로의 QR 코드를 찍어 칸을 채웠습니다.\n\n"
        "이날의 과제는 “Gemini를 활용해 대학생의 지갑을 지켜라!”였습니다. "
        "운영진이 든 예시는 ‘AI 자취생 셰프’였습니다. 냉장고에 남은 식재료를 바탕으로 저렴하게 차릴 수 있는 식단을 추천하는 아이디어입니다. "
        "각 팀은 식비나 매달 빠져나가는 구독료처럼 대학생이 겪는 지출 문제를 자유롭게 골랐습니다.\n\n"
        "기획에 주어진 시간은 80분이었습니다. 팀별로 누구의 어떤 지출을 줄일지 정하고, Gemini를 활용한 서비스의 핵심 기능과 "
        "작동 방식을 발표 자료에 담는 것이 과제였습니다. Gemini로 화면 예시나 프로토타입을 만들어 아이디어를 보여 주면 가산점을 받을 수 있었습니다.\n\n"
        "발표 시간은 팀당 3분이었습니다. 현장 참가자들은 각 팀의 발표 자료를 살펴보고 다른 팀에 한 표를 주는 방식으로 평가에 참여했습니다. "
        "평가 기준은 세 가지였습니다. 새로운 관점을 제시했는지, 사용자에게 실제로 도움이 되는지, 다양한 상황에서 쓸 수 있는지를 함께 살폈습니다.\n\n"
        "행사 일정 · 2026년 11월 24일(화) 18:30–22:00 · 서울과학기술대학교"
    ),
}


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


def close_activity(transaction, activity, audit, actor, updated_at, now):
    if now < END:
        raise RuntimeError("The official event has not ended yet.")
    existing = activity.get(transaction=transaction).to_dict() or {}
    history = audit.get(transaction=transaction).to_dict() or {}
    if (existing.get("published") is not True or "archivedAt" in existing or existing.get("links") != [SOURCE]
            or any(existing.get(key) != value for key, value in EVENT_FIELDS.items())
            or not history.get("createdBy") or not history.get("updatedBy")):
        raise RuntimeError("The published activity or its audit record does not match this event.")
    current_text = {key: existing.get(key) for key in ANNOUNCEMENT}
    if current_text == CLOSED_RECORD:
        return "already closed"
    if current_text not in (ANNOUNCEMENT, INITIAL_CLOSED_RECORD):
        raise RuntimeError("The activity was edited. Review its current text before updating the archive.")
    transaction.update(activity, {**CLOSED_RECORD, "updatedAt": updated_at})
    transaction.update(audit, {"updatedBy": actor})
    return "closed"


def publish(action="publish"):
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
            **EVENT_FIELDS, **ANNOUNCEMENT, "category": "Session", "generation": generation,
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

    if action == "close":
        result = firestore.transactional(close_activity)(
            db.transaction(), activity, audit, actor, firestore.SERVER_TIMESTAMP, datetime.now(timezone.utc))
        expected_text = CLOSED_RECORD
    else:
        result = create(db.transaction())
        expected_text = ANNOUNCEMENT
    url = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/activities/{SLUG}"
    with urlopen(url, timeout=20) as response:
        fields = json.load(response)["fields"]
    if (fields.get("published", {}).get("booleanValue") is not True
            or any(fields.get(key, {}).get("stringValue") != value for key, value in {**EVENT_FIELDS, **expected_text}.items())
            or fields["links"]["arrayValue"]["values"] != [{"stringValue": SOURCE}]
            or {"archivedAt", "createdBy", "updatedBy"}.intersection(fields)):
        raise RuntimeError("Public verification failed after the transaction. Inspect the existing activity before retrying.")
    print(f"{result}: https://gdgoc-sahmyook.web.app/activities/detail/?slug={SLUG}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", nargs="?", choices=("publish", "close"), default="publish")
    args = parser.parse_args()
    verify_source()
    publish(args.action)
