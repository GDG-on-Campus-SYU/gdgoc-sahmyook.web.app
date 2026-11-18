import {
  deleteField, doc, DocumentReference, refEqual, runTransaction, serverTimestamp,
  type DocumentData, type DocumentSnapshot, type Transaction,
} from "firebase/firestore";

export class AdminConflict extends Error {}

// Compare persisted fields, including timestamps, independently of the SDK's local mutation metadata.
function sameValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object" || Object.getPrototypeOf(left) !== Object.getPrototypeOf(right)) return false;
  if (left instanceof DocumentReference && right instanceof DocumentReference) return refEqual(left, right);
  if ("isEqual" in left && typeof left.isEqual === "function") return left.isEqual(right);
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) =>
    Object.hasOwn(right, key) && sameValue(Reflect.get(left, key), Reflect.get(right, key)));
}

async function checkSnapshot(transaction: Transaction, target: DocumentReference, original: DocumentSnapshot | null) {
  const latest = await transaction.get(target);
  if (original ? !sameValue(original.data(), latest.data()) : latest.exists()) {
    throw new AdminConflict(original
      ? "다른 운영자가 이 항목을 변경했습니다. 입력한 내용은 이 화면에 유지됩니다."
      : "같은 문서 ID가 이미 있습니다. 기존 항목을 확인해 주세요.");
  }
}

function metadataRef(target: DocumentReference) {
  return doc(target.firestore, "internalMetadata", target.parent.id, "documents", target.id);
}

function writeCurrent(transaction: Transaction, pointer: DocumentReference, id: string, label: string, userId: string) {
  transaction.set(pointer, { generationId: id, label, published: true, updatedAt: serverTimestamp() });
  transaction.set(metadataRef(pointer), { updatedBy: userId }, { merge: true });
}

export function saveAdminDocument(target: DocumentReference, original: DocumentSnapshot | null, payload: DocumentData, userId: string) {
  return runTransaction(target.firestore, async (transaction) => {
    await checkSnapshot(transaction, target, original);
    if (target.parent.id === "generations") {
      const pointer = doc(target.parent, "current");
      const current = (await transaction.get(pointer)).data();
      if (current?.generationId === target.id) {
        if (!payload.published) throw new AdminConflict("현재 기수는 비공개로 바꿀 수 없습니다. 먼저 다른 기수를 현재로 설정해 주세요.");
        if (current.label !== payload.label) writeCurrent(transaction, pointer, target.id, payload.label, userId);
      }
    }
    const isMember = target.parent.id === "members";
    if (original) {
      transaction.update(target, {
        ...payload, updatedAt: serverTimestamp(), createdBy: deleteField(), updatedBy: deleteField(), archivedBy: deleteField(),
        ...(isMember ? { consentConfirmedAt: deleteField(), consentConfirmedBy: deleteField() } : {}),
      });
    } else {
      transaction.set(target, { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }
    transaction.set(metadataRef(target), {
      updatedBy: userId,
      ...(!original ? { createdBy: userId } : {}),
      ...(isMember && payload.visible === true && !original?.get("visible")
        ? { consentConfirmedAt: serverTimestamp(), consentConfirmedBy: userId } : {}),
    }, { merge: true });
  });
}

export function setAdminArchived(original: DocumentSnapshot, archived: boolean, userId: string) {
  const target = original.ref;
  return runTransaction(target.firestore, async (transaction) => {
    await checkSnapshot(transaction, target, original);
    if (archived && target.parent.id === "generations") {
      const current = await transaction.get(doc(target.parent, "current"));
      if (current.data()?.generationId === target.id) throw new AdminConflict("현재 기수는 보관할 수 없습니다. 먼저 다른 기수를 현재로 설정해 주세요.");
    }
    transaction.update(target, {
      [target.parent.id === "members" ? "visible" : "published"]: false,
      archivedAt: archived ? serverTimestamp() : deleteField(),
      updatedAt: serverTimestamp(), createdBy: deleteField(), updatedBy: deleteField(), archivedBy: deleteField(),
    });
    transaction.set(metadataRef(target), {
      archivedBy: archived ? userId : deleteField(), updatedBy: userId,
    }, { merge: true });
  });
}

export function setAdminCurrent(generation: DocumentSnapshot, originalPointer: DocumentSnapshot | null, userId: string) {
  const pointer = doc(generation.ref.parent, "current");
  return runTransaction(pointer.firestore, async (transaction) => {
    await checkSnapshot(transaction, generation.ref, generation);
    await checkSnapshot(transaction, pointer, originalPointer);
    writeCurrent(transaction, pointer, generation.id, generation.get("label"), userId);
  });
}
