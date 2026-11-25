import Link from "next/link";

export const metadata = { title: "페이지를 찾을 수 없습니다" };

export default function NotFound() {
  return (
    <section className="detail-state container">
      <h1>페이지를 찾을 수 없습니다</h1>
      <p>주소를 확인하거나 아래에서 원하는 페이지로 이동해 주세요.</p>
      <div className="button-row">
        <Link className="button" href="/">홈으로</Link>
        <Link className="button button-secondary" href="/activities/">활동 목록</Link>
      </div>
    </section>
  );
}
