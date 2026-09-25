"use client";

import { useEffect, useState } from "react";
import { GoogleAuthProvider, User, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { adminCollections, AdminCollection, AdminField } from "@/lib/admin-config";
import { auth, db, isFirebaseConfigured } from "@/lib/firebase";
import { useCurrentGeneration } from "@/lib/use-current-generation";

type DocumentRecord = { id: string } & Record<string, unknown>;
type FaqItem = { question: string; answer: string };
type FormValue = string | boolean | FaqItem[];
type FormValues = Record<string, FormValue>;

export function AdminConsole() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [checking, setChecking] = useState(isFirebaseConfigured);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    if (!auth || !db) return;
    const activeAuth = auth;
    const activeDb = db;
    return onAuthStateChanged(activeAuth, async (currentUser) => {
      setUser(currentUser);
      setRole(null);
      setChecking(true);
      setAuthError(false);
      try {
        if (currentUser) {
          const profile = await getDoc(doc(activeDb, "users", currentUser.uid));
          const currentRole = profile.data()?.role;
          if (currentRole === "admin" || currentRole === "editor") setRole(currentRole);
        }
      } catch { setAuthError(true); }
      finally { setChecking(false); }
    });
  }, []);

  if (!isFirebaseConfigured) return <SetupState />;
  if (checking) return <AdminState text="권한을 확인하는 중입니다." />;
  if (!user) return <LoginState />;
  if (authError) return <AdminErrorState user={user} />;
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

function AdminErrorState({ user }: { user: User }) {
  return (
    <section className="admin-gate" role="alert">
      <p className="eyebrow">Connection error</p>
      <h1>권한을 확인하지 못했습니다</h1>
      <p>{user.email} 계정의 Firestore 연결과 보안 규칙을 확인한 뒤 다시 로그인해 주세요.</p>
      <button className="button button-secondary" onClick={() => auth && signOut(auth)}>다시 로그인</button>
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
  const [loadError, setLoadError] = useState("");

  async function load() {
    if (!db) return;
    setLoading(true);
    setLoadError("");
    try {
      const snapshot = await getDocs(collection(db, config.name));
      setDocuments(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    } catch { setLoadError("목록을 불러오지 못했습니다. Firestore 연결과 권한을 확인해 주세요."); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (!db) return;
    let active = true;
    const activeDb = db;
    getDocs(collection(activeDb, config.name))
      .then((snapshot) => active && setDocuments(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))))
      .catch(() => active && setLoadError("목록을 불러오지 못했습니다. Firestore 연결과 권한을 확인해 주세요."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
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
      {loadError && <p className="form-error" role="alert">{loadError}</p>}
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
  const { generation, error: generationError, loading: generationLoading } = useCurrentGeneration();
  const isCurrentRecruitment = config.name === "recruitment" && !document;
  const isSlugDocument = !document && (config.name === "activities" || config.name === "projects");
  const generationUnavailable = isCurrentRecruitment && (generationLoading || generationError);
  const [customDocumentId, setCustomDocumentId] = useState(document?.id || "");
  const [values, setValues] = useState<FormValues>(() => Object.fromEntries(config.fields.map((field) => [field.name, initialValue(field, document?.[field.name])] )));
  const documentId = isCurrentRecruitment ? generation.generationId : isSlugDocument ? String(values.slug || "").trim() : customDocumentId;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update(name: string, value: FormValue) { setValues((current) => ({ ...current, [name]: value })); }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db) return;
    if (generationUnavailable) {
      setError("현재 기수를 확인하지 못해 저장할 수 없습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    if (isSlugDocument && !/^[A-Za-z0-9가-힣_-]+$/.test(documentId)) {
      setError("Slug는 영문, 숫자, 한글, 하이픈(-), 밑줄(_)만 사용할 수 있습니다.");
      return;
    }
    setSaving(true);
    setError("");
    const faq = values.faq;
    if (Array.isArray(faq) && faq.some((item) => Boolean(item.question.trim()) !== Boolean(item.answer.trim()))) {
      setError("FAQ는 질문과 답변을 모두 입력하거나 둘 다 비워 주세요.");
      setSaving(false);
      return;
    }
    const payload = Object.fromEntries(config.fields.map((field) => [field.name, serializeValue(field, values[field.name]) ]));
    try {
      if (document) await setDoc(doc(db, config.name, document.id), { ...payload, updatedAt: serverTimestamp() }, { merge: true });
      else if (documentId.trim()) {
        const target = doc(db, config.name, documentId.trim());
        if ((await getDoc(target)).exists()) {
          setError("같은 문서 ID가 이미 있습니다. 기존 항목을 수정해 주세요.");
          setSaving(false);
          return;
        }
        await setDoc(target, { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      }
      else await addDoc(collection(db, config.name), { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      onSaved();
    } catch { setError("저장하지 못했습니다. 입력값과 Firestore 권한을 확인해 주세요."); setSaving(false); }
  }

  return (
    <form className="admin-form" onSubmit={save}>
      <div className="form-heading"><div><p className="eyebrow">{document ? "Edit" : "New"}</p><h2>{document ? String(document[config.titleField]) : `새 ${config.singular}`}</h2></div><button type="button" onClick={onCancel}>닫기</button></div>
      {!document && <label className="field"><span>문서 ID <small>{isCurrentRecruitment ? generationLoading ? "현재 기수 확인 중" : generationError ? "현재 기수 조회 실패" : "현재 기수 기준" : isSlugDocument ? "Slug에서 자동 생성" : "비워두면 자동 생성"}</small></span><input value={documentId} onChange={(event) => setCustomDocumentId(event.target.value)} pattern="[A-Za-z0-9가-힣_-]*" readOnly={isCurrentRecruitment || isSlugDocument} required={isCurrentRecruitment || isSlugDocument} /></label>}
      {isCurrentRecruitment && generationError && <p className="form-error" role="alert">현재 기수를 불러오지 못했습니다. Firestore 연결을 확인한 뒤 다시 열어 주세요.</p>}
      <div className="form-grid">
        {config.fields.map((field) => <AdminInput key={field.name} field={field} value={values[field.name]} readOnly={Boolean(document && field.name === "slug" && (config.name === "activities" || config.name === "projects"))} onChange={(value) => update(field.name, value)} />)}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><button type="button" className="button button-secondary" onClick={onCancel}>취소</button><button className="button" disabled={saving || generationUnavailable}>{saving ? "저장 중…" : generationLoading && isCurrentRecruitment ? "기수 확인 중…" : "변경사항 저장"}</button></div>
    </form>
  );
}

function AdminInput({ field, value, readOnly = false, onChange }: { field: AdminField; value: FormValue; readOnly?: boolean; onChange: (value: FormValue) => void }) {
  const id = `field-${field.name}`;
  if (field.kind === "checkbox") return <label className="check-field"><input id={id} type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} /><span>{field.label}</span></label>;
  if (field.kind === "faq") return <FaqEditor id={id} label={field.label} items={Array.isArray(value) ? value : []} onChange={onChange} />;

  return (
    <label className={`field ${field.kind === "textarea" || field.kind === "list" ? "field-wide" : ""}`} htmlFor={id}>
      <span>{field.label}{field.required && <em>필수</em>}</span>
      {field.kind === "textarea" || field.kind === "list" ? <textarea id={id} value={String(value)} required={field.required} rows={field.kind === "textarea" ? 5 : 3} onChange={(event) => onChange(event.target.value)} /> : field.kind === "select" ? <select id={id} value={String(value)} required={field.required} onChange={(event) => onChange(event.target.value)}><option value="">선택</option>{field.options?.map((option) => <option key={option}>{option}</option>)}</select> : <input id={id} type={field.kind === "date" || field.kind === "number" || field.kind === "url" ? field.kind : "text"} value={String(value)} required={field.required} readOnly={readOnly} onChange={(event) => onChange(event.target.value)} />}
    </label>
  );
}

function FaqEditor({ id, label, items, onChange }: { id: string; label: string; items: FaqItem[]; onChange: (value: FaqItem[]) => void }) {
  function update(index: number, key: keyof FaqItem, value: string) {
    onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  }

  return (
    <fieldset className="faq-field field-wide">
      <legend>{label}</legend>
      {items.map((item, index) => (
        <div className="faq-editor-row" key={index}>
          <label className="field" htmlFor={`${id}-question-${index}`}><span>질문 {index + 1}</span><input id={`${id}-question-${index}`} value={item.question} onChange={(event) => update(index, "question", event.target.value)} /></label>
          <label className="field" htmlFor={`${id}-answer-${index}`}><span>답변 {index + 1}</span><textarea id={`${id}-answer-${index}`} rows={3} value={item.answer} onChange={(event) => update(index, "answer", event.target.value)} /></label>
          <button type="button" className="faq-remove" onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))} aria-label={`질문 ${index + 1} 삭제`}>삭제</button>
        </div>
      ))}
      <button type="button" className="button button-secondary" onClick={() => onChange([...items, { question: "", answer: "" }])}>질문 추가</button>
    </fieldset>
  );
}

function initialValue(field: AdminField, value: unknown): FormValue {
  if (field.kind === "faq") {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => typeof item === "object" && item !== null
      ? [{ question: String(Reflect.get(item, "question") || ""), answer: String(Reflect.get(item, "answer") || "") }]
      : []);
  }
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.join("\n");
  return value == null ? "" : String(value);
}

function serializeValue(field: AdminField, value: FormValue) {
  if (field.kind === "checkbox") return Boolean(value);
  if (field.kind === "number") return value === "" ? null : Number(value);
  if (field.kind === "list") return String(value).split(/\n|,/).map((item) => item.trim()).filter(Boolean);
  if (field.kind === "faq") return Array.isArray(value) ? value.map((item) => ({ question: item.question.trim(), answer: item.answer.trim() })).filter((item) => item.question && item.answer) : [];
  return String(value).trim();
}
