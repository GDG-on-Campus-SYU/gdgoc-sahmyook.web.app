import runpy
import unittest
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


if __name__ == "__main__":
    unittest.main()
