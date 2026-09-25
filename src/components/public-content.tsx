"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { starterActivities, starterProjects, starterRecruitment } from "@/lib/starter-content";
import { loadCurrentGeneration, useCurrentGeneration } from "@/lib/use-current-generation";
import { usePublicCollection } from "@/lib/use-public-data";
import { PageHero } from "@/components/site-shell";
import type { Activity, Member, Project, Recruitment } from "@/types/content";

const categories = ["All", "Study", "Session", "Project", "Networking", "Hackathon", "Collaboration"];
const emptyMembers: Member[] = [];
let recruitmentRequest: Promise<Recruitment> | null = null;

function loadRecruitment() {
  if (!db) return Promise.resolve(starterRecruitment);
  const activeDb = db;
  if (!recruitmentRequest) {
    recruitmentRequest = loadCurrentGeneration()
      .then(({ generationId }) => getDoc(doc(activeDb, "recruitment", generationId)))
      .then((snapshot) => snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } as Recruitment : starterRecruitment)
      .finally(() => { recruitmentRequest = null; });
  }
  return recruitmentRequest;
}

function useRecruitment() {
  const [recruitment, setRecruitment] = useState<Recruitment>(starterRecruitment);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    loadRecruitment()
      .then((value) => active && setRecruitment(value))
      .catch(() => active && setError(true));
    return () => { active = false; };
  }, []);

  return { recruitment, error };
}

function Media({ label }: { label: string }) {
  return <div className="card-image media-placeholder" aria-hidden="true"><span>{label.slice(0, 1)}</span><i /></div>;
}

export function PeopleHero() {
  const { generation } = useCurrentGeneration();
  return <PageHero eyebrow={`People · ${generation.label}`} title="커뮤니티를 만드는 사람들" description="프로필과 외부 링크는 본인이 공개에 동의한 경우에만 표시합니다." />;
}

export function ActivityCollection({ compact = false }: { compact?: boolean }) {
  const { items, loading, error } = usePublicCollection<Activity>("activities", starterActivities);
  const [category, setCategory] = useState("All");
  const filtered = useMemo(
    () => (category === "All" ? items : items.filter((item) => item.category === category)),
    [category, items],
  );
  const visibleItems = compact ? filtered.slice(0, 3) : filtered;

  return (
    <div aria-busy={loading}>
      {!compact && (
        <div className="filter-row" role="group" aria-label="활동 카테고리 필터">
          {categories.map((item) => (
            <button key={item} className={category === item ? "active" : ""} aria-pressed={category === item} onClick={() => setCategory(item)}>
              {item}
            </button>
          ))}
        </div>
      )}
      {error && <p className="inline-notice" role="status">실시간 데이터를 불러오지 못해 준비된 안내를 표시합니다.</p>}
      {visibleItems.length ? (
        <div className="activity-grid">
          {visibleItems.map((activity, index) => (
            <article className={`activity-card accent-${index % 4}`} key={activity.id}>
              <Media label={activity.category} />
              <div className="card-body">
                <div className="card-meta">
                  <span>{activity.category}</span>
                  <span>{activity.status}</span>
                </div>
                <h3>{activity.title}</h3>
                <p>{activity.summary}</p>
                <div className="card-footer">
                  <span>{activity.startDate || activity.generation}</span>
                  <Link href={`/activities/detail/?slug=${encodeURIComponent(activity.slug)}`}>
                    자세히 보기 <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="아직 등록된 활동이 없습니다" text="새 활동 기록이 공개되면 이곳에 표시됩니다." />
      )}
    </div>
  );
}

export function ProjectCollection({ compact = false }: { compact?: boolean }) {
  const { items, loading, error } = usePublicCollection<Project>("projects", starterProjects);
  const visibleItems = compact ? items.slice(0, 2) : items;

  return (
    <div aria-busy={loading}>
      {error && <p className="inline-notice" role="status">실시간 데이터를 불러오지 못해 준비된 안내를 표시합니다.</p>}
      <div className="project-list">
        {visibleItems.map((project, index) => (
          <article className="project-card" key={project.id}>
            <div className="project-visual">
              <Media label={`0${index + 1}`} />
            </div>
            <div className="project-copy">
              <p className="eyebrow">Project · {project.generation}</p>
              <h3>{project.title}</h3>
              <p>{project.summary}</p>
              {Boolean(project.techStack?.length) && (
                <ul className="tag-list" aria-label="사용 기술">
                  {project.techStack?.map((tech) => <li key={tech}>{tech}</li>)}
                </ul>
              )}
              <Link href={`/projects/detail/?slug=${encodeURIComponent(project.slug)}`} className="text-link">
                프로젝트 보기 <span aria-hidden="true">→</span>
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function PeopleCollection() {
  const { items, loading, error } = usePublicCollection<Member>("members", emptyMembers, "visible");
  const { generation } = useCurrentGeneration();
  const sorted = items
    .filter((member) => !member.generation || normalizeGeneration(member.generation) === normalizeGeneration(generation.generationId))
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  if (!sorted.length && !loading) {
    return <EmptyState title="구성원 소개를 준비하고 있어요" text="공개 동의를 마친 프로필부터 차례로 소개합니다." />;
  }

  return (
    <div className="people-grid" aria-busy={loading}>
      {error && <p className="inline-notice" role="status">구성원 정보를 불러오지 못했습니다.</p>}
      {sorted.map((member) => {
        const avatar = githubAvatarUrl(member.github);
        return <article className="person-card" key={member.id}>
          {avatar ? (
            <Image src={avatar} alt={`${member.name} GitHub 프로필`} width={160} height={160} />
          ) : (
            <div className="avatar" aria-hidden="true">{member.name.slice(0, 1)}</div>
          )}
          <div>
            <p>{member.role}</p>
            <h3>{member.name}</h3>
            <span>{member.position}</span>
          </div>
          <div className="social-links">
            {safeHref(member.github) && <a href={safeHref(member.github)!} target="_blank" rel="noreferrer">GitHub ↗</a>}
            {safeHref(member.linkedin) && <a href={safeHref(member.linkedin)!} target="_blank" rel="noreferrer">LinkedIn ↗</a>}
            {safeHref(member.website) && <a href={safeHref(member.website)!} target="_blank" rel="noreferrer">Website ↗</a>}
          </div>
        </article>;
      })}
    </div>
  );
}

export function RecruitmentPanel({ compact = false }: { compact?: boolean }) {
  const { recruitment, error } = useRecruitment();
  const Heading = compact ? "h2" : "h1";

  const status = {
    upcoming: ["모집 예정", "Recruitment coming soon"],
    open: ["모집 중", "Apply now"],
    closed: ["모집 종료", "Recruitment closed"],
  }[recruitment.status];

  return (
    <div className={`recruitment-panel ${compact ? "compact" : ""}`}>
      <div>
        {error && <p className="inline-notice" role="status">모집 정보를 불러오지 못해 준비된 안내를 표시합니다.</p>}
        <span className={`status-badge status-${recruitment.status}`}>{status[0]}</span>
        <p className="eyebrow">{recruitment.id}</p>
        <Heading>{recruitment.title}</Heading>
        <p>{recruitment.description}</p>
        {(recruitment.startDate || recruitment.endDate) && (
          <p className="recruitment-date">{recruitment.startDate} — {recruitment.endDate}</p>
        )}
      </div>
      {recruitment.status === "open" && safeHref(recruitment.applyUrl) ? (
        <a className="button button-light" href={safeHref(recruitment.applyUrl)!} target="_blank" rel="noreferrer" onClick={() => track("recruit_apply_click")}>
          {status[1]} <span aria-hidden="true">↗</span>
        </a>
      ) : (
        <span className="button button-disabled" aria-disabled="true">{status[1]}</span>
      )}
    </div>
  );
}

export function RecruitmentDetails() {
  const { recruitment } = useRecruitment();

  const process = recruitment.process?.length ? recruitment.process : ["공식 모집 절차 공개 예정"];
  const faq = recruitment.faq?.length ? recruitment.faq : [
    { question: "개발을 잘해야 지원할 수 있나요?", answer: "현재 기수의 상세 지원 자격은 모집 공고에서 안내합니다. GDGoC Sahmyook은 실력만큼 배우고 나누려는 태도를 중요하게 생각합니다." },
    { question: "모집 소식은 어디에서 확인하나요?", answer: "공식 모집 일정과 지원 링크가 확정되면 이 페이지에 가장 먼저 반영합니다." },
  ];

  return (
    <>
      <ol className="process-list">
        {process.map((step, index) => (
          <li key={step}><span>{String(index + 1).padStart(2, "0")}</span><strong>{step}</strong></li>
        ))}
      </ol>
      <div className="faq-list">
        {faq.map((item) => (
          <details key={item.question}>
            <summary>{item.question}<span aria-hidden="true">＋</span></summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </>
  );
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state" role="status">
      <span aria-hidden="true">＋</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
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

function normalizeGeneration(value: string) {
  return value.trim().replace(/[–—]/g, "-");
}
