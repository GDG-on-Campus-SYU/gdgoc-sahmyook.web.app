"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { loadCurrentGeneration } from "@/lib/use-current-generation";
import { effectiveRecruitmentStatus } from "@/lib/recruitment-status";
import { trackAnalyticsEvent } from "@/lib/analytics-consent";
import { memberRoleForGeneration } from "@/lib/member-presentation";
import { usePublicCollection } from "@/lib/use-public-data";
import { PageHero } from "@/components/site-shell";
import type { Activity, Generation, Member, Project, Recruitment } from "@/types/content";

const categories = ["All", "Study", "Session", "Project", "Networking", "Hackathon", "Collaboration"];
const recruitmentStatuses = {
  upcoming: ["모집 예정", "모집 시작 전입니다"],
  open: ["모집 중", "지원하기"],
  closed: ["모집 종료", "다음 모집을 기다려 주세요"],
} as const;
let recruitmentRequest: Promise<Recruitment | undefined> | null = null;

function loadRecruitment() {
  if (!db) return Promise.resolve(undefined);
  const activeDb = db;
  if (!recruitmentRequest) {
    recruitmentRequest = loadCurrentGeneration()
      .then(({ generationId }) => getDoc(doc(activeDb, "recruitment", generationId)))
      .then((snapshot) => snapshot.exists() && snapshot.data().published === true
        ? { id: snapshot.id, ...snapshot.data() } as Recruitment
        : undefined)
      .finally(() => { recruitmentRequest = null; });
  }
  return recruitmentRequest;
}

function useRecruitment() {
  const [recruitment, setRecruitment] = useState<Recruitment>();
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

export function ActivityCollection({ compact = false }: { compact?: boolean }) {
  const { items, loading, error, retry } = usePublicCollection<Activity>("activities");
  const { items: generationItems } = usePublicCollection<Generation>("generations", "published", !compact);
  const [category, setCategory] = useState("All");
  const [generation, setGeneration] = useState("All");
  const generations = useMemo(() => contentGenerations(items, generationItems), [items, generationItems]);
  const sorted = useMemo(() => [...items].sort(compareActivities), [items]);
  const filtered = useMemo(() => sorted.filter((item) =>
    (category === "All" || item.category === category) && (generation === "All" || item.generation === generation)), [category, generation, sorted]);
  const visibleItems = compact ? filtered.slice(0, 3) : filtered;

  if (loading) return <CollectionLoading text="활동을 불러오는 중입니다." />;
  if (error) return <CollectionError text="활동을 불러오지 못했습니다." onRetry={retry} />;

  return (
    <div>
      {!compact && (
        <>
          <GenerationSelect label="활동 기수" value={generation} options={generations} onChange={setGeneration} />
          <label className="generation-filter mobile-filter"><span>활동 카테고리</span><select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item} value={item}>{item === "All" ? "전체" : item}</option>)}</select></label>
          <div className="filter-row desktop-filter" role="group" aria-label="활동 카테고리 필터">
            {categories.map((item) => <button key={item} className={category === item ? "active" : ""} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}
          </div>
        </>
      )}
      {visibleItems.length ? (
        <div className="activity-grid">
          {visibleItems.map((activity) => {
            const Heading = compact ? "h3" : "h2";
            return (
              <article className="activity-card" key={activity.id}>
                <div className="card-body">
                  <div className="card-meta"><span>{activity.category}</span><span>{activity.status}</span></div>
                  <Heading>{activity.title}</Heading>
                  <p>{activity.summary}</p>
                  <div className="card-footer">
                    <span>{activity.startDate || generations.find(([id]) => id === activity.generation)?.[1] || activity.generation}</span>
                    <Link href={`/activities/detail/?slug=${encodeURIComponent(activity.slug)}`} aria-label={`${activity.title} 자세히 보기`}>자세히 보기 <span aria-hidden="true">→</span></Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState headingLevel={compact ? "h3" : "h2"} title={category === "All" && generation === "All" ? "아직 등록된 활동이 없습니다" : "조건에 맞는 활동이 없습니다"} text={category === "All" && generation === "All" ? "새 활동 기록이 공개되면 이곳에 표시됩니다." : "다른 기수나 카테고리를 선택해 보세요."} />
      )}
    </div>
  );
}

export function ProjectCollection({ compact = false }: { compact?: boolean }) {
  const { items, loading, error, retry } = usePublicCollection<Project>("projects");
  const { items: generationItems } = usePublicCollection<Generation>("generations", "published", !compact);
  const [generation, setGeneration] = useState("All");
  const generations = useMemo(() => contentGenerations(items, generationItems), [items, generationItems]);
  const sorted = useMemo(() => [...items].sort(compareProjects), [items]);
  const filtered = useMemo(() => sorted.filter((item) => generation === "All" || item.generation === generation), [generation, sorted]);
  const visibleItems = compact ? filtered.slice(0, 2) : filtered;

  if (loading) return <CollectionLoading text="프로젝트를 불러오는 중입니다." />;
  if (error) return <CollectionError text="프로젝트를 불러오지 못했습니다." onRetry={retry} />;
  return (
    <div>
      {!compact && <GenerationSelect label="프로젝트 기수" value={generation} options={generations} onChange={setGeneration} />}
      {!visibleItems.length ? <EmptyState headingLevel={compact ? "h3" : "h2"} title={generation === "All" ? "아직 공개된 프로젝트가 없습니다" : "이 기수의 공개 프로젝트가 없습니다"} text={generation === "All" ? "프로젝트 기록이 공개되면 이곳에 표시됩니다." : "다른 기수를 선택해 보세요."} /> : <div className="project-list">
      {visibleItems.map((project) => {
        const Heading = compact ? "h3" : "h2";
        return (
          <article className="project-card" key={project.id}>
            <div className="project-copy">
              <p className="eyebrow">Project · {generations.find(([id]) => id === project.generation)?.[1] || project.generation}</p>
              <Heading>{project.title}</Heading>
              <p>{project.summary}</p>
              {Boolean(project.techStack?.length) && <ul className="tag-list" aria-label="사용 기술">{project.techStack?.map((tech) => <li key={tech}>{tech}</li>)}</ul>}
              <Link href={`/projects/detail/?slug=${encodeURIComponent(project.slug)}`} className="text-link" aria-label={`${project.title} 프로젝트 보기`}>프로젝트 보기 <span aria-hidden="true">→</span></Link>
            </div>
          </article>
        );
      })}
      </div>}
    </div>
  );
}

function GenerationSelect({ label, value, options, onChange, className = "" }: { label: string; value: string; options: [string, string][]; onChange: (value: string) => void; className?: string }) {
  if (!options.length) return null;
  return <label className={`generation-filter ${className}`}><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}><option value="All">전체</option>{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>;
}

function contentGenerations(items: Array<{ generation?: string }>, generations: Generation[]): [string, string][] {
  const labels = new Map(generations.filter((item) => item.id !== "current").map((item) => [item.id, item.label || item.id]));
  for (const item of items) if (item.generation && !labels.has(item.generation)) labels.set(item.generation, item.generation);
  const order = new Map(generations.map((item) => [item.id, item.order ?? 999]));
  return [...labels].sort(([a], [b]) => (order.get(a) ?? 999) - (order.get(b) ?? 999) || a.localeCompare(b, "ko"));
}

export function PeopleCollection() {
  const { items, loading, error, retry } = usePublicCollection<Member>("members", "visible");
  const { items: generationItems } = usePublicCollection<Generation>("generations");
  const [generation, setGeneration] = useState("All");
  const generations = useMemo(() => {
    const labels = new Map(generationItems.map((item) => [item.id === "current" && item.generationId ? item.generationId : item.id, item.label]));
    for (const member of items) for (const id of memberGenerations(member)) if (!labels.has(id)) labels.set(id, id);
    const order = new Map(generationItems.map((item) => [item.id, item.order ?? 999]));
    return [...labels].sort(([a], [b]) => (order.get(a) ?? 999) - (order.get(b) ?? 999) || a.localeCompare(b, "ko"));
  }, [generationItems, items]);
  const sorted = useMemo(() => [...items]
    .filter((member) => generation === "All" || memberGenerations(member).includes(generation))
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name, "ko")), [generation, items]);

  if (loading) return <CollectionLoading text="구성원을 불러오는 중입니다." />;
  if (error) return <CollectionError text="구성원 정보를 불러오지 못했습니다." onRetry={retry} />;

  return (
    <div>
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

export function RecruitmentPanel({ compact = false }: { compact?: boolean }) {
  const { recruitment, loading, error, retry } = useRecruitment();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const Heading = compact ? "h2" : "h1";

  if (loading) return <div className={`recruitment-panel ${compact ? "compact" : ""}`} aria-busy="true"><p>모집 정보를 불러오는 중입니다.</p></div>;
  if (error) return <div className={`recruitment-panel ${compact ? "compact" : ""}`} role="alert"><div><p>모집 정보를 불러오지 못했습니다.</p><button className="button" type="button" onClick={retry}>다시 시도</button></div></div>;
  if (!recruitment) return <div className={`recruitment-panel ${compact ? "compact" : ""}`}><div><span className="status-badge status-closed">현재 모집 없음</span><Heading>다음 모집을 준비하고 있습니다</Heading><p>확정된 모집 일정과 지원 방법은 이 페이지에서 안내합니다.</p></div></div>;

  const effectiveStatus = effectiveRecruitmentStatus(recruitment, now);
  const status = recruitmentStatuses[effectiveStatus];
  const date = formatDateRange(recruitment.startDate, recruitment.endDate);
  const applyUrl = safeHref(recruitment.applyUrl);
  return (
    <div className={`recruitment-panel ${compact ? "compact" : ""} ${effectiveStatus === "open" && applyUrl ? "is-open" : ""}`}>
      <div>
        <span className={`status-badge status-${effectiveStatus}`}>{status[0]}</span>
        <p className="eyebrow">{recruitment.id}</p>
        <Heading>{recruitment.title}</Heading>
        <p>{recruitment.description}</p>
        {date && <p className="recruitment-date">{date}</p>}
      </div>
      {effectiveStatus === "open" && applyUrl
        ? <a className="button button-light" href={applyUrl} target="_blank" rel="noopener noreferrer" onClick={() => trackAnalyticsEvent("recruit_apply_click")}>{status[1]} <span aria-hidden="true">↗</span></a>
        : <span className="recruitment-unavailable">{effectiveStatus === "open" ? "지원 링크 준비 중" : status[1]}</span>}
    </div>
  );
}

export function RecruitmentDetails() {
  const { recruitment, loading, error, retry } = useRecruitment();
  if (loading) return <CollectionLoading text="모집 절차를 불러오는 중입니다." />;
  if (error) return <CollectionError text="모집 절차를 불러오지 못했습니다." onRetry={retry} />;
  if (!recruitment) return <EmptyState headingLevel="h3" title="공개된 모집 절차가 없습니다" text="모집이 확정되면 절차와 FAQ를 안내합니다." />;

  return (
    <>
      {recruitment.process?.length
        ? <ol className="process-list">{recruitment.process.map((step, index) => <li key={`${step}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><strong>{step}</strong></li>)}</ol>
        : <EmptyState headingLevel="h3" title="모집 절차가 아직 등록되지 않았습니다" text="확정된 절차만 안내합니다." />}
      {recruitment.faq?.length ? <div className="faq-list">{recruitment.faq.map((item, index) => <details key={`${item.question}-${index}`}><summary>{item.question}<span aria-hidden="true">＋</span></summary><p>{item.answer}</p></details>)}</div> : null}
    </>
  );
}

export function RecruitmentRoles() {
  const { recruitment, loading, error, retry } = useRecruitment();
  if (loading) return <CollectionLoading text="모집 역할을 불러오는 중입니다." />;
  if (error) return <CollectionError text="모집 역할을 불러오지 못했습니다." onRetry={retry} />;
  const roles = recruitment?.roles?.filter((role) => role === "Member" || role === "Team Member") ?? [];
  if (!roles.length) return <EmptyState headingLevel="h3" title="공개된 모집 역할이 없습니다" text="모집 역할이 확정되면 안내합니다." />;
  return <div className="role-cards">{roles.map((role) => <article key={role}><span>{role.toUpperCase()}</span><h3>{role}</h3><p>{roleDescription(role)}</p></article>)}</div>;
}

export function EmptyState({ title, text, headingLevel = "h2" }: { title: string; text: string; headingLevel?: "h2" | "h3" }) {
  const Heading = headingLevel;
  return <div className="empty-state" role="status"><span aria-hidden="true">＋</span><Heading>{title}</Heading><p>{text}</p></div>;
}

function CollectionLoading({ text }: { text: string }) {
  return <p className="collection-state" role="status" aria-busy="true">{text}</p>;
}

function CollectionError({ text, onRetry }: { text: string; onRetry: () => void }) {
  return <div className="inline-notice" role="alert"><p>{text}</p><button className="button button-secondary" type="button" onClick={onRetry}>다시 시도</button></div>;
}

function memberGenerations(member: Member) {
  return member.activityGenerations?.filter(Boolean).length ? member.activityGenerations : member.generation ? [member.generation] : [];
}

function compareActivities(a: Activity, b: Activity) {
  return (a.order ?? 999) - (b.order ?? 999) || (b.startDate || "").localeCompare(a.startDate || "") || a.title.localeCompare(b.title, "ko") || a.id.localeCompare(b.id);
}

function compareProjects(a: Project, b: Project) {
  return (a.order ?? 999) - (b.order ?? 999) || a.title.localeCompare(b.title, "ko") || a.id.localeCompare(b.id);
}

function formatDateRange(start?: string, end?: string) {
  if (start && end) return `${start} — ${end}`;
  return start || end || "";
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
