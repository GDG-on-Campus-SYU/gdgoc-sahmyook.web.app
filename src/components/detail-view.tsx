"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { usePublicDocument } from "@/lib/use-public-data";
import { archiveListHref, readArchiveFilters } from "@/lib/public-archive";
import { GenerationName } from "@/components/generation-name";
import type { Activity, Project } from "@/types/content";
import { trackAnalyticsEvent } from "@/lib/analytics-consent";
import { readLinkTitles } from "@/lib/activity-links";

export function ActivityDetail() {
  const params = useSearchParams();
  const listHref = archiveListHref("activities", readArchiveFilters("activities", params));
  const id = params.get("id");
  const { item: activity, loading, error, retry } = usePublicDocument<Activity>("activities", id ?? params.get("slug"), id === null);
  useDocumentTitle(activity?.title);

  if (loading) return <DetailLoading />;
  if (error) return <DetailError href={listHref} label="활동 목록" onRetry={retry} />;
  if (!activity) return <DetailMissing href={listHref} label="활동 목록" />;

  return (
    <article className="detail-page container">
      <Link className="back-link" href={listHref}>← 활동 목록</Link>
      <header className="detail-header">
        <div className="card-meta"><span>{activity.category}</span><span>{activity.status}</span></div>
        <h1>{activity.title}</h1>
        <p>{activity.summary}</p>
        <dl className="detail-meta">
          <div><dt>기간</dt><dd>{activity.startDate || "추후 안내"}{activity.endDate && ` — ${activity.endDate}`}</dd></div>
          <div><dt>기수</dt><dd><GenerationName id={activity.generation} /></dd></div>
          <div><dt>담당</dt><dd>{activity.host || "추후 안내"}</dd></div>
          {activity.participants && <div><dt>참여 인원</dt><dd>{activity.participants}</dd></div>}
        </dl>
      </header>
      <div className="detail-content">
        <p>{activity.content || activity.summary}</p>
        {Boolean(activity.links?.length) && <LinkList links={activity.links!} linkTitles={activity.linkTitles} />}
      </div>
    </article>
  );
}

export function ProjectDetail() {
  const params = useSearchParams();
  const listHref = archiveListHref("projects", readArchiveFilters("projects", params));
  const id = params.get("id");
  const { item: project, loading, error, retry } = usePublicDocument<Project>("projects", id ?? params.get("slug"), id === null);
  useDocumentTitle(project?.title);

  if (loading) return <DetailLoading />;
  if (error) return <DetailError href={listHref} label="프로젝트 목록" onRetry={retry} />;
  if (!project) return <DetailMissing href={listHref} label="프로젝트 목록" />;

  const sections = [
    ["Description", project.description], ["Problem", project.problem], ["Solution", project.solution], ["Result", project.result],
  ].filter(([, value]) => value);

  return (
    <article className="detail-page container">
      <Link className="back-link" href={listHref}>← 프로젝트 목록</Link>
      <header className="detail-header">
        <p className="eyebrow">Project · <GenerationName id={project.generation} /></p>
        <h1>{project.title}</h1>
        <p>{project.summary}</p>
        {Boolean(project.techStack?.length) && <ul className="tag-list">{project.techStack?.map((item) => <li key={item}>{item}</li>)}</ul>}
      </header>
      <div className="detail-content">
        {sections.length ? sections.map(([title, value]) => <section key={title}><h2>{title}</h2><p>{value}</p></section>) : <p>검증된 프로젝트 자료를 정리한 뒤 공개합니다.</p>}
        {Boolean(project.members?.length) && <section><h2>Team</h2><ul className="tag-list" aria-label="프로젝트 참여 구성원">{project.members?.map((member) => <li key={member}>{member}</li>)}</ul></section>}
        <div className="detail-actions">
          {safeHref(project.github) && <a className="button" href={safeHref(project.github)!} target="_blank" rel="noreferrer" onClick={() => trackAnalyticsEvent("project_github_click")}>GitHub ↗</a>}
          {safeHref(project.demo) && <a className="button button-secondary" href={safeHref(project.demo)!} target="_blank" rel="noreferrer">Live demo ↗</a>}
        </div>
      </div>
    </article>
  );
}

function LinkList({ links, linkTitles }: { links: string[]; linkTitles?: Activity["linkTitles"] }) {
  const titles = readLinkTitles(linkTitles);
  return <ul className="detail-links">{links.map((link, index) => safeHref(link) &&
    <li key={`${index}-${link}`}><a href={link} target="_blank" rel="noopener noreferrer">{titles.get(link) || link.replace(/^https?:\/\//i, "")} <span aria-hidden="true">↗</span></a></li>
  )}</ul>;
}

function DetailLoading() {
  return <div className="detail-state container" aria-busy="true">콘텐츠를 불러오는 중입니다.</div>;
}

function DetailMissing({ href, label }: { href: string; label: string }) {
  return <div className="detail-state container"><h1>콘텐츠를 찾을 수 없습니다</h1><p>주소가 올바른지 확인해 주세요.</p><Link className="button" href={href}>{label}으로 돌아가기</Link></div>;
}

function DetailError({ href, label, onRetry }: { href: string; label: string; onRetry: () => void }) {
  return <div className="detail-state container" role="alert"><h1>콘텐츠를 불러오지 못했습니다</h1><p>잠시 후 다시 시도해 주세요.</p><button className="button" type="button" onClick={onRetry}>다시 시도</button><Link className="button button-secondary" href={href}>{label}으로 돌아가기</Link></div>;
}

function safeHref(value?: string) {
  if (!value) return null;
  try { return ["http:", "https:"].includes(new URL(value).protocol) ? value : null; }
  catch { return null; }
}

function useDocumentTitle(title?: string) {
  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = `${title} | GDGOC Sahmyook`;
    return () => { document.title = previous; };
  }, [title]);
}
