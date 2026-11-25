import runpy
import unittest
from datetime import timedelta
from unittest.mock import Mock, call

publisher = runpy.run_path("scripts/publish-gwayookthon.py")


class PublicationTest(unittest.TestCase):
    def test_current_generation_uses_the_published_catalog_id(self):
        db = Mock()
        transaction = object()
        pointer = {"generationId": "2026-2027", "label": "2026–2027"}
        values = db.document.return_value.get.return_value.to_dict
        values.side_effect = [pointer, {"label": "2026-2027", "published": True}]
        self.assertEqual(publisher["current_generation"](db, transaction), "2026-2027")
        self.assertEqual(db.document.call_args_list, [call("generations/current"), call("generations/2026-2027")])
        for catalog in [None, {"published": False}, {"published": True, "archivedAt": 0}]:
            with self.subTest(catalog=catalog), self.assertRaises(RuntimeError):
                values.side_effect = [pointer, catalog]
                publisher["current_generation"](db, transaction)

    def test_duplicate_detection(self):
        matches = publisher["matches_event"]
        self.assertFalse(matches("other", {"title": "스터디"}))
        self.assertTrue(matches("other", {"title": "과육톤 연합 세션"}))
        self.assertTrue(matches("other", {"links": [publisher["SOURCE"].rstrip("/")]}))
        self.assertTrue(matches(publisher["SLUG"], {}))

    def test_create_only_and_idempotence(self):
        requires_creation = publisher["requires_creation"]
        payload = {"title": publisher["TITLE"], "published": True}
        history = {"createdBy": "fixture-actor", "updatedBy": "fixture-actor"}
        self.assertTrue(requires_creation(None, None, payload))
        self.assertFalse(requires_creation({**payload, "createdAt": 0}, history, payload))
        for existing, metadata in [
            (payload, None), (None, history), (payload, {}),
            ({**payload, "published": False}, history), ({**payload, "archivedAt": 0}, history),
        ]:
            with self.subTest(existing=existing, metadata=metadata), self.assertRaises(RuntimeError):
                requires_creation(existing, metadata, payload)


class ClosureTest(unittest.TestCase):
    def setUp(self):
        self.activity = Mock()
        self.audit = Mock()
        self.transaction = Mock()
        self.history = {"createdBy": "original-author", "updatedBy": "last-editor"}
        self.audit.get.return_value.to_dict.return_value = self.history
        self.existing = {
            **publisher["EVENT_FIELDS"], **publisher["ANNOUNCEMENT"], "links": [publisher["SOURCE"]],
            "published": True, "order": 4, "createdAt": "creation-time", "other": "preserve",
        }
        self.activity.get.return_value.to_dict.return_value = self.existing

    def close(self, now=publisher["END"]):
        return publisher["close_activity"](self.transaction, self.activity, self.audit, "editor", "timestamp", now)

    def test_close_preserves_other_fields_and_is_idempotent(self):
        self.assertEqual(self.close(), "closed")
        self.activity.get.assert_called_once_with(transaction=self.transaction)
        self.audit.get.assert_called_once_with(transaction=self.transaction)
        self.assertEqual(self.transaction.mock_calls, [
            call.update(self.activity, {**publisher["CLOSED_RECORD"], "updatedAt": "timestamp"}),
            call.update(self.audit, {"updatedBy": "editor"}),
        ])
        self.transaction.reset_mock()
        self.existing.update(publisher["CLOSED_RECORD"])
        self.assertEqual(self.close(), "already closed")
        self.assertEqual(self.transaction.mock_calls, [])

    def test_close_refuses_early_or_changed_announcements(self):
        with self.assertRaises(RuntimeError):
            self.close(publisher["END"] - timedelta(seconds=1))
        for field in [*publisher["EVENT_FIELDS"], *publisher["ANNOUNCEMENT"], "links", "published", "archivedAt"]:
            with self.subTest(field=field), self.assertRaises(RuntimeError):
                self.activity.get.return_value.to_dict.return_value = {**self.existing, field: "changed"}
                self.close()
        self.activity.get.return_value.to_dict.return_value = None
        with self.assertRaises(RuntimeError):
            self.close()
        self.activity.get.return_value.to_dict.return_value = self.existing
        for history in [None, {"createdBy": "user"}, {"updatedBy": "user"}]:
            with self.subTest(history=history), self.assertRaises(RuntimeError):
                self.audit.get.return_value.to_dict.return_value = history
                self.close()
        self.assertEqual(self.transaction.mock_calls, [])


if __name__ == "__main__":
    unittest.main()
