"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { GoogleAuthProvider, User, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { collection, deleteField, doc, getDocFromServer, getDocs, getDocsFromServer, type DocumentSnapshot } from "firebase/firestore";
import { adminCollections, AdminCollection, AdminField } from "@/lib/admin-config";
import { AdminConflict, saveAdminDocument, setAdminArchived, setAdminCurrent } from "@/lib/admin-writes";
import { auth } from "@/lib/admin-auth";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { loadCurrentGeneration } from "@/lib/use-current-generation";
import { archiveHref } from "@/lib/public-archive";
import { isHttpUrl, parseActivityLinks, readLinkTitles } from "@/lib/activity-links";
import { effectiveRecruitmentStatus, recruitmentStatusLabels, validRecruitmentEndTime, type RecruitmentSchedule } from "@/lib/recruitment-status";
import { useRecruitmentNow } from "@/lib/use-recruitment-now";

type DocumentRecord = { id: string; snapshot: DocumentSnapshot } & Record<string, unknown>;
type FaqItem = { question: string; answer: string };
type GenerationHistoryItem = { generationId: string; role: string; position: string };
type FormValue = string | boolean | FaqItem[] | GenerationHistoryItem[] | string[];
type FormValues = Record<string, FormValue>;
type GenerationOption = { id: string; label: string; order?: number };
const visibilityLabels = {
  all: "전체",
  published: "공개",
  private: "비공개",
  archived: "보관됨",
} as const;
type Visibility = Exclude<keyof typeof visibilityLabels, "all">;

function contentVisibility(item: DocumentRecord, publicField: string): Visibility {
  if (item.archivedAt) return "archived";
  return item[publicField] === true ? "published" : "private";
}

function AdminBrand() {
  return <div className="admin-brand">
    <Image src="/brand/gdgoc-symbol-transparent.png" alt="" width={40} height={40} />
    <div><strong>콘텐츠 관리</strong><span>GDGOC Sahmyook</span></div>
  </div>;
}

export function AdminConsole() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [checking, setChecking] = useState(isFirebaseConfigured);
  const [authError, setAuthError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!auth || !db) return;
    const activeAuth = auth;
    const activeDb = db;
    let version = 0;
    const unsubscribe = onAuthStateChanged(activeAuth, async (currentUser) => {
      const request = ++version;
      setUser(currentUser);
      setRole(null);
      setChecking(true);
      setAuthError(false);
      try {
        if (currentUser) {
          const profile = await getDocFromServer(doc(activeDb, "users", currentUser.uid));
          if (request !== version) return;
          const currentRole = profile.data()?.role;
          if (currentRole === "admin" || currentRole === "editor") setRole(currentRole);
        }
      } catch { if (request === version) setAuthError(true); }
      finally { if (request === version) setChecking(false); }
    });
    return () => { ++version; unsubscribe(); };
  }, [attempt]);

  if (!isFirebaseConfigured) return <SetupState />;
  if (checking) return <AdminState text="권한을 확인하는 중입니다." />;
  if (!user) return <LoginState />;
  if (authError) return <AdminErrorState user={user} onRetry={() => { setChecking(true); setAttempt((value) => value + 1); }} />;
  if (!role) return <DeniedState user={user} />;

  return <Editor key={user.uid} user={user} role={role} />;
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
      <div className="admin-login-card">
        <AdminBrand />
        <h1>운영진 로그인</h1>
        <p>등록된 운영진 Google 계정으로 로그인해 주세요.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button" onClick={login}>Google 계정으로 로그인</button>
      </div>
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

function AdminErrorState({ user, onRetry }: { user: User; onRetry: () => void }) {
  return (
    <section className="admin-gate" role="alert">
      <p className="eyebrow">Connection error</p>
      <h1>권한을 확인하지 못했습니다</h1>
      <p>{user.email} 계정의 권한을 확인할 수 없습니다. 연결을 확인한 뒤 다시 시도해 주세요.</p>
      <div className="button-row"><button className="button" onClick={onRetry}>권한 다시 확인</button><button className="button button-secondary" onClick={() => auth && signOut(auth)}>다른 계정으로 로그인</button></div>
    </section>
  );
}

function AdminState({ text }: { text: string }) {
  return <div className="admin-gate" aria-busy="true">{text}</div>;
}

function Editor({ user, role }: { user: User; role: string }) {
  const [active, setActive] = useState(adminCollections[0]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  function leave(action: () => void) {
    if (saving) return;
    if (dirty && !window.confirm("저장하지 않은 변경사항을 버릴까요?")) return;
    setDirty(false);
    action();
  }

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <AdminBrand />
        <nav aria-label="관리 메뉴">
          {adminCollections.map((item) => (
            <button key={item.name} disabled={saving} className={active.name === item.name ? "active" : ""} aria-current={active.name === item.name ? "page" : undefined} onClick={() => item.name !== active.name && leave(() => setActive(item))}>{item.label}</button>
          ))}
        </nav>
        <div className="admin-user">
          <a href="/" target="_blank" rel="noopener noreferrer">공개 사이트 <span aria-hidden="true">↗</span></a>
          <div className="admin-account"><span>{user.email}</span><small>{role === "admin" ? "관리자" : "편집자"}</small><button disabled={saving} onClick={() => leave(() => { if (auth) void signOut(auth); })}>로그아웃</button></div>
        </div>
      </aside>
      <div className="admin-main"><CollectionEditor key={active.name} config={active} userId={user.uid} dirty={dirty} onDirtyChange={setDirty} saving={saving} onSavingChange={setSaving} /></div>
    </div>
  );
}

type SaveState = { saving: boolean; onSavingChange: (saving: boolean) => void };

function CollectionEditor({ config, userId, dirty, onDirtyChange, saving, onSavingChange }: { config: AdminCollection; userId: string; dirty: boolean; onDirtyChange: (dirty: boolean) => void } & SaveState) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [editing, setEditing] = useState<DocumentRecord | null | undefined>(undefined);
  const [formSession, setFormSession] = useState(0);
  const returnFocusKey = useRef("new");
  const restoreFocus = useRef(false);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [message, setMessage] = useState("");
  const [publicHref, setPublicHref] = useState("");
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [changing, setChanging] = useState(false);
  const [search, setSearch] = useState("");
  const [visibility, setVisibility] = useState<keyof typeof visibilityLabels>("all");
  const [recruitmentGeneration, setRecruitmentGeneration] = useState("");
  const [editingGeneration, setEditingGeneration] = useState("");
  const publicField = config.name === "members" ? "visible" : "published";
  const currentGeneration = config.name === "generations" ? documents.find((item) => item.id === "current") : undefined;
  const currentCatalog = currentGeneration && documents.find((item) => item.id === currentGeneration.generationId);
  const editableDocuments = config.name === "generations" ? documents.filter((item) => item.id !== "current") : documents;
  const currentRecruitment = config.name === "recruitment" ? documents.find((item) => item.id === recruitmentGeneration) : undefined;
  const schedules = useMemo(() => config.name === "recruitment" ? documents.map(recruitmentSchedule) : [], [config.name, documents]);
  const now = useRecruitmentNow(schedules);
  const filteredDocuments = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("ko");
    const editable = config.name === "generations" ? documents.filter((item) => item.id !== "current") : documents;
    return [...editable]
      .filter((item) => visibility === "all" || contentVisibility(item, publicField) === visibility)
      .filter((item) => !needle || `${String(item[config.titleField] || "")} ${item.id}`.toLocaleLowerCase("ko").includes(needle))
      .sort((a, b) => String(a[config.titleField] || "").localeCompare(String(b[config.titleField] || ""), "ko"));
  }, [config.name, config.titleField, documents, publicField, search, visibility]);

  function load() {
    setLoading(true);
    setLoadError("");
    setLoadAttempt((value) => value + 1);
  }

  useEffect(() => {
    if (!db) return;
    let active = true;
    const activeDb = db;
    Promise.all([
      getDocsFromServer(collection(activeDb, config.name)),
      config.name === "recruitment" ? loadCurrentGeneration() : null,
    ])
      .then(([snapshot, generation]) => {
        if (!active) return;
        setDocuments(snapshot.docs.map((item) => ({ ...item.data(), id: item.id, snapshot: item })));
        setRecruitmentGeneration(generation?.generationId ?? "");
        setLoaded(true);
      })
      .catch(() => active && setLoadError("목록을 불러오지 못했습니다. Firestore 연결과 권한을 확인해 주세요."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [config.name, loadAttempt]);

  function openEditor(document: DocumentRecord | null, focusKey: string) {
    if (saving) return;
    if (dirty && !window.confirm("저장하지 않은 변경사항을 버릴까요?")) return;
    onDirtyChange(false);
    setMessage("");
    setPublicHref("");
    setActionError("");
    setEditingGeneration(recruitmentGeneration);
    returnFocusKey.current = focusKey;
    setFormSession((value) => value + 1);
    setEditing(document);
  }

  function closeEditor() {
    onDirtyChange(false);
    restoreFocus.current = true;
    setEditing(undefined);
  }

  useEffect(() => {
    if (!restoreFocus.current || editing !== undefined || loading) return;
    restoreFocus.current = false;
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-focus-key]"));
    (buttons.find((button) => button.dataset.focusKey === returnFocusKey.current) ?? buttons.find((button) => button.dataset.focusKey === "new"))?.focus();
  }, [editing, loading]);

  async function changeArchive(item: DocumentRecord, archived: boolean) {
    if (changing) return;
    if (archived && !window.confirm(`“${String(item[config.titleField] || item.id)}” 항목을 보관 처리할까요? 공개 화면에서는 즉시 숨겨집니다.`)) return;
    setActionError("");
    setPublicHref("");
    setChanging(true);
    try {
      await setAdminArchived(item.snapshot, archived, userId);
      setMessage(archived ? "보관 처리했습니다." : "비공개 초안으로 복원했습니다.");
      load();
    } catch (error) {
      if (error instanceof AdminConflict) load();
      setActionError(error instanceof AdminConflict ? error.message : "보관 상태를 변경하지 못했습니다. Firestore 권한과 연결을 확인해 주세요.");
    } finally { setChanging(false); }
  }

  async function setCurrent(item: DocumentRecord) {
    if (!db || changing) return;
    if (item.published !== true || item.archivedAt) {
      setActionError("공개된 기수만 현재 기수로 설정할 수 있습니다.");
      return;
    }
    setActionError("");
    setChanging(true);
    try {
      await setAdminCurrent(item.snapshot, currentGeneration?.snapshot ?? null, userId);
      setMessage("현재 기수를 변경했습니다.");
      load();
    } catch (error) {
      if (error instanceof AdminConflict) load();
      setActionError(error instanceof AdminConflict ? error.message : "현재 기수를 변경하지 못했습니다. Firestore 권한을 확인해 주세요.");
    } finally { setChanging(false); }
  }

  return (
    <>
      <header className={`admin-heading${editing !== undefined ? " admin-heading-editing" : ""}`}>
        <h1>{config.label}</h1>
        {editing === undefined && <button className="button" data-focus-key="new" disabled={saving || changing || (config.name === "recruitment" && (loading || Boolean(loadError)))} onClick={() => {
          if (currentRecruitment?.archivedAt) void changeArchive(currentRecruitment, false);
          else openEditor(currentRecruitment ?? null, "new");
        }}>{currentRecruitment ? currentRecruitment.archivedAt ? "현재 기수 모집 복원" : "현재 기수 모집 수정" : <><span aria-hidden="true">＋</span>{`새 ${config.singular} 추가`}</>}</button>}
      </header>
      <div className={`admin-feedback${saving || message ? "" : " visually-hidden"}`}>
        <p role="status">{saving ? "변경사항을 저장하는 중입니다." : message}</p>
        {publicHref && <a className="text-link" href={publicHref} target="_blank" rel="noopener noreferrer">저장한 공개본 보기 ↗</a>}
      </div>
      {actionError && <p className="form-error" role="alert">{actionError}</p>}
      {loadError && <div className="form-error" role="alert"><p>{loadError}{loaded && " 마지막으로 불러온 목록을 표시합니다."}</p><button type="button" className="button button-secondary" disabled={saving} onClick={load}>목록 다시 시도</button></div>}
      {config.name === "generations" && loaded && <p className="admin-current-generation">현재 기수: <strong>{String(currentCatalog?.label || currentGeneration?.label || currentGeneration?.generationId || "미설정")}</strong></p>}
      {editing !== undefined ? (
        <EditorForm key={formSession} config={config} document={editing} userId={userId} recruitmentGeneration={editingGeneration} isCurrentGeneration={Boolean(editing && currentGeneration?.generationId === editing.id)} onCancel={closeEditor} onRefresh={load} onSaved={(href) => { closeEditor(); setMessage("저장했습니다."); setPublicHref(href); load(); }} onDirtyChange={onDirtyChange} saving={saving} onSavingChange={onSavingChange} />
      ) : loading ? (
        <p role="status" aria-busy="true">목록을 불러오는 중입니다.</p>
      ) : editableDocuments.length ? (
        <section className="admin-inventory" aria-label={`${config.label} 목록`}>
          <div className="admin-list-tools">
            <div className="admin-filters" role="group" aria-label="공개 상태 필터">
              {(Object.keys(visibilityLabels) as (keyof typeof visibilityLabels)[]).map((value) => <button
                key={value}
                type="button"
                aria-pressed={visibility === value}
                onClick={() => setVisibility(value)}
              >{visibilityLabels[value]}</button>)}
            </div>
            <label className="admin-search"><span className="visually-hidden">목록 검색</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="제목 또는 문서 ID" /></label>
          </div>
          <p className="admin-result-count" role="status">{filteredDocuments.length}건</p>
          {filteredDocuments.length ? (
            <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th scope="col" className="admin-row-title">{config.name === "members" || config.name === "generations" ? "이름" : "제목"}</th><th scope="col" className="admin-row-visibility">공개 상태</th><th scope="col" className="admin-row-status">상태</th><th scope="col" className="admin-row-date">수정일</th><th scope="col" className="admin-row-actions"><span className="visually-hidden">작업</span></th></tr></thead><tbody>
              {filteredDocuments.map((item) => {
                const archived = Boolean(item.archivedAt);
                const visibility = contentVisibility(item, publicField);
                const isCurrent = currentGeneration?.generationId === item.id;
                const status = config.name === "recruitment" ? recruitmentStatusLabels[effectiveRecruitmentStatus(recruitmentSchedule(item), now)] : String(item.status || item.role || (isCurrent ? "현재" : "–"));
                return <tr key={item.id}>
                  <td className="admin-row-title"><strong>{String(item[config.titleField] || "제목 없음")}</strong><code>{item.id}</code></td>
                  <td className="admin-row-visibility"><span className="admin-visibility" data-visibility={visibility}>{visibilityLabels[visibility]}</span></td>
                  <td className="admin-row-status" data-label="상태">{status}</td>
                  <td className="admin-row-date" data-label="수정일">{formatTimestamp(item.updatedAt)}</td>
                  <td className="admin-row-actions">
                    {config.name === "generations" && !archived && item.published === true && !isCurrent && <button disabled={changing} onClick={() => setCurrent(item)}>현재로 설정</button>}
                    {archived ? <button disabled={changing} onClick={() => changeArchive(item, false)}>복원</button> : <>
                      <button className="admin-edit-row" disabled={changing} data-focus-key={`edit:${item.id}`} onClick={() => openEditor(item, `edit:${item.id}`)}>수정</button>
                      {isCurrent ? <small>보관하려면 다른 기수를 먼저 현재로 설정하세요.</small> : <button className="danger" disabled={changing} onClick={() => changeArchive(item, true)}>보관</button>}
                    </>}
                  </td>
                </tr>;
              })}
            </tbody></table></div>
          ) : <div className="admin-empty"><h2>조건에 맞는 항목이 없습니다</h2><p>검색어나 공개 상태를 바꿔 보세요.</p></div>}
        </section>
      ) : !loadError && loaded ? (
        <div className="admin-empty"><h2>등록된 {config.singular}이 없습니다</h2><p>위의 추가 버튼으로 첫 항목을 등록할 수 있습니다.</p></div>
      ) : null}
    </>
  );
}

type EditorFormProps = SaveState & {
  config: AdminCollection;
  document: DocumentRecord | null;
  userId: string;
  recruitmentGeneration: string;
  isCurrentGeneration: boolean;
  onCancel: () => void;
  onRefresh: () => void;
  onSaved: (publicHref: string) => void;
  onDirtyChange: (dirty: boolean) => void;
};

function recruitmentSchedule(values: Record<string, unknown>): RecruitmentSchedule {
  return {
    status: values.status === "open" || values.status === "closed" ? values.status : "upcoming",
    startDate: String(values.startDate || ""), endDate: String(values.endDate || ""), endTime: String(values.endTime || ""),
  };
}

const primaryFields = new Set(["title", "name", "label", "slug", "summary", "category", "generation", "role", "position", "activityGenerations", "status", "startDate", "endDate", "endTime"]);
const publicationFields = new Set(["order", "published", "visible"]);

function EditorForm({ config, document, userId, recruitmentGeneration, isCurrentGeneration, onCancel, onRefresh, onSaved, onDirtyChange, saving, onSavingChange }: EditorFormProps) {
  const isCurrentRecruitment = config.name === "recruitment" && !document;
  const isSlugDocument = !document && (config.name === "activities" || config.name === "projects");
  const hasGenerationSelect = config.name === "activities" || config.name === "projects";
  const needsDocumentId = !document && config.name === "generations";
  const needsGenerationOptions = hasGenerationSelect || config.name === "members";
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [customDocumentId, setCustomDocumentId] = useState(document?.id || "");
  const initialValues = useMemo<FormValues>(() => Object.fromEntries(config.fields.map((field) => [field.name, initialValue(field, documentValue(field, document))])), [config.fields, document]);
  const [values, setValues] = useState<FormValues>(initialValues);
  const [generationOptions, setGenerationOptions] = useState<GenerationOption[]>([]);
  const [generationOptionsError, setGenerationOptionsError] = useState(false);
  const [generationOptionsLoading, setGenerationOptionsLoading] = useState(needsGenerationOptions);
  const [optionsAttempt, setOptionsAttempt] = useState(0);
  const documentId = isCurrentRecruitment ? recruitmentGeneration : isSlugDocument ? String(values.slug || "").trim() : customDocumentId;
  const savePending = useRef(false);
  const activeSession = useRef(true);
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState("");
  const [conflict, setConflict] = useState(false);
  const dirty = JSON.stringify(values) !== JSON.stringify(initialValues) || customDocumentId !== (document?.id || "");
  const memberGenerations = (values.activityGenerations as string[] | undefined) ?? [];
  const history = (values.generationHistory as GenerationHistoryItem[] | undefined) ?? [];
  const selectedHistory = history.filter((item) => memberGenerations.includes(item.generationId));
  const removedHistory = history.filter((item) => !memberGenerations.includes(item.generationId) && (item.role || item.position));
  const availableGenerationOptions = useMemo(() => {
    const options = new Map(generationOptions.map((item) => [item.id, item.label]));
    const previous = initialValues.activityGenerations;
    if (Array.isArray(previous)) for (const id of previous) if (typeof id === "string" && !options.has(id)) options.set(id, `${id} (기존 값)`);
    const legacyGeneration = values.generation;
    if (hasGenerationSelect && typeof legacyGeneration === "string" && legacyGeneration && !options.has(legacyGeneration)) options.set(legacyGeneration, `${legacyGeneration} (기존 값)`);
    return [...options].map(([id, label]) => ({ id, label }));
  }, [generationOptions, hasGenerationSelect, initialValues.activityGenerations, values.generation]);

  useEffect(() => {
    activeSession.current = true;
    formRef.current?.querySelector<HTMLElement>(`#field-${config.titleField}`)?.focus();
    return () => { activeSession.current = false; };
  }, [config.titleField]);

  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  useEffect(() => {
    if (!dirty && !saving) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving]);

  useEffect(() => {
    if (!db || !needsGenerationOptions) return;
    let active = true;
    getDocsFromServer(collection(db, "generations"))
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
      .catch(() => active && setGenerationOptionsError(true))
      .finally(() => active && setGenerationOptionsLoading(false));
    return () => { active = false; };
  }, [needsGenerationOptions, optionsAttempt]);

  function update(name: string, value: FormValue) {
    if (savePending.current) return;
    setValues((current) => ({ ...current, [name]: value }));
    if (errorField === name) { setError(""); setErrorField(""); }
  }

  function fail(message: string, field = "") {
    setError(message);
    setErrorField(field);
  }

  function cancel() {
    if (savePending.current) return;
    if (!dirty || window.confirm("저장하지 않은 변경사항을 버릴까요?")) onCancel();
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db || savePending.current) return;
    if ((isSlugDocument || needsDocumentId) && !/^[A-Za-z0-9가-힣_-]+$/.test(documentId)) {
      fail(`${isSlugDocument ? "Slug" : "문서 ID"}는 영문, 숫자, 한글, 하이픈(-), 밑줄(_)만 사용할 수 있습니다.`, isSlugDocument ? "slug" : "documentId");
      return;
    }
    if (needsDocumentId && documentId === "current") {
      fail("current는 현재 기수 안내에 사용하는 예약 ID입니다.", "documentId");
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
    if (config.name === "recruitment" && !validRecruitmentEndTime(endDate, String(values.endTime || ""))) {
      fail("마감 시각을 지정하려면 종료일과 올바른 한국시간을 입력해 주세요.", endDate ? "endTime" : "endDate");
      return;
    }
    for (const field of config.fields.filter((item) => item.kind === "url")) {
      const value = String(values[field.name] || "");
      if (value && !isHttpUrl(value)) {
        fail(`${field.label}은 http 또는 https URL이어야 합니다.`, field.name);
        return;
      }
    }
    const resources = config.name === "activities" ? parseActivityLinks(String(values.links || "")) : null;
    if (resources?.error) {
      fail(resources.error, "links");
      return;
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
      const previous = Array.isArray(document?.activityGenerations) ? document.activityGenerations : typeof document?.generation === "string" ? [document.generation] : [];
      if (selected.filter((id) => !previous.includes(id)).some((id) => !history.some((item) => item.generationId === id && item.role))) {
        fail("새로 추가한 활동 기수마다 당시 역할을 선택해 주세요.", "generationHistory");
        return;
      }
      if (selectedHistory.some((item) => item.position.trim() && !item.role)) {
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
    savePending.current = true;
    onSavingChange(true);
    const payload: Record<string, unknown> = Object.fromEntries(config.fields
      .map((field) => [field.name, serializeValue(field, field.name === "generationHistory" ? selectedHistory : values[field.name])])
      .filter((entry) => entry[1] !== undefined));
    if (document?.order !== undefined && values.order === "") payload.order = deleteField();
    if (resources?.links) {
      payload.links = resources.links;
      if (resources.linkTitles.length) payload.linkTitles = resources.linkTitles;
      else if (document?.linkTitles !== undefined) payload.linkTitles = deleteField();
    }
    try {
      if (config.name === "members" && typeof payload.github === "string" && payload.github) {
        const github = normalizeGithub(payload.github);
        const duplicate = (await getDocs(collection(db, "members"))).docs.find((item) => item.id !== document?.id && normalizeGithub(String(item.data().github || "")) === github);
        if (!activeSession.current) return;
        if (duplicate) {
          fail("같은 GitHub 프로필을 사용하는 구성원이 이미 있습니다.", "github");
          return;
        }
      }
      const target = document ? doc(db, config.name, document.id) : documentId.trim()
        ? doc(db, config.name, documentId.trim()) : doc(collection(db, config.name));
      await saveAdminDocument(target, document?.snapshot ?? null, payload, userId);
      if (activeSession.current) {
        const publishedArchive = (config.name === "activities" || config.name === "projects") && payload.published === true
          ? archiveHref(config.name, { id: target.id, slug: String(payload.slug || target.id) }) : "";
        onSaved(publishedArchive);
      }
    } catch (reason) {
      if (!activeSession.current) return;
      if (reason instanceof AdminConflict) {
        setConflict(true);
        fail(reason.message, !document ? isSlugDocument ? "slug" : "documentId" : "");
        onRefresh();
      } else {
        fail("저장하지 못했습니다. 입력값과 Firestore 권한을 확인해 주세요.");
      }
    } finally {
      if (activeSession.current) {
        savePending.current = false;
        onSavingChange(false);
      }
    }
  }

  const schedules = useMemo(() => config.name === "recruitment" && values.status ? [recruitmentSchedule(values)] : [], [config.name, values]);
  const now = useRecruitmentNow(schedules);
  const recruitmentPreview = schedules[0] && effectiveRecruitmentStatus(schedules[0], now);
  const sections = [
    { title: "기본 정보", fields: config.fields.filter((field) => primaryFields.has(field.name)) },
    { title: "상세 정보", fields: config.fields.filter((field) => !primaryFields.has(field.name) && !publicationFields.has(field.name)) },
    { title: "공개 설정", fields: config.fields.filter((field) => publicationFields.has(field.name)) },
  ];

  return (
    <form className="admin-form" onSubmit={save} ref={formRef} aria-busy={saving} aria-describedby={error ? "admin-form-error" : undefined}>
      <fieldset className="admin-form-controls" disabled={saving}>
      <div className="form-heading"><h2>{document ? String(document[config.titleField]) : `새 ${config.singular}`}</h2><button className="button button-secondary" type="button" onClick={cancel}>닫기</button></div>
      {!document && <label className="field"><span>문서 ID <small>{isCurrentRecruitment ? "현재 기수 기준" : isSlugDocument ? "Slug에서 자동 생성" : needsDocumentId ? "고유한 기수 ID" : "비워두면 자동 생성"}</small></span><input value={documentId} onChange={(event) => { setCustomDocumentId(event.target.value); if (errorField === "documentId") { setError(""); setErrorField(""); } }} pattern={"[A-Za-z0-9가-힣_\\-]*"} readOnly={isCurrentRecruitment || isSlugDocument} required={isCurrentRecruitment || isSlugDocument || needsDocumentId} aria-invalid={errorField === "documentId" || undefined} aria-describedby={errorField === "documentId" ? "admin-form-error" : undefined} /></label>}
      {generationOptionsLoading && <p role="status">기수 목록을 불러오는 중입니다.</p>}
      {generationOptionsError && <div className="form-error" role="alert"><p>기수 목록을 불러오지 못했습니다. 입력한 내용은 유지됩니다.</p><button type="button" className="button button-secondary" onClick={() => {
        setGenerationOptionsError(false);
        setGenerationOptionsLoading(true);
        setOptionsAttempt((value) => value + 1);
      }}>기수 목록 다시 시도</button></div>}
      {needsGenerationOptions && !generationOptionsError && !generationOptionsLoading && !generationOptions.length && <p>새로 선택할 공개 기수가 없습니다. 기수 메뉴에서 기수를 공개해 주세요.</p>}
      {sections.filter((section) => section.fields.length).map((section) => <section key={section.title} className="admin-form-section">
        <h3>{section.title}</h3>
        <div className="form-grid">{section.fields.map((field) => <AdminInput
          key={field.name} field={field} value={values[field.name]}
          generationOptions={availableGenerationOptions} selectedGenerations={memberGenerations}
          readOnly={Boolean(document && field.name === "slug" && (config.name === "activities" || config.name === "projects")) || (isCurrentGeneration && field.name === "published")}
          invalid={errorField === field.name} onChange={(value) => update(field.name, value)}
        />)}</div>
      </section>)}
      {isCurrentGeneration && <p>현재 기수를 비공개로 전환하려면 다른 기수를 먼저 현재로 설정하세요.</p>}
      {recruitmentPreview && <p className="admin-status-preview">공개 화면 예상 상태: <strong>{recruitmentStatusLabels[recruitmentPreview]}</strong> (한국시간 기준)</p>}
      {error && <p className="form-error" id="admin-form-error" role="alert" tabIndex={-1} ref={errorRef}>{error}</p>}
      {removedHistory.length > 0 && <p role="status">저장하면 제외할 기수 이력 · {removedHistory.map((item) => [availableGenerationOptions.find((option) => option.id === item.generationId)?.label || item.generationId, item.role, item.position].filter(Boolean).join(" / ")).join(", ")}</p>}
      {conflict && <button type="button" className="button button-secondary" onClick={cancel}>목록에서 최신 항목 확인</button>}
      <div className="form-actions"><button type="button" className="button button-secondary" onClick={cancel}>취소</button><button className="button" disabled={saving}>{saving ? "저장 중…" : "변경사항 저장"}</button></div>
      </fieldset>
    </form>
  );
}

function AdminInput({ field, value, generationOptions, selectedGenerations, readOnly = false, invalid = false, onChange }: { field: AdminField; value: FormValue; generationOptions: GenerationOption[]; selectedGenerations: string[]; readOnly?: boolean; invalid?: boolean; onChange: (value: FormValue) => void }) {
  const id = `field-${field.name}`;
  if (field.kind === "checkbox") return <label className="check-field"><input id={id} type="checkbox" checked={Boolean(value)} disabled={readOnly} onChange={(event) => onChange(event.target.checked)} /><span>{field.label}</span></label>;
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

  const fieldError = invalid ? "admin-form-error" : undefined;
  const timeHint = field.kind === "time" ? `${id}-hint` : undefined;
  const inputProps = {
    id, value: String(value), required: field.required, "aria-invalid": invalid || undefined,
    "aria-describedby": [fieldError, timeHint].filter(Boolean).join(" ") || undefined,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => onChange(event.target.value),
  };
  const options = field.name === "generation" ? generationOptions : (field.options || []).map((option) => ({
    id: option,
    label: field.name === "status" && Object.hasOwn(recruitmentStatusLabels, option) ? recruitmentStatusLabels[option as RecruitmentSchedule["status"]] : option,
  }));
  return (
    <label className={`field ${field.kind === "textarea" || field.kind === "list" ? "field-wide" : ""}`} htmlFor={id}>
      <span>{field.label}{field.required && <em>필수</em>}</span>
      {field.kind === "textarea" || field.kind === "list" ? <textarea {...inputProps} rows={field.kind === "textarea" ? 5 : 3} />
        : field.kind === "select" ? <select {...inputProps}><option value="">선택</option>{options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select>
        : <input {...inputProps} type={field.kind || "text"} readOnly={readOnly} />}
      {timeHint && <small id={timeHint}>시각을 비우면 종료일이 끝날 때까지 지원할 수 있습니다.</small>}
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
  if (field.name === "links" && Array.isArray(document?.links)) {
    const titles = readLinkTitles(document.linkTitles);
    return document.links.map((url) => titles.has(url) ? `${titles.get(url)} | ${url}` : url);
  }
  if (field.name === "activityGenerations") {
    if (Array.isArray(document?.activityGenerations)) return document.activityGenerations;
    if (typeof document?.generation === "string" && document.generation) return [document.generation];
  }
  return document?.[field.name];
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
