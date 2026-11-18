import runpy
import unittest

publisher = runpy.run_path("scripts/publish-gwayookthon.py")


class PublicationTest(unittest.TestCase):
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
