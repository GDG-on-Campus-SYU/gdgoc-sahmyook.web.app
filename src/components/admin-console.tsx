"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GoogleAuthProvider, User, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { collection, deleteField, doc, getDoc, getDocs, serverTimestamp, writeBatch } from "firebase/firestore";
import { adminCollections, AdminCollection, AdminField } from "@/lib/admin-config";
import { auth, db, isFirebaseConfigured } from "@/lib/firebase";
import { useCurrentGeneration } from "@/lib/use-current-generation";
import { effectiveRecruitmentStatus } from "@/lib/recruitment-status";

type DocumentRecord = { id: string } & Record<string, unknown>;
type FaqItem = { question: string; answer: string };
type GenerationHistoryItem = { generationId: string; role: string; position: string };
type FormValue = string | boolean | FaqItem[] | GenerationHistoryItem[] | string[];
type FormValues = Record<string, FormValue>;
type GenerationOption = { id: string; label: string; order?: number };

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
  const [error, setError] = useState("");

  async function login() {
    if (!auth) return;
    setError("");
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch { setError("로그인하지 못했습니다. 팝업 차단과 Google 로그인 설정을 확인해 주세요."); }
  }

  return (
    <section className="admin-gate">
      <p className="eyebrow">Admin only</p>
      <h1>콘텐츠 관리</h1>
      <p>등록된 운영진 Google 계정으로 로그인해 주세요.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
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
  const [dirty, setDirty] = useState(false);

  function leave(action: () => void) {
    if (dirty && !window.confirm("저장하지 않은 변경사항을 버릴까요?")) return;
    setDirty(false);
    action();
  }

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div><span>GDGoC Sahmyook</span><strong>Admin</strong></div>
        <nav aria-label="관리 메뉴">
          {adminCollections.map((item) => (
            <button key={item.name} className={active.name === item.name ? "active" : ""} aria-current={active.name === item.name ? "page" : undefined} onClick={() => item.name !== active.name && leave(() => setActive(item))}>{item.label}</button>
          ))}
        </nav>
        <div className="admin-user"><span>{user.email}</span><small>{role}</small><button onClick={() => leave(() => { if (auth) void signOut(auth); })}>로그아웃</button></div>
      </aside>
      <div className="admin-main"><CollectionEditor key={active.name} config={active} userId={user.uid} dirty={dirty} onDirtyChange={setDirty} /></div>
    </div>
  );
}

function CollectionEditor({ config, userId, dirty, onDirtyChange }: { config: AdminCollection; userId: string; dirty: boolean; onDirtyChange: (dirty: boolean) => void }) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [editing, setEditing] = useState<DocumentRecord | null | undefined>(undefined);
  const returnFocusKey = useRef("new");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const publicField = config.name === "members" ? "visible" : "published";
  const currentGeneration = config.name === "generations" ? documents.find((item) => item.id === "current") : undefined;
  const editableDocuments = config.name === "generations" ? documents.filter((item) => item.id !== "current") : documents;
  const filteredDocuments = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("ko");
    const editable = config.name === "generations" ? documents.filter((item) => item.id !== "current") : documents;
    return [...editable]
      .filter((item) => !needle || `${String(item[config.titleField] || "")} ${item.id}`.toLocaleLowerCase("ko").includes(needle))
      .sort((a, b) => String(a[config.titleField] || "").localeCompare(String(b[config.titleField] || ""), "ko"));
  }, [config.name, config.titleField, documents, search]);

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

  function openEditor(document: DocumentRecord | null, focusKey: string) {
    if (dirty && !window.confirm("저장하지 않은 변경사항을 버릴까요?")) return;
    onDirtyChange(false);
    returnFocusKey.current = focusKey;
    setEditing(document);
  }

  function closeEditor() {
    onDirtyChange(false);
    setEditing(undefined);
    requestAnimationFrame(() => {
      Array.from(document.querySelectorAll<HTMLButtonElement>("[data-focus-key]"))
        .find((button) => button.dataset.focusKey === returnFocusKey.current)
        ?.focus();
    });
  }

  async function archive(item: DocumentRecord) {
    if (!db || !window.confirm(`“${String(item[config.titleField] || item.id)}” 항목을 보관 처리할까요? 공개 화면에서는 즉시 숨겨집니다.`)) return;
    if (config.name === "generations" && currentGeneration?.generationId === item.id) {
      setLoadError("현재 기수는 보관할 수 없습니다. 다른 기수를 현재로 설정한 뒤 다시 시도해 주세요.");
      return;
    }
    setLoadError("");
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, config.name, item.id), {
        [publicField]: false,
        archivedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: deleteField(),
        updatedBy: deleteField(),
        archivedBy: deleteField(),
      });
      batch.set(doc(db, "internalMetadata", config.name, "documents", item.id), { archivedBy: userId, updatedBy: userId }, { merge: true });
      await batch.commit();
      setMessage("보관 처리했습니다.");
      await load();
    } catch { setLoadError("보관 처리하지 못했습니다. Firestore 권한과 문서 필드를 확인해 주세요."); }
  }

  async function restore(item: DocumentRecord) {
    if (!db) return;
    setLoadError("");
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, config.name, item.id), {
        [publicField]: false,
        archivedAt: deleteField(),
        updatedAt: serverTimestamp(),
        createdBy: deleteField(),
        updatedBy: deleteField(),
        archivedBy: deleteField(),
      });
      batch.set(doc(db, "internalMetadata", config.name, "documents", item.id), { archivedBy: deleteField(), updatedBy: userId }, { merge: true });
      await batch.commit();
      setMessage("비공개 초안으로 복원했습니다.");
      await load();
    } catch { setLoadError("복원하지 못했습니다. Firestore 권한과 문서 필드를 확인해 주세요."); }
  }

  async function setCurrent(item: DocumentRecord) {
    if (!db) return;
    if (item.published !== true || item.archivedAt) {
      setLoadError("공개된 기수만 현재 기수로 설정할 수 있습니다.");
      return;
    }
    setLoadError("");
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, "generations", "current"), {
        generationId: item.id,
        label: String(item.label || item.id),
        published: true,
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, "internalMetadata", "generations", "documents", "current"), { updatedBy: userId }, { merge: true });
      await batch.commit();
      setMessage("현재 기수를 변경했습니다.");
      await load();
    } catch { setLoadError("현재 기수를 변경하지 못했습니다. Firestore 권한을 확인해 주세요."); }
  }

  return (
    <>
      <header className="admin-heading">
        <div><p className="eyebrow">Content manager</p><h1>{config.label}</h1></div>
        <button className="button" data-focus-key="new" onClick={() => openEditor(null, "new")}>새 {config.singular} 추가</button>
      </header>
      <p className="sr-live" aria-live="polite">{message}</p>
      {loadError && <p className="form-error" role="alert">{loadError}</p>}
      {config.name === "generations" && <p className="admin-current-generation">현재 기수: <strong>{String(currentGeneration?.label || currentGeneration?.generationId || "미설정")}</strong></p>}
      {editing !== undefined ? (
        <EditorForm config={config} document={editing} userId={userId} onCancel={closeEditor} onSaved={async () => { closeEditor(); setMessage("저장했습니다."); await load(); }} onDirtyChange={onDirtyChange} />
      ) : loading ? (
        <p aria-busy="true">목록을 불러오는 중입니다.</p>
      ) : editableDocuments.length ? (
        <>
          <label className="admin-search"><span>목록 검색</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="제목 또는 문서 ID" /></label>
          {filteredDocuments.length ? (
            <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>콘텐츠</th><th>ID</th><th>공개</th><th>상태</th><th>수정일</th><th><span className="visually-hidden">작업</span></th></tr></thead><tbody>
              {filteredDocuments.map((item) => {
                const archived = Boolean(item.archivedAt);
                return <tr key={item.id}><td><strong>{String(item[config.titleField] || "제목 없음")}</strong></td><td><code>{item.id}</code></td><td>{archived ? "보관됨" : item[publicField] === true ? "공개" : "비공개"}</td><td>{String(item.status || item.role || (config.name === "generations" && currentGeneration?.generationId === item.id ? "현재" : "-"))}</td><td>{formatTimestamp(item.updatedAt)}</td><td>{config.name === "generations" && !archived && item.published === true && currentGeneration?.generationId !== item.id && <button onClick={() => setCurrent(item)}>현재로 설정</button>}<button data-focus-key={`edit:${item.id}`} onClick={() => openEditor(item, `edit:${item.id}`)}>수정</button>{archived ? <button onClick={() => restore(item)}>복원</button> : <button className="danger" onClick={() => archive(item)}>보관</button>}</td></tr>;
              })}
            </tbody></table></div>
          ) : <div className="empty-state"><h2>검색 결과가 없습니다</h2><p>다른 검색어를 입력해 주세요.</p></div>}
        </>
      ) : (
        <div className="empty-state"><h2>등록된 {config.singular}이 없습니다</h2><p>첫 콘텐츠를 추가해 주세요.</p></div>
      )}
    </>
  );
}

function EditorForm({ config, document, userId, onCancel, onSaved, onDirtyChange }: { config: AdminCollection; document: DocumentRecord | null; userId: string; onCancel: () => void; onSaved: () => void; onDirtyChange: (dirty: boolean) => void }) {
  const { generation, error: generationError, loading: generationLoading } = useCurrentGeneration();
  const isCurrentRecruitment = config.name === "recruitment" && !document;
  const isSlugDocument = !document && (config.name === "activities" || config.name === "projects");
  const hasGenerationSelect = config.name === "activities" || config.name === "projects";
  const needsDocumentId = !document && config.name === "generations";
  const generationUnavailable = isCurrentRecruitment && (generationLoading || generationError);
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [customDocumentId, setCustomDocumentId] = useState(document?.id || "");
  const initialValues = useMemo<FormValues>(() => Object.fromEntries(config.fields.map((field) => [field.name, initialValue(field, documentValue(field, document))])), [config.fields, document]);
  const [values, setValues] = useState<FormValues>(initialValues);
  const [generationOptions, setGenerationOptions] = useState<GenerationOption[]>([]);
  const [generationOptionsError, setGenerationOptionsError] = useState(false);
  const documentId = isCurrentRecruitment ? generation.generationId : isSlugDocument ? String(values.slug || "").trim() : customDocumentId;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState("");
  const dirty = JSON.stringify(values) !== JSON.stringify(initialValues) || customDocumentId !== (document?.id || "");
  const availableGenerationOptions = useMemo(() => {
    const options = new Map(generationOptions.map((item) => [item.id, item.label]));
    const selected = values.activityGenerations;
    if (Array.isArray(selected)) for (const id of selected) if (typeof id === "string" && !options.has(id)) options.set(id, `${id} (기존 값)`);
    const legacyGeneration = values.generation;
    if (hasGenerationSelect && typeof legacyGeneration === "string" && legacyGeneration && !options.has(legacyGeneration)) options.set(legacyGeneration, `${legacyGeneration} (기존 값)`);
    return [...options].map(([id, label]) => ({ id, label }));
  }, [generationOptions, hasGenerationSelect, values.activityGenerations, values.generation]);

  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>("input:not([readonly]), select, textarea, button")?.focus();
  }, []);

  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (!db || !["members", "activities", "projects"].includes(config.name)) return;
    let active = true;
    getDocs(collection(db, "generations"))
      .then((snapshot) => {
        if (!active) return;
        const options: GenerationOption[] = [];
        for (const item of snapshot.docs) {
          if (item.id === "current") continue;
          const data = item.data();
          if (data.published !== true || data.archivedAt) continue;
          options.push({ id: item.id, label: typeof data.label === "string" && data.label.trim() ? data.label : item.id, order: typeof data.order === "number" ? data.order : 999 });
        }
        setGenerationOptions(options.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.label.localeCompare(b.label, "ko")));
      })
      .catch(() => active && setGenerationOptionsError(true));
    return () => { active = false; };
  }, [config.name]);

  function update(name: string, value: FormValue) {
    const selectedGenerations = name === "activityGenerations" && Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : null;
    setValues((current) => ({ ...current, [name]: value, ...(selectedGenerations ? { generationHistory: (current.generationHistory as GenerationHistoryItem[]).filter((item) => selectedGenerations.includes(item.generationId)) } : {}) }));
    if (errorField === name) { setError(""); setErrorField(""); }
  }

  function fail(message: string, field = "") {
    setError(message);
    setErrorField(field);
  }

  function cancel() {
    if (!dirty || window.confirm("저장하지 않은 변경사항을 버릴까요?")) onCancel();
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db) return;
    if (generationUnavailable) {
      fail("현재 기수를 확인하지 못해 저장할 수 없습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    if ((isSlugDocument || needsDocumentId) && !/^[A-Za-z0-9가-힣_-]+$/.test(documentId)) {
      fail(`${isSlugDocument ? "Slug" : "문서 ID"}는 영문, 숫자, 한글, 하이픈(-), 밑줄(_)만 사용할 수 있습니다.`, isSlugDocument ? "slug" : "documentId");
      return;
    }
    setError("");
    setErrorField("");
    const startDate = String(values.startDate || "");
    const endDate = String(values.endDate || "");
    if (startDate && endDate && endDate < startDate) {
      fail("종료일은 시작일보다 빠를 수 없습니다.", "endDate");
      return;
    }
    for (const field of config.fields.filter((item) => item.kind === "url")) {
      const value = String(values[field.name] || "");
      if (value && !safeHttpUrl(value)) {
        fail(`${field.label}은 http 또는 https URL이어야 합니다.`, field.name);
        return;
      }
    }
    if (config.name === "recruitment" && values.status === "open" && !String(values.applyUrl || "").trim()) {
      fail("모집 상태가 open이면 지원 URL이 필요합니다.", "applyUrl");
      return;
    }
    if (config.name === "members" && (!Array.isArray(values.activityGenerations) || values.activityGenerations.length === 0)) {
      fail("활동 기수를 하나 이상 선택해 주세요.", "activityGenerations");
      return;
    }
    if (config.name === "members") {
      const selected = values.activityGenerations as string[];
      const history = values.generationHistory as GenerationHistoryItem[];
      const previous = Array.isArray(document?.activityGenerations) ? document.activityGenerations : typeof document?.generation === "string" ? [document.generation] : [];
      if (selected.filter((id) => !previous.includes(id)).some((id) => !history.some((item) => item.generationId === id && item.role))) {
        fail("새로 추가한 활동 기수마다 당시 역할을 선택해 주세요.", "generationHistory");
        return;
      }
      if (history.some((item) => item.position.trim() && !item.role)) {
        fail("담당 분야를 입력한 기수에는 역할도 선택해 주세요.", "generationHistory");
        return;
      }
    }
    if (hasGenerationSelect && !generationOptions.some((item) => item.id === values.generation) && values.generation !== document?.generation) {
      fail("등록된 기수를 선택해 주세요. 기수 목록을 불러오지 못했다면 다시 시도해 주세요.", "generation");
      return;
    }
    const faq = values.faq as FaqItem[] | undefined;
    if (Array.isArray(faq) && faq.some((item) => typeof item !== "string" && Boolean(item.question.trim()) !== Boolean(item.answer.trim()))) {
      fail("FAQ는 질문과 답변을 모두 입력하거나 둘 다 비워 주세요.", "faq");
      return;
    }
    setSaving(true);
    const payload: Record<string, unknown> = Object.fromEntries(config.fields
      .map((field) => [field.name, serializeValue(field, values[field.name])])
      .filter((entry) => entry[1] !== undefined));
    try {
      if (config.name === "members" && typeof payload.github === "string" && payload.github) {
        const github = normalizeGithub(payload.github);
        const duplicate = (await getDocs(collection(db, "members"))).docs.find((item) => item.id !== document?.id && normalizeGithub(String(item.data().github || "")) === github);
        if (duplicate) {
          fail("같은 GitHub 프로필을 사용하는 구성원이 이미 있습니다.", "github");
          setSaving(false);
          return;
        }
      }
      const target = document ? doc(db, config.name, document.id) : documentId.trim()
        ? doc(db, config.name, documentId.trim()) : doc(collection(db, config.name));
      if (!document && documentId.trim()) {
        if ((await getDoc(target)).exists()) {
          fail("같은 문서 ID가 이미 있습니다. 기존 항목을 수정해 주세요.", isSlugDocument ? "slug" : "documentId");
          setSaving(false);
          return;
        }
      }
      const batch = writeBatch(db);
      batch.set(target, document ? {
        ...payload, updatedAt: serverTimestamp(), createdBy: deleteField(), updatedBy: deleteField(), archivedBy: deleteField(),
        ...(config.name === "members" ? { consentConfirmedAt: deleteField(), consentConfirmedBy: deleteField() } : {}),
      } : { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: Boolean(document) });
      batch.set(doc(db, "internalMetadata", config.name, "documents", target.id), {
        updatedBy: userId,
        ...(!document ? { createdBy: userId } : {}),
        ...(config.name === "members" && payload.visible === true && !document?.visible
          ? { consentConfirmedAt: serverTimestamp(), consentConfirmedBy: userId } : {}),
      }, { merge: true });
      await batch.commit();
      onSaved();
    } catch { fail("저장하지 못했습니다. 입력값과 Firestore 권한을 확인해 주세요."); setSaving(false); }
  }

  const recruitmentPreview = config.name === "recruitment"
    ? effectiveRecruitmentStatus({ status: values.status as "upcoming" | "open" | "closed", startDate: String(values.startDate || ""), endDate: String(values.endDate || "") })
    : null;

  return (
    <form className="admin-form" onSubmit={save} ref={formRef} aria-describedby={error ? "admin-form-error" : undefined}>
      <div className="form-heading"><div><p className="eyebrow">{document ? "Edit" : "New"}</p><h2>{document ? String(document[config.titleField]) : `새 ${config.singular}`}</h2></div><button type="button" onClick={cancel}>닫기</button></div>
      {!document && <label className="field"><span>문서 ID <small>{isCurrentRecruitment ? generationLoading ? "현재 기수 확인 중" : generationError ? "현재 기수 조회 실패" : "현재 기수 기준" : isSlugDocument ? "Slug에서 자동 생성" : needsDocumentId ? "고유한 기수 ID" : "비워두면 자동 생성"}</small></span><input value={documentId} onChange={(event) => { setCustomDocumentId(event.target.value); if (errorField === "documentId") { setError(""); setErrorField(""); } }} pattern="[A-Za-z0-9가-힣_-]*" readOnly={isCurrentRecruitment || isSlugDocument} required={isCurrentRecruitment || isSlugDocument || needsDocumentId} aria-invalid={errorField === "documentId" || undefined} aria-describedby={errorField === "documentId" ? "admin-form-error" : undefined} /></label>}
      {isCurrentRecruitment && generationError && <p className="form-error" role="alert">현재 기수를 불러오지 못했습니다. Firestore 연결을 확인한 뒤 다시 열어 주세요.</p>}
      {generationOptionsError && <p className="form-error" role="alert">기수 목록을 불러오지 못했습니다. 기존 선택은 유지할 수 있지만 새 기수는 선택할 수 없습니다.</p>}
      <div className="form-grid">
        {config.fields.map((field) => <AdminInput key={field.name} field={field} value={values[field.name]} generationOptions={availableGenerationOptions} selectedGenerations={Array.isArray(values.activityGenerations) ? values.activityGenerations.filter((item): item is string => typeof item === "string") : []} readOnly={Boolean(document && field.name === "slug" && (config.name === "activities" || config.name === "projects"))} invalid={errorField === field.name} onChange={(value) => update(field.name, value)} />)}
      </div>
      {recruitmentPreview && <p className="admin-status-preview">공개 화면 예상 상태: <strong>{recruitmentPreview === "open" ? "모집 중" : recruitmentPreview === "upcoming" ? "모집 예정" : "모집 종료"}</strong> (한국시간 날짜 기준)</p>}
      {error && <p className="form-error" id="admin-form-error" role="alert" tabIndex={-1} ref={errorRef}>{error}</p>}
      <div className="form-actions"><button type="button" className="button button-secondary" onClick={cancel}>취소</button><button className="button" disabled={saving || generationUnavailable}>{saving ? "저장 중…" : generationLoading && isCurrentRecruitment ? "기수 확인 중…" : "변경사항 저장"}</button></div>
    </form>
  );
}

function AdminInput({ field, value, generationOptions, selectedGenerations, readOnly = false, invalid = false, onChange }: { field: AdminField; value: FormValue; generationOptions: GenerationOption[]; selectedGenerations: string[]; readOnly?: boolean; invalid?: boolean; onChange: (value: FormValue) => void }) {
  const id = `field-${field.name}`;
  if (field.kind === "checkbox") return <label className="check-field"><input id={id} type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} /><span>{field.label}</span></label>;
  if (field.kind === "faq") return <FaqEditor id={id} label={field.label} items={Array.isArray(value) ? value.filter((item): item is FaqItem => typeof item !== "string") : []} invalid={invalid} onChange={onChange} />;
  if (field.kind === "generation-history") {
    const history = Array.isArray(value) ? value.filter(isGenerationHistoryItem) : [];
    function updateHistory(generationId: string, key: "role" | "position", next: string) {
      const existing = history.find((item) => item.generationId === generationId) || { generationId, role: "", position: "" };
      onChange([...history.filter((item) => item.generationId !== generationId), { ...existing, [key]: next }]);
    }
    return <fieldset className="generation-history field-wide" aria-invalid={invalid || undefined} aria-describedby={invalid ? "admin-form-error" : undefined}>
      <legend>{field.label}</legend>
      <p>확인된 당시 역할만 입력하세요. 비워 둔 과거 역할은 공개 화면에서 추정하지 않습니다.</p>
      {selectedGenerations.map((generationId) => {
        const entry = history.find((item) => item.generationId === generationId);
        const label = generationOptions.find((item) => item.id === generationId)?.label || generationId;
        return <div className="generation-history-row" key={generationId}>
          <strong>{label}</strong>
          <label className="field"><span>당시 역할</span><select value={entry?.role || ""} onChange={(event) => updateHistory(generationId, "role", event.target.value)}><option value="">미확인</option><option value="Organizer">Organizer</option><option value="Team Member">Team Member</option><option value="Member">Member</option></select></label>
          <label className="field"><span>당시 담당 분야</span><input value={entry?.position || ""} onChange={(event) => updateHistory(generationId, "position", event.target.value)} /></label>
        </div>;
      })}
      {!selectedGenerations.length && <p>먼저 활동 기수를 선택해 주세요.</p>}
    </fieldset>;
  }
  if (field.kind === "generation-list" || field.kind === "multi-select") {
    const options = field.kind === "generation-list" ? generationOptions : (field.options || []).map((option) => ({ id: option, label: option }));
    const selected = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
    return <fieldset className="choice-field field-wide" aria-invalid={invalid || undefined} aria-describedby={invalid ? "admin-form-error" : undefined}><legend>{field.label}{field.required && <em>필수</em>}</legend>{options.map((option) => <label key={option.id}><input type="checkbox" checked={selected.includes(option.id)} onChange={(event) => onChange(event.target.checked ? [...selected, option.id] : selected.filter((item) => item !== option.id))} /><span>{option.label}</span></label>)}</fieldset>;
  }

  return (
    <label className={`field ${field.kind === "textarea" || field.kind === "list" ? "field-wide" : ""}`} htmlFor={id}>
      <span>{field.label}{field.required && <em>필수</em>}</span>
      {field.kind === "textarea" || field.kind === "list" ? <textarea id={id} value={String(value)} required={field.required} rows={field.kind === "textarea" ? 5 : 3} aria-invalid={invalid || undefined} aria-describedby={invalid ? "admin-form-error" : undefined} onChange={(event) => onChange(event.target.value)} /> : field.kind === "select" ? <select id={id} value={String(value)} required={field.required} aria-invalid={invalid || undefined} aria-describedby={invalid ? "admin-form-error" : undefined} onChange={(event) => onChange(event.target.value)}><option value="">선택</option>{(field.name === "generation" ? generationOptions : (field.options || []).map((option) => ({ id: option, label: option }))).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select> : <input id={id} type={field.kind === "date" || field.kind === "number" || field.kind === "url" ? field.kind : "text"} value={String(value)} required={field.required} readOnly={readOnly} aria-invalid={invalid || undefined} aria-describedby={invalid ? "admin-form-error" : undefined} onChange={(event) => onChange(event.target.value)} />}
    </label>
  );
}

function FaqEditor({ id, label, items, invalid, onChange }: { id: string; label: string; items: FaqItem[]; invalid: boolean; onChange: (value: FaqItem[]) => void }) {
  function update(index: number, key: keyof FaqItem, value: string) {
    onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  }

  return (
    <fieldset className="faq-field field-wide" aria-invalid={invalid || undefined} aria-describedby={invalid ? "admin-form-error" : undefined}>
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
  if (field.kind === "generation-history") return Array.isArray(value) ? value.flatMap((item) =>
    typeof item === "object" && item !== null && typeof Reflect.get(item, "generationId") === "string"
      ? [{ generationId: String(Reflect.get(item, "generationId")), role: String(Reflect.get(item, "role") || ""), position: String(Reflect.get(item, "position") || "") }]
      : []) : [];
  if (field.kind === "generation-list") return Array.isArray(value) ? value.map(String) : [];
  if (field.kind === "multi-select") return Array.isArray(value) ? value.map(String).filter((item) => field.options?.includes(item)) : [];
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.join("\n");
  return value == null ? "" : String(value);
}

function serializeValue(field: AdminField, value: FormValue) {
  if (field.kind === "checkbox") return Boolean(value);
  if (field.kind === "number") return value === "" ? undefined : Number(value);
  if (field.kind === "list") return String(value).split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  if (field.kind === "generation-history") return Array.isArray(value) ? value.filter(isGenerationHistoryItem).filter((item) => item.role).map((item) => ({ generationId: item.generationId, role: item.role, position: item.position.trim() })) : [];
  if (field.kind === "generation-list" || field.kind === "multi-select") return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item)) : [];
  if (field.kind === "faq") return Array.isArray(value) ? value.filter((item): item is FaqItem => typeof item !== "string").map((item) => ({ question: item.question.trim(), answer: item.answer.trim() })).filter((item) => item.question && item.answer) : [];
  return String(value).trim();
}

function isGenerationHistoryItem(value: string | FaqItem | GenerationHistoryItem): value is GenerationHistoryItem {
  return typeof value === "object" && value !== null && "generationId" in value;
}

function documentValue(field: AdminField, document: DocumentRecord | null) {
  if (field.name === "activityGenerations") {
    if (Array.isArray(document?.activityGenerations)) return document.activityGenerations;
    if (typeof document?.generation === "string" && document.generation) return [document.generation];
  }
  return document?.[field.name];
}

function safeHttpUrl(value: string) {
  try { return ["http:", "https:"].includes(new URL(value).protocol); }
  catch { return false; }
}

function normalizeGithub(value: string) {
  try {
    const url = new URL(value);
    return url.hostname.replace(/^www\./, "").toLowerCase() === "github.com" ? url.pathname.replace(/^\/+|\/+$/g, "").toLowerCase() : "";
  } catch { return ""; }
}

function formatTimestamp(value: unknown) {
  if (!value || typeof value !== "object") return "-";
  const seconds = Reflect.get(value, "seconds");
  if (typeof seconds === "number") return new Date(seconds * 1000).toLocaleDateString("ko-KR");
  return "-";
}
