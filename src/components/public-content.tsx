"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createContext, Suspense, useContext, useEffect, useMemo, useRef, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { loadCurrentGeneration } from "@/lib/use-current-generation";
import { effectiveRecruitmentStatus, recruitmentStatusLabels } from "@/lib/recruitment-status";
import { useRecruitmentNow } from "@/lib/use-recruitment-now";
import { trackAnalyticsEvent } from "@/lib/analytics-consent";
import { memberRoleForGeneration } from "@/lib/member-presentation";
import { usePublicCollection } from "@/lib/use-public-data";
import { activityCategories, allArchiveItems, archiveHref, compareActivities, compareProjects, generationOptions, readArchiveFilters, type ArchiveFilters, type ArchiveName } from "@/lib/public-archive";
import { GenerationName } from "@/components/generation-name";
import { PageHero, SectionHeading } from "@/components/site-shell";
import type { Activity, Generation, Member, Project, Recruitment } from "@/types/content";

type PublicRecruitment = Recruitment & { generationLabel: string };
let recruitmentRequest: Promise<PublicRecruitment | undefined> | null = null;

function loadRecruitment() {
  if (!db) return Promise.resolve(undefined);
  const activeDb = db;
  if (!recruitmentRequest) {
    recruitmentRequest = loadCurrentGeneration()
      .then(async ({ generationId, label }) => {
        const snapshot = await getDoc(doc(activeDb, "recruitment", generationId));
        return snapshot.exists() && snapshot.data().published === true
          ? { ...snapshot.data(), id: snapshot.id, generationLabel: label } as PublicRecruitment
          : undefined;
      })
      .finally(() => { recruitmentRequest = null; });
  }
  return recruitmentRequest;
}

function useRecruitment() {
  const [recruitment, setRecruitment] = useState<PublicRecruitment>();
  const [loading, setLoading] = useState(Boolean(db));
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    loadRecruitment()
      .then((value) => active && setRecruitment(value))
      .catch((reason: unknown) => {
        if (!active) return;
        setRecruitment(undefined);
        setError((reason as { code?: string }).code !== "permission-denied");
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [attempt]);

  return { recruitment, loading, error, retry: () => { setError(false); setLoading(true); setAttempt((value) => value + 1); } };
}

export function PeopleHero() {
  return <PageHero eyebrow="People" title="커뮤니티를 만드는 사람들" description="프로필과 외부 링크는 본인이 공개에 동의한 경우에만 표시합니다." />;
}

type CollectionProps = {
  compact?: boolean;
  filters?: ArchiveFilters;
  onFilter?: (changes: Partial<ArchiveFilters>) => void;
};

export function FilterableArchive({ name }: { name: ArchiveName }) {
  const loadingText = name === "activities" ? "활동을 불러오는 중입니다." : "프로젝트를 불러오는 중입니다.";
  return <Suspense fallback={<CollectionLoading text={loadingText} />}><ArchiveWithFilters name={name} /></Suspense>;
}

function ArchiveWithFilters({ name }: { name: ArchiveName }) {
  const filters = readArchiveFilters(name, useSearchParams());
  function changeFilters(changes: Partial<ArchiveFilters>) {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(changes)) {
      if (value === "All") url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    }
    window.history.replaceState(null, "", url);
  }
  return name === "activities"
    ? <ActivityCollection filters={filters} onFilter={changeFilters} />
    : <ProjectCollection filters={filters} onFilter={changeFilters} />;
}

function FilterSummary({ label, count, filters, onFilter }: { label: string; count: number; filters: ArchiveFilters; onFilter: NonNullable<CollectionProps["onFilter"]> }) {
  const result = useRef<HTMLSpanElement>(null);
  function resetFilters() {
    onFilter(allArchiveItems);
    result.current?.focus();
  }
  return <div className="filter-summary">
    <span ref={result} role="status" tabIndex={-1}>{label} {count}건</span>
    {(filters.generation !== "All" || filters.category !== "All") && <button type="button" onClick={resetFilters}>필터 초기화</button>}
  </div>;
}

export function ActivityCollection({ compact = false, filters = allArchiveItems, onFilter }: CollectionProps) {
  const { items, cached, loading, error, retry } = usePublicCollection<Activity>("activities", "published", true, compact ? 3 : 0);
  const { items: generationItems } = usePublicCollection<Generation>("generations", "published", !compact);
  const { category, generation } = filters;
  const generations = useMemo(() => generationOptions(generationItems, items.map((item) => item.generation)), [items, generationItems]);
  const sorted = useMemo(() => [...items].sort(compareActivities), [items]);
  const filtered = useMemo(() => sorted.filter((item) =>
    (category === "All" || item.category === category) && (generation === "All" || item.generation === generation)), [category, generation, sorted]);
  const visibleItems = compact ? filtered.slice(0, 3) : filtered;

  if (loading) return <CollectionLoading text="활동을 불러오는 중입니다." />;
  if (error) return <CollectionError text="활동을 불러오지 못했습니다." onRetry={retry} />;

  return (
    <div>
      {cached && <CachedNotice onRetry={retry} />}
      {onFilter && (
        <div className="archive-toolbar">
          <div className="archive-controls">
            <GenerationSelect label="활동 기수" value={generation} options={generations} onChange={(value) => onFilter({ generation: value })} />
            <label className="generation-filter mobile-filter"><span>활동 카테고리</span><select value={category} onChange={(event) => onFilter({ category: event.target.value })}>{activityCategories.map((item) => <option key={item} value={item}>{item === "All" ? "전체" : item}</option>)}</select></label>
            <div className="filter-row desktop-filter" role="group" aria-label="활동 카테고리 필터">
              {activityCategories.map((item) => <button type="button" key={item} className={category === item ? "active" : ""} aria-pressed={category === item} onClick={() => onFilter({ category: item })}>{item === "All" ? "전체" : item}</button>)}
            </div>
          </div>
          <FilterSummary label="활동" count={filtered.length} filters={filters} onFilter={onFilter} />
        </div>
      )}
      {visibleItems.length ? (
        <div className="activity-grid">
          {visibleItems.map((activity) => {
            return (
              <article className="activity-card" key={activity.id}>
                <div className="card-body">
                  <div className="card-meta"><span className="card-category">{activity.category}</span><span className="card-status">{activity.status}</span></div>
                  <h3>{activity.title}</h3>
                  <p>{activity.summary}</p>
                  <div className="card-footer">
                    <span>{activity.startDate || (compact ? <GenerationName id={activity.generation} /> : generations.find(([id]) => id === activity.generation)?.[1])}</span>
                    <Link className="text-link" href={archiveHref("activities", activity, filters)} aria-label={`${activity.title} 자세히 보기`}>자세히 보기 <span aria-hidden="true">→</span></Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState headingLevel="h3" title={category === "All" && generation === "All" ? "아직 등록된 활동이 없습니다" : "조건에 맞는 활동이 없습니다"} text={category === "All" && generation === "All" ? "새 활동 기록이 공개되면 이곳에 표시됩니다." : "다른 기수나 카테고리를 선택해 보세요."} />
      )}
    </div>
  );
}

export function ProjectCollection({ compact = false, filters = allArchiveItems, onFilter }: CollectionProps) {
  const { items, cached, loading, error, retry } = usePublicCollection<Project>("projects", "published", true, compact ? 2 : 0);
  const { items: generationItems } = usePublicCollection<Generation>("generations", "published", !compact);
  const { generation } = filters;
  const generations = useMemo(() => generationOptions(generationItems, items.map((item) => item.generation)), [items, generationItems]);
  const sorted = useMemo(() => [...items].sort(compareProjects), [items]);
  const filtered = useMemo(() => sorted.filter((item) => generation === "All" || item.generation === generation), [generation, sorted]);
  const visibleItems = compact ? filtered.slice(0, 2) : filtered;

  if (loading) return <CollectionLoading text="프로젝트를 불러오는 중입니다." />;
  if (error) return <CollectionError text="프로젝트를 불러오지 못했습니다." onRetry={retry} />;
  return (
    <div>
      {compact && (visibleItems.length > 0
        ? <SectionHeading title="프로젝트" action={{ href: "/projects/", label: "모든 프로젝트" }} />
        : <h2>프로젝트</h2>)}
      {cached && <CachedNotice onRetry={retry} />}
      {onFilter && <div className="archive-toolbar">
        <div className="archive-controls">
          <GenerationSelect label="프로젝트 기수" value={generation} options={generations} onChange={(value) => onFilter({ generation: value })} />
        </div>
        <FilterSummary label="프로젝트" count={filtered.length} filters={filters} onFilter={onFilter} />
      </div>}
      {!visibleItems.length && (compact
        ? <p className="compact-empty" role="status">아직 공개된 프로젝트가 없습니다.</p>
        : <div className="empty-state">
            <h2>{generation === "All" ? "아직 공개된 프로젝트가 없습니다" : "이 기수의 공개 프로젝트가 없습니다"}</h2>
            {generation === "All" ? <Link className="text-link" href="/activities/">챕터 활동 보기 <span aria-hidden="true">→</span></Link> : <p>다른 기수를 선택해 보세요.</p>}
          </div>)}
      {visibleItems.length > 0 && <div className="project-list">
      {visibleItems.map((project) => {
        const Heading = compact ? "h3" : "h2";
        return (
          <article className="project-card" key={project.id}>
            <div className="project-copy">
              {project.generation && <p className="project-generation">{compact ? <GenerationName id={project.generation} /> : generations.find(([id]) => id === project.generation)?.[1]}</p>}
              <Heading>{project.title}</Heading>
              <p>{project.summary}</p>
              {Boolean(project.techStack?.length) && <ul className="tag-list" aria-label="사용 기술">{project.techStack?.map((tech) => <li key={tech}>{tech}</li>)}</ul>}
              <Link href={archiveHref("projects", project, filters)} className="text-link" aria-label={`${project.title} 프로젝트 보기`}>프로젝트 보기 <span aria-hidden="true">→</span></Link>
            </div>
          </article>
        );
      })}
      </div>}
    </div>
  );
}

function GenerationSelect({ label, value, options, onChange, className = "" }: { label: string; value: string; options: [string, string][]; onChange: (value: string) => void; className?: string }) {
  if (!options.length && value === "All") return null;
  return <label className={`generation-filter ${className}`}><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}><option value="All">전체</option>{value !== "All" && !options.some(([id]) => id === value) && <option value={value}>{value}</option>}{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>;
}

export function PeopleCollection() {
  const { items, cached, loading, error, retry } = usePublicCollection<Member>("members", "visible");
  const { items: generationItems } = usePublicCollection<Generation>("generations");
  const [generation, setGeneration] = useState("All");
  const generations = useMemo(() => generationOptions(generationItems, items.flatMap(memberGenerations)), [generationItems, items]);
  const sorted = useMemo(() => [...items]
    .filter((member) => generation === "All" || memberGenerations(member).includes(generation))
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name, "ko")), [generation, items]);

  if (loading) return <CollectionLoading text="구성원을 불러오는 중입니다." />;
  if (error) return <CollectionError text="구성원 정보를 불러오지 못했습니다." onRetry={retry} />;

  return (
    <div>
      {cached && <CachedNotice onRetry={retry} />}
      {generations.length > 0 && (
        <>
          <GenerationSelect label="활동 기수" value={generation} options={generations} onChange={setGeneration} className="mobile-filter" />
          <div className="filter-row desktop-filter" role="group" aria-label="활동 기수 필터">
            <button className={generation === "All" ? "active" : ""} aria-pressed={generation === "All"} onClick={() => setGeneration("All")}>전체</button>
            {generations.map(([id, label]) => <button key={id} className={generation === id ? "active" : ""} aria-pressed={generation === id} onClick={() => setGeneration(id)}>{label}</button>)}
          </div>
        </>
      )}
      {sorted.length ? (
        <div className="people-grid">
          {sorted.map((member) => {
            const { role, position } = memberRoleForGeneration(member, generation);
            return (
            <article className="person-card" key={member.id}>
              <MemberAvatar key={member.github || "avatar"} member={member} />
              <div><p>{role}</p><h2>{member.name}</h2>{position && <span>{position}</span>}</div>
              {memberGenerations(member).length > 0 && <ul className="member-generations" aria-label={`${member.name} 활동 기수`}>{memberGenerations(member).map((id) => <li key={id}>{generations.find(([generationId]) => generationId === id)?.[1] || id}</li>)}</ul>}
              {member.description && <p className="person-description">{member.description}</p>}
              <div className="social-links">
                {safeHref(member.github) && <a href={safeHref(member.github)!} target="_blank" rel="noopener noreferrer">GitHub ↗</a>}
                {safeHref(member.linkedin) && <a href={safeHref(member.linkedin)!} target="_blank" rel="noopener noreferrer">LinkedIn ↗</a>}
                {safeHref(member.website) && <a href={safeHref(member.website)!} target="_blank" rel="noopener noreferrer">Website ↗</a>}
              </div>
            </article>
          );})}
        </div>
      ) : (
        <EmptyState headingLevel="h2" title={generation === "All" ? "구성원 소개를 준비하고 있어요" : "이 기수의 공개 프로필이 없습니다"} text={generation === "All" ? "공개 동의를 마친 프로필부터 차례로 소개합니다." : "다른 활동 기수를 선택해 보세요."} />
      )}
    </div>
  );
}

function MemberAvatar({ member }: { member: Member }) {
  const avatar = githubAvatarUrl(member.github);
  const [failed, setFailed] = useState(false);
  return avatar && !failed
    ? <Image src={avatar} alt={`${member.name}의 GitHub 프로필 이미지`} width={160} height={160} referrerPolicy="no-referrer" onError={() => setFailed(true)} />
    : <div className="avatar" aria-hidden="true">{member.name.slice(0, 1)}</div>;
}

const RecruitmentContext = createContext<ReturnType<typeof useRecruitment> | null>(null);

export function RecruitmentProvider({ children }: { children: React.ReactNode }) {
  const state = useRecruitment();
  return <RecruitmentContext.Provider value={state}>{children}</RecruitmentContext.Provider>;
}

function useRecruitmentState() {
  const state = useContext(RecruitmentContext);
  if (!state) throw new Error("RecruitmentProvider is required");
  return state;
}

export function RecruitmentPanel({ compact = false }: { compact?: boolean }) {
  const { recruitment, loading, error, retry } = useRecruitmentState();
  const now = useRecruitmentNow(recruitment ? [recruitment] : []);
  const Heading = compact ? "h2" : "h1";
  const detailsLink = compact ? <Link href="/recruit/" className="button button-secondary">모집 안내</Link> : null;

  if (loading) return <div className="recruitment-panel" aria-busy="true"><div><Heading>모집 안내</Heading><p>모집 정보를 불러오는 중입니다.</p></div>{detailsLink}</div>;
  if (error) return <div className="recruitment-panel" role="alert"><div><Heading>모집 안내</Heading><p>모집 정보를 불러오지 못했습니다.</p><button className="button" type="button" onClick={retry}>다시 시도</button></div>{detailsLink}</div>;
  if (!recruitment) return <div className="recruitment-panel"><div><span className="status-badge status-closed">현재 모집 없음</span><Heading>다음 모집을 준비하고 있습니다</Heading><p>일정이 확정되면 모집 안내에 게시합니다.</p></div>{detailsLink}</div>;

  const effectiveStatus = effectiveRecruitmentStatus(recruitment, now);
  const date = formatRecruitmentDates(recruitment);
  const applyUrl = safeHref(recruitment.applyUrl);
  const canApply = effectiveStatus === "open" && Boolean(applyUrl);
  return (
    <div className={`recruitment-panel${canApply ? " is-open" : ""}`}>
      <div>
        <span className={`status-badge status-${effectiveStatus}`}>{recruitmentStatusLabels[effectiveStatus]}</span>
        <p className="eyebrow">{recruitment.generationLabel}</p>
        <Heading>{recruitment.title}</Heading>
        <p>{recruitment.description}</p>
        {date && <p className="recruitment-date">{date}</p>}
      </div>
      {(compact || effectiveStatus === "open") && <div className="button-row">
        {detailsLink}
        {canApply && applyUrl && (
          <a className="button" href={applyUrl} target="_blank" rel="noopener noreferrer" onClick={(event) => {
            if (effectiveRecruitmentStatus(recruitment) !== "open") event.preventDefault();
            else trackAnalyticsEvent("recruit_apply_click");
          }}>지원하기 <span aria-hidden="true">↗</span></a>
        )}
        {effectiveStatus === "open" && !applyUrl && <span className="recruitment-unavailable">지원 링크 준비 중</span>}
      </div>}
    </div>
  );
}

export function RecruitmentDetails() {
  const { recruitment } = useRecruitmentState();
  if (!recruitment?.process?.length && !recruitment?.faq?.length) return null;
  return (
    <section className="section container">
      {Boolean(recruitment.process?.length) && <>
        <h2>지원부터 합류까지</h2>
        <ol className="process-list">{recruitment.process?.map((step, index) => <li key={`${step}-${index}`}><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><strong>{step}</strong></li>)}</ol>
      </>}
      {Boolean(recruitment.faq?.length) && <div className="faq-list"><h2>자주 묻는 질문</h2>{recruitment.faq?.map((item, index) => <details key={`${item.question}-${index}`}><summary>{item.question}<span aria-hidden="true">＋</span></summary><p>{item.answer}</p></details>)}</div>}
    </section>
  );
}

export function RecruitmentRoles() {
  const { recruitment } = useRecruitmentState();
  const roles = recruitment?.roles?.filter((role) => role === "Member" || role === "Team Member") ?? [];
  if (!roles.length) return null;
  return <section className="section surface-section"><div className="container">
    <h2>모집 역할</h2>
    <div className="role-cards">{roles.map((role) => <article key={role}><h3>{role}</h3><p>{roleDescription(role)}</p></article>)}</div>
  </div></section>;
}

export function EmptyState({ title, text, headingLevel = "h2" }: { title: string; text: string; headingLevel?: "h2" | "h3" }) {
  const Heading = headingLevel;
  return <div className="empty-state" role="status"><Heading>{title}</Heading><p>{text}</p></div>;
}

function CollectionLoading({ text }: { text: string }) {
  return <p className="collection-state" role="status" aria-busy="true">{text}</p>;
}

function CachedNotice({ onRetry }: { onRetry: () => void }) {
  return <div className="inline-notice" role="status"><p>현재 연결할 수 없어 이전에 불러온 목록을 표시합니다.</p><button type="button" className="button button-secondary" onClick={onRetry}>다시 시도</button></div>;
}

function CollectionError({ text, onRetry }: { text: string; onRetry: () => void }) {
  return <div className="inline-notice" role="alert"><p>{text}</p><button className="button button-secondary" type="button" onClick={onRetry}>다시 시도</button></div>;
}

function memberGenerations(member: Member) {
  return member.activityGenerations?.filter(Boolean).length ? member.activityGenerations : member.generation ? [member.generation] : [];
}

function formatRecruitmentDates({ startDate, endDate, endTime }: Recruitment) {
  const closing = endDate && `${endDate}${endTime ? ` ${endTime}` : ""}`;
  if (startDate && closing) return `접수 기간 ${startDate} ~ ${closing} (한국시간)`;
  if (closing) return `접수 마감 ${closing} (한국시간)`;
  return startDate ? `접수 시작 ${startDate} (한국시간)` : "";
}

function safeHref(value?: string) {
  if (!value) return null;
  try { return ["http:", "https:"].includes(new URL(value).protocol) ? value : null; }
  catch { return null; }
}

function githubAvatarUrl(value?: string) {
  const match = value?.match(/^https:\/\/(?:www\.)?github\.com\/([^/?#]+)\/?(?:[?#].*)?$/i);
  return match ? `https://github.com/${encodeURIComponent(match[1])}.png?size=160` : null;
}

function roleDescription(role: string) {
  if (role === "Member") return "스터디, 세션, 프로젝트와 커뮤니티 프로그램에 참여합니다.";
  return "커뮤니티 프로그램과 콘텐츠의 기획·운영에 참여합니다.";
}
