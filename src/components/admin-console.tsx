"use client";

import { useEffect, useState } from "react";
import { GoogleAuthProvider, User, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { adminCollections, AdminCollection, AdminField } from "@/lib/admin-config";
import { auth, db, isFirebaseConfigured } from "@/lib/firebase";

type DocumentRecord = { id: string } & Record<string, unknown>;
type FormValues = Record<string, string | boolean>;

export function AdminConsole() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [checking, setChecking] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!auth || !db) return;
    const activeAuth = auth;
    const activeDb = db;
    return onAuthStateChanged(activeAuth, async (currentUser) => {
      setUser(currentUser);
      setRole(null);
      if (currentUser) {
        const profile = await getDoc(doc(activeDb, "users", currentUser.uid));
        const currentRole = profile.data()?.role;
        if (currentRole === "admin" || currentRole === "editor") setRole(currentRole);
      }
      setChecking(false);
    });
  }, []);

  if (!isFirebaseConfigured) return <SetupState />;
  if (checking) return <AdminState text="권한을 확인하는 중입니다." />;
  if (!user) return <LoginState />;
  if (!role) return <DeniedState user={user} />;

  return <Editor user={user} role={role} />;
}

function LoginState() {
  async function login() {
    if (auth) await signInWithPopup(auth, new GoogleAuthProvider());
  }

  return (
    <section className="admin-gate">
      <p className="eyebrow">Admin only</p>
      <h1>콘텐츠 관리</h1>
      <p>등록된 운영진 Google 계정으로 로그인해 주세요.</p>
      <button className="button" onClick={login}>Google 계정으로 로그인</button>
    </section>
  );
}

function SetupState() {
  return (
    <section className="admin-gate">
      <p className="eyebrow">Setup required</p>
      <h1>Firebase 연결이 필요합니다</h1>
      <p><code>.env.example</code>의 항목을 <code>.env.local</code>에 설정하면 관리자 로그인을 사용할 수 있습니다.</p>
    </section>
  );
}

function DeniedState({ user }: { user: User }) {
  return (
    <section className="admin-gate">
      <p className="eyebrow">Access denied</p>
      <h1>관리 권한이 없습니다</h1>
      <p>{user.email} 계정은 Firestore의 <code>users/{user.uid}</code>에 admin 또는 editor 역할이 필요합니다.</p>
      <button className="button button-secondary" onClick={() => auth && signOut(auth)}>다른 계정으로 로그인</button>
    </section>
  );
}

function AdminState({ text }: { text: string }) {
  return <div className="admin-gate" aria-busy="true">{text}</div>;
}

function Editor({ user, role }: { user: User; role: string }) {
  const [active, setActive] = useState(adminCollections[0]);

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div><span>GDGoC Sahmyook</span><strong>Admin</strong></div>
        <nav aria-label="관리 메뉴">
          {adminCollections.map((item) => (
            <button key={item.name} className={active.name === item.name ? "active" : ""} onClick={() => setActive(item)}>{item.label}</button>
          ))}
        </nav>
        <div className="admin-user"><span>{user.email}</span><small>{role}</small><button onClick={() => auth && signOut(auth)}>로그아웃</button></div>
      </aside>
      <div className="admin-main"><CollectionEditor key={active.name} config={active} /></div>
    </div>
  );
}

function CollectionEditor({ config }: { config: AdminCollection }) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [editing, setEditing] = useState<DocumentRecord | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function load() {
    if (!db) return;
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, config.name));
      setDocuments(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    } finally { setLoading(false); }
  }

  useEffect(() => {
    if (!db) return;
    const activeDb = db;
    getDocs(collection(activeDb, config.name))
      .then((snapshot) => setDocuments(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))))
      .finally(() => setLoading(false));
  }, [config.name]);

  async function remove(item: DocumentRecord) {
    if (!db || !window.confirm(`“${String(item[config.titleField] || item.id)}” 항목을 삭제할까요?`)) return;
    await deleteDoc(doc(db, config.name, item.id));
    setMessage("삭제했습니다.");
    await load();
  }

  return (
    <>
      <header className="admin-heading">
        <div><p className="eyebrow">Content manager</p><h1>{config.label}</h1></div>
        <button className="button" onClick={() => setEditing(null)}>새 {config.singular} 추가</button>
      </header>
      <p className="sr-live" aria-live="polite">{message}</p>
      {editing !== undefined ? (
        <EditorForm config={config} document={editing} onCancel={() => setEditing(undefined)} onSaved={async () => { setEditing(undefined); setMessage("저장했습니다."); await load(); }} />
      ) : loading ? (
        <p aria-busy="true">목록을 불러오는 중입니다.</p>
      ) : documents.length ? (
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>콘텐츠</th><th>ID</th><th>상태</th><th><span className="visually-hidden">작업</span></th></tr></thead><tbody>
          {documents.map((item) => <tr key={item.id}><td><strong>{String(item[config.titleField] || "제목 없음")}</strong></td><td><code>{item.id}</code></td><td>{item.published === false || item.visible === false ? "비공개" : String(item.status || "공개")}</td><td><button onClick={() => setEditing(item)}>수정</button><button className="danger" onClick={() => remove(item)}>삭제</button></td></tr>)}
        </tbody></table></div>
      ) : (
        <div className="empty-state"><h3>등록된 {config.singular}이 없습니다</h3><p>첫 콘텐츠를 추가해 주세요.</p></div>
      )}
    </>
  );
}

function EditorForm({ config, document, onCancel, onSaved }: { config: AdminCollection; document: DocumentRecord | null; onCancel: () => void; onSaved: () => void }) {
  const [documentId, setDocumentId] = useState(document?.id || "");
  const [values, setValues] = useState<FormValues>(() => Object.fromEntries(config.fields.map((field) => [field.name, initialValue(document?.[field.name])] )));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update(name: string, value: string | boolean) { setValues((current) => ({ ...current, [name]: value })); }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db) return;
    setSaving(true);
    setError("");
    const payload = Object.fromEntries(config.fields.map((field) => [field.name, serializeValue(field, values[field.name]) ]));
    try {
      if (document) await setDoc(doc(db, config.name, document.id), { ...payload, updatedAt: serverTimestamp() }, { merge: true });
      else if (documentId.trim()) await setDoc(doc(db, config.name, documentId.trim()), { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      else await addDoc(collection(db, config.name), { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      onSaved();
    } catch { setError("저장하지 못했습니다. 입력값과 Firestore 권한을 확인해 주세요."); setSaving(false); }
  }

  return (
    <form className="admin-form" onSubmit={save}>
      <div className="form-heading"><div><p className="eyebrow">{document ? "Edit" : "New"}</p><h2>{document ? String(document[config.titleField]) : `새 ${config.singular}`}</h2></div><button type="button" onClick={onCancel}>닫기</button></div>
      {!document && <label className="field"><span>문서 ID <small>비워두면 자동 생성</small></span><input value={documentId} onChange={(event) => setDocumentId(event.target.value)} pattern="[A-Za-z0-9가-힣_-]*" /></label>}
      <div className="form-grid">
        {config.fields.map((field) => <AdminInput key={field.name} field={field} value={values[field.name]} onChange={(value) => update(field.name, value)} />)}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><button type="button" className="button button-secondary" onClick={onCancel}>취소</button><button className="button" disabled={saving}>{saving ? "저장 중…" : "변경사항 저장"}</button></div>
    </form>
  );
}

function AdminInput({ field, value, onChange }: { field: AdminField; value: string | boolean; onChange: (value: string | boolean) => void }) {
  const id = `field-${field.name}`;
  if (field.kind === "checkbox") return <label className="check-field"><input id={id} type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} /><span>{field.label}</span></label>;

  return (
    <label className={`field ${field.kind === "textarea" || field.kind === "list" ? "field-wide" : ""}`} htmlFor={id}>
      <span>{field.label}{field.required && <em>필수</em>}</span>
      {field.kind === "textarea" || field.kind === "list" ? <textarea id={id} value={String(value)} required={field.required} rows={field.kind === "textarea" ? 5 : 3} onChange={(event) => onChange(event.target.value)} /> : field.kind === "select" ? <select id={id} value={String(value)} required={field.required} onChange={(event) => onChange(event.target.value)}><option value="">선택</option>{field.options?.map((option) => <option key={option}>{option}</option>)}</select> : <input id={id} type={field.kind === "date" || field.kind === "number" || field.kind === "url" ? field.kind : "text"} value={String(value)} required={field.required} onChange={(event) => onChange(event.target.value)} />}
    </label>
  );
}

function initialValue(value: unknown): string | boolean {
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.join("\n");
  return value == null ? "" : String(value);
}

function serializeValue(field: AdminField, value: string | boolean) {
  if (field.kind === "checkbox") return Boolean(value);
  if (field.kind === "number") return value === "" ? null : Number(value);
  if (field.kind === "list") return String(value).split(/\n|,/).map((item) => item.trim()).filter(Boolean);
  return String(value).trim();
}
