"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { loadCurrentGeneration } from "@/lib/use-current-generation";
import { usePublicCollection } from "@/lib/use-public-data";
import { PageHero } from "@/components/site-shell";
import type { Activity, Generation, Member, Project, Recruitment } from "@/types/content";

const categories = ["All", "Study", "Session", "Project", "Networking", "Hackathon", "Collaboration"];
const recruitmentStatuses = {
  upcoming: ["모집 예정", "Recruitment coming soon"],
  open: ["모집 중", "Apply now"],
  closed: ["모집 종료", "Recruitment closed"],
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
  }, []);

  return { recruitment, loading, error };
}

function Media({ label, shortLabel = label.slice(0, 1) }: { label: string; shortLabel?: string }) {
  return <div className="card-image media-placeholder" aria-label={label} role="img"><span>{shortLabel}</span><i /></div>;
}

export function PeopleHero() {
  return <PageHero eyebrow="People" title="커뮤니티를 만드는 사람들" description="프로필과 외부 링크는 본인이 공개에 동의한 경우에만 표시합니다." />;
}

export function ActivityCollection({ compact = false }: { compact?: boolean }) {
  const { items, loading, error } = usePublicCollection<Activity>("activities");
  const [category, setCategory] = useState("All");
  const sorted = useMemo(() => [...items].sort(compareActivities), [items]);
  const filtered = useMemo(() => category === "All" ? sorted : sorted.filter((item) => item.category === category), [category, sorted]);
  const visibleItems = compact ? filtered.slice(0, 3) : filtered;

  if (loading) return <CollectionLoading text="활동을 불러오는 중입니다." />;
  if (error) return <CollectionError text="활동을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." />;

  return (
    <div>
      {!compact && (
        <div className="filter-row" role="group" aria-label="활동 카테고리 필터">
          {categories.map((item) => <button key={item} className={category === item ? "active" : ""} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}
        </div>
      )}
      {visibleItems.length ? (
        <div className="activity-grid">
          {visibleItems.map((activity, index) => {
            const Heading = compact ? "h3" : "h2";
            return (
              <article className={`activity-card accent-${index % 4}`} key={activity.id}>
                <Media label={`${activity.category} 활동`} />
                <div className="card-body">
                  <div className="card-meta"><span>{activity.category}</span><span>{activity.status}</span></div>
                  <Heading>{activity.title}</Heading>
                  <p>{activity.summary}</p>
                  <div className="card-footer">
                    <span>{activity.startDate || activity.generation}</span>
                    <Link href={`/activities/detail/?slug=${encodeURIComponent(activity.slug)}`} aria-label={`${activity.title} 자세히 보기`}>자세히 보기 <span aria-hidden="true">→</span></Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState headingLevel={compact ? "h3" : "h2"} title={category === "All" ? "아직 등록된 활동이 없습니다" : `${category} 활동이 없습니다`} text={category === "All" ? "새 활동 기록이 공개되면 이곳에 표시됩니다." : "다른 카테고리를 선택해 보세요."} />
      )}
    </div>
  );
}

export function ProjectCollection({ compact = false }: { compact?: boolean }) {
  const { items, loading, error } = usePublicCollection<Project>("projects");
  const sorted = useMemo(() => [...items].sort(compareProjects), [items]);
  const visibleItems = compact ? sorted.slice(0, 2) : sorted;

  if (loading) return <CollectionLoading text="프로젝트를 불러오는 중입니다." />;
  if (error) return <CollectionError text="프로젝트를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." />;
  if (!visibleItems.length) return <EmptyState headingLevel={compact ? "h3" : "h2"} title="아직 공개된 프로젝트가 없습니다" text="프로젝트 기록이 공개되면 이곳에 표시됩니다." />;

  return (
    <div className="project-list">
      {visibleItems.map((project, index) => {
        const Heading = compact ? "h3" : "h2";
        return (
          <article className="project-card" key={project.id}>
            <div className="project-visual"><Media label={`${project.title} 프로젝트`} shortLabel={String(index + 1).padStart(2, "0")} /></div>
            <div className="project-copy">
              <p className="eyebrow">Project · {project.generation}</p>
              <Heading>{project.title}</Heading>
              <p>{project.summary}</p>
              {Boolean(project.techStack?.length) && <ul className="tag-list" aria-label="사용 기술">{project.techStack?.map((tech) => <li key={tech}>{tech}</li>)}</ul>}
              <Link href={`/projects/detail/?slug=${encodeURIComponent(project.slug)}`} className="text-link" aria-label={`${project.title} 프로젝트 보기`}>프로젝트 보기 <span aria-hidden="true">→</span></Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function PeopleCollection() {
  const { items, loading, error } = usePublicCollection<Member>("members", "visible");
  const { items: generationItems } = usePublicCollection<Generation>("generations");
  const [generation, setGeneration] = useState("All");
  const generations = useMemo(() => {
    const labels = new Map(generationItems.map((item) => [item.id === "current" && item.generationId ? item.generationId : item.id, item.label]));
    for (const member of items) for (const id of memberGenerations(member)) if (!labels.has(id)) labels.set(id, id);
    return [...labels].sort(([a], [b]) => a.localeCompare(b, "ko"));
  }, [generationItems, items]);
  const sorted = useMemo(() => [...items]
    .filter((member) => generation === "All" || memberGenerations(member).includes(generation))
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name, "ko")), [generation, items]);

  if (loading) return <CollectionLoading text="구성원을 불러오는 중입니다." />;
  if (error) return <CollectionError text="구성원 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." />;

  return (
    <div>
      {generations.length > 0 && (
        <div className="filter-row" role="group" aria-label="활동 기수 필터">
          <button className={generation === "All" ? "active" : ""} aria-pressed={generation === "All"} onClick={() => setGeneration("All")}>전체</button>
          {generations.map(([id, label]) => <button key={id} className={generation === id ? "active" : ""} aria-pressed={generation === id} onClick={() => setGeneration(id)}>{label}</button>)}
        </div>
      )}
      {sorted.length ? (
        <div className="people-grid">
          {sorted.map((member) => (
            <article className="person-card" key={member.id}>
              <MemberAvatar key={member.github || "avatar"} member={member} />
              <div><p>{member.role}</p><h2>{member.name}</h2>{member.position && <span>{member.position}</span>}</div>
              {memberGenerations(member).length > 0 && <ul className="member-generations" aria-label={`${member.name} 활동 기수`}>{memberGenerations(member).map((id) => <li key={id}>{generations.find(([generationId]) => generationId === id)?.[1] || id}</li>)}</ul>}
              {member.description && <p className="person-description">{member.description}</p>}
              <div className="social-links">
                {safeHref(member.github) && <a href={safeHref(member.github)!} target="_blank" rel="noopener noreferrer">GitHub ↗</a>}
                {safeHref(member.linkedin) && <a href={safeHref(member.linkedin)!} target="_blank" rel="noopener noreferrer">LinkedIn ↗</a>}
                {safeHref(member.website) && <a href={safeHref(member.website)!} target="_blank" rel="noopener noreferrer">Website ↗</a>}
              </div>
            </article>
          ))}
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
  const { recruitment, loading, error } = useRecruitment();
  const Heading = compact ? "h2" : "h1";

  if (loading) return <div className={`recruitment-panel ${compact ? "compact" : ""}`} aria-busy="true"><p>모집 정보를 불러오는 중입니다.</p></div>;
  if (error) return <div className={`recruitment-panel ${compact ? "compact" : ""}`} role="alert"><p>모집 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p></div>;
  if (!recruitment) return <div className={`recruitment-panel ${compact ? "compact" : ""}`}><div><span className="status-badge status-closed">현재 모집 없음</span><Heading>다음 모집을 준비하고 있습니다</Heading><p>확정된 모집 일정과 지원 방법은 이 페이지에서 안내합니다.</p></div></div>;

  const status = recruitmentStatuses[recruitment.status] ?? recruitmentStatuses.closed;
  const date = formatDateRange(recruitment.startDate, recruitment.endDate);
  return (
    <div className={`recruitment-panel ${compact ? "compact" : ""}`}>
      <div>
        <span className={`status-badge status-${recruitment.status}`}>{status[0]}</span>
        <p className="eyebrow">{recruitment.id}</p>
        <Heading>{recruitment.title}</Heading>
        <p>{recruitment.description}</p>
        {date && <p className="recruitment-date">{date}</p>}
      </div>
      {recruitment.status === "open" && safeHref(recruitment.applyUrl)
        ? <a className="button button-light" href={safeHref(recruitment.applyUrl)!} target="_blank" rel="noopener noreferrer" onClick={() => track("recruit_apply_click")}>{status[1]} <span aria-hidden="true">↗</span></a>
        : <span className="button button-disabled" aria-disabled="true">{status[1]}</span>}
    </div>
  );
}

export function RecruitmentDetails() {
  const { recruitment, loading, error } = useRecruitment();
  if (loading) return <CollectionLoading text="모집 절차를 불러오는 중입니다." />;
  if (error) return <CollectionError text="모집 절차를 불러오지 못했습니다." />;
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
  const { recruitment, loading, error } = useRecruitment();
  if (loading) return <CollectionLoading text="모집 역할을 불러오는 중입니다." />;
  if (error) return <CollectionError text="모집 역할을 불러오지 못했습니다." />;
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

function CollectionError({ text }: { text: string }) {
  return <p className="inline-notice" role="alert">{text}</p>;
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

function track(event: string) {
  (window as Window & { gtag?: (...args: unknown[]) => void }).gtag?.("event", event);
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
