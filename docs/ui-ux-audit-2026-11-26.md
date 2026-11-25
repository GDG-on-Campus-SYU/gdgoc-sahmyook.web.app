# GDGOC Sahmyook UI/UX 점검과 수정 계획

2026년 11월 26일 KST · 소스 기준 `7809735` · 공개 사이트와 관리자 5개 메뉴

같은 날 우선순위에 따라 수정했다. 아래 표의 문제와 측정값은 수정 전 기준이며, 변경 내용과 재검증 결과는 [적용 결과](#적용-결과)에서 확인할 수 있다.

**첫 수정은 관리자 편집 중의 데이터 유실 두 건이다.** 구성원 기수를 해제했다가 다시 선택하면 저장된 역할 이력이 사라진다. 활동을 저장한 직후 추가로 입력한 제목도 먼저 보낸 저장 요청이 끝나면 사라진다. 둘 다 로컬 에뮬레이터에서 재현했다.

공개 사이트는 GDG 색상과 서체, 일관된 제목·버튼, 한국어 설명 덕분에 같은 챕터의 사이트라는 인상이 분명하다. 개선 효과가 가장 큰 곳은 정보의 순서다. 휴대폰으로 활동을 보러 온 사람은 홈에서 소개와 가치 카드 네 장을 지나야 하고, 구성원을 찾는 사람은 실제 이름보다 세 개의 역할 설명을 먼저 읽게 된다. [홈](https://gdgoc-sahmyook.web.app/) · [사람들](https://gdgoc-sahmyook.web.app/people/)

## 판단 근거와 범위

| 확인한 곳 | 관찰한 결과 |
|---|---|
| 운영 공개 화면 | Chrome에서 홈·소개·활동·프로젝트·사람들·모집·방문 분석 안내·관리자 로그인과 활동/프로젝트 상세 기본 주소를 열었다. 이 10개 경로에서 320·390·768·1440px 모두 문서의 가로 넘침이 없었다. 실제 활동 카드에서 과육톤 상세로 이동했다. 별도 잘못된 주소는 404로 응답했다. |
| 운영 콘텐츠와 상호작용 | 점검 시점에 사이트 활동 카드 1건, 공식 행사 링크 5건, 공개 프로젝트 0건, 공개 프로필 1건이었다. 모집은 종료였고 외부 지원 버튼은 없었다. FAQ 8개 중 첫 항목을 키보드로 열었다. 모바일 메뉴의 초점 이탈, 카테고리 변경, 상세에서 목록 복귀, 첫 방문 분석 배너의 거부를 조작했다. |
| 로컬 관리자 | 같은 소스의 Chrome과 Firebase Auth·Firestore 에뮬레이터에서 합성 편집자 계정으로 활동·프로젝트·구성원·모집·기수의 목록과 수정 폼을 390·768·1440px에서 확인했다. 저장 지연, 목록 조회 실패, 기수 해제·재선택도 합성 데이터로 재현했다. |
| 로컬 프로젝트 상세 | 공개 프로젝트가 있는 경우를 합성 데이터로 보완했다. 390·1440px의 익명 Chrome에서 기수 선택→프로젝트 상세→목록 복귀를 확인했다. 제목·본문·기술·참여자가 표시됐고 두 폭 모두 목록 복귀 시 기수 선택이 초기화됐다. |
| 근거의 한계 | 화면 좌표는 해당 콘텐츠와 Chrome 뷰포트에서 측정한 CSS 픽셀이다. 운영 계정의 편집 이력, 실제 지원 제출, 실기기 Safari·Android와 스크린 리더 사용성, 방문자의 이탈률은 확인하지 않았다. 화면과 코드에서 확인한 문제를 이용자 피해 건수로 환산하지 않았다. |

## P1 · 먼저 수정할 문제

P1은 입력한 정보가 복구 없이 사라지거나 지원 가능 여부를 잘못 안내할 수 있는 문제다. 앞의 두 건은 다음 관리자 배포의 첫 작업으로, 모집 시간은 다음 시간제 마감 공고가 열리기 전에 처리한다.

| 순서 | 재현·영향 | 수정과 완료 기준 |
|---|---|---|
| 1. 구성원 기수 이력 보존 | 합성 구성원의 기존 기수에 ‘Team Member / 서버’가 있었다. 같은 폼에서 해당 기수를 껐다가 켜면 둘 다 공란이 됐다. 저장·재열기 후 에뮬레이터 문서에서도 이력 배열이 비었다. [기수 선택 처리](https://github.com/GDG-on-Campus-SYU/gdgoc-sahmyook.web.app/blob/78097358e7c721cc0a9154178129dcc7fa8394b3/src/components/admin-console.tsx#L330) · [저장 전 검사](https://github.com/GDG-on-Campus-SYU/gdgoc-sahmyook.web.app/blob/78097358e7c721cc0a9154178129dcc7fa8394b3/src/components/admin-console.tsx#L383) | 편집 중에는 기수별 입력을 보관하고 최종 저장 때 선택된 기수만 반영한다. 해제→재선택→저장→재열기 후 역할·담당이 같아야 한다. 해제 상태로 저장할 때는 빠질 이력을 보여준다. 기존에 이력이 없는 구성원도 편집할 수 있어야 한다. |
| 2. 저장 중 후속 입력 보호 | 활동의 저장 응답을 지연시키고 새 제목을 입력했다. 입력란은 계속 편집 가능했지만 응답이 도착하자 폼이 닫혔고 처음 보낸 제목만 목록에 남았다. 다섯 메뉴가 같은 폼을 쓴다. [저장과 폼 종료](https://github.com/GDG-on-Campus-SYU/gdgoc-sahmyook.web.app/blob/78097358e7c721cc0a9154178129dcc7fa8394b3/src/components/admin-console.tsx#L243) · [저장 버튼](https://github.com/GDG-on-Campus-SYU/gdgoc-sahmyook.web.app/blob/78097358e7c721cc0a9154178129dcc7fa8394b3/src/components/admin-console.tsx#L452) | 저장 중인 폼의 입력과 폼을 바꾸는 조작을 함께 잠그고 진행 상태를 알린다. 이전 요청의 응답은 해당 편집 세션에만 반영한다. 지연·연속 클릭에서도 수락한 입력은 보존되고, 실패 시 같은 폼에 입력값과 재시도가 남아야 한다. |
| 3. 모집 마감 시각과 지원 버튼 일치 | 운영 공고 본문은 9월 12일 **18시 마감**을 명시한다. 같은 날짜와 수동 상태 `open`을 넣어 현재 함수를 실행하면 KST 18:01과 23:59에 모두 `open`, 다음 날 00:00에 `closed`다. 한편 운영의 현재 공고는 정상적으로 종료를 표시한다. 당시 실제 접수 여부는 미확인이다. [운영 공고](https://gdgoc-sahmyook.web.app/recruit/) · [상태 계산](https://github.com/GDG-on-Campus-SYU/gdgoc-sahmyook.web.app/blob/78097358e7c721cc0a9154178129dcc7fa8394b3/src/lib/recruitment-status.ts#L3) | 운영자가 선택적으로 KST 마감 시각을 입력하게 하고 홈·공고·관리 목록·편집 미리보기에 같은 판정을 쓴다. 18시 마감 표본으로 직전·마감 시점·직후의 상태와 외부 지원 버튼을 확인한다. 시간 없는 기존 문서는 종전처럼 종료일 전체를 포함하고 수동 종료도 존중한다. [모집 입력 필드](https://github.com/GDG-on-Campus-SYU/gdgoc-sahmyook.web.app/blob/78097358e7c721cc0a9154178129dcc7fa8394b3/src/lib/admin-config.ts#L74) · [저장 규칙](https://github.com/GDG-on-Campus-SYU/gdgoc-sahmyook.web.app/blob/78097358e7c721cc0a9154178129dcc7fa8394b3/firestore.rules#L114) |

## P2 · 핵심 업무와 탐색 개선

관리자는 어두운 사이드바와 흰 편집 영역으로 공개 사이트와 구분되고, 다섯 메뉴의 작성·수정 동작이 일정하다. 특히 미저장 변경 폐기 확인, 동시 편집 충돌 감지, 보관한 항목의 비공개 복원은 개편 후에도 지켜야 할 동작이다. [편집기](https://github.com/GDG-on-Campus-SYU/gdgoc-sahmyook.web.app/blob/78097358e7c721cc0a9154178129dcc7fa8394b3/src/components/admin-console.tsx#L114) · [저장·복원 처리](https://github.com/GDG-on-Campus-SYU/gdgoc-sahmyook.web.app/blob/78097358e7c721cc0a9154178129dcc7fa8394b3/src/lib/admin-writes.ts#L19)

| 작업 | 현재 경험 | 수정 후 확인할 장면 |
|---|---|---|
| 관리자 목록 오류 복구 | 첫 조회를 실패시키자 오류와 ‘등록된 항목 없음’이 동시에 나오고 재시도 버튼은 0개였다. 기수 옵션 조회가 실패한 작성 폼도 같은 자리에서 다시 불러올 수 없다. [목록 분기](https://github.com/GDG-on-Campus-SYU/gdgoc-sahmyook.web.app/blob/78097358e7c721cc0a9154178129dcc7fa8394b3/src/components/admin-console.tsx#L240) · [기수 옵션](https://github.com/GDG-on-Campus-SYU/gdgoc-sahmyook.web.app/blob/78097358e7c721cc0a9154178129dcc7fa8394b3/src/components/admin-console.tsx#L311) | 최초 오류에는 오류와 재시도, 성공한 0건에는 첫 등록 안내를 보여준다. 이전 결과가 있으면 마지막 목록임을 표시한다. 같은 화면에서 한 번 재시도해 목록·기수 선택지를 복구하고 작성 중인 값과 검색어를 유지한다. |
| 관리자 모바일·태블릿 목록 | 390px에서 다섯 표의 표시 폭은 356px, 내용은 590~637px이었다. ‘수정’의 시작점이 화면 왼쪽에서 480~527px여서 옆으로 밀어야 한다. 768px에서는 사이드바와 표 때문에 문서 자체가 879~926px로 넓어졌다. [관리 표](https://github.com/GDG-on-Campus-SYU/gdgoc-sahmyook.web.app/blob/78097358e7c721cc0a9154178129dcc7fa8394b3/src/components/admin-console.tsx#L250) · [반응형 CSS](https://github.com/GDG-on-Campus-SYU/gdgoc-sahmyook.web.app/blob/78097358e7c721cc0a9154178129dcc7fa8394b3/src/app/globals.css#L278) | 휴대폰은 제목·공개 상태·수정을 한 행이나 카드 안에 먼저 배치하고 ID와 날짜를 보조 영역에 둔다. 태블릿은 사이드바와 본문 최소 너비를 조정한다. 320·390·768px에서 문서 가로 스크롤 없이 임의의 항목을 수정하고 1440px에서는 열 단위 비교가 가능해야 한다. |
| 관리자 긴 폼과 복귀 | 측정한 수정 폼 15회 모두 첫 초점은 ‘닫기’였다. 390px 프로젝트 폼은 높이 2,571px로, 입력을 마친 뒤 어느 항목이 어떻게 공개되는지 확인하기 어렵다. 권한 조회 실패 때 제공하는 ‘다시 로그인’은 로그아웃을 실행한다. [첫 초점](https://github.com/GDG-on-Campus-SYU/gdgoc-sahmyook.web.app/blob/78097358e7c721cc0a9154178129dcc7fa8394b3/src/components/admin-console.tsx#L295) · [인증 복구](https://github.com/GDG-on-Campus-SYU/gdgoc-sahmyook.web.app/blob/78097358e7c721cc0a9154178129dcc7fa8394b3/src/components/admin-console.tsx#L97) | 첫 초점을 편집 제목 또는 첫 입력에 보내고 필드를 기본 정보·상세·공개 설정 순으로 묶는다. 공개된 활동·프로젝트는 저장 후 공개본을 바로 열 수 있게 한다. 권한 조회는 현재 계정으로 재시도하고 계정 변경은 별개 동작으로 제공한다. 취소·저장 후 목록 초점 복귀를 재확인한다. |
| 모집·기수 운영 | 이미 공고가 있는 기수에도 ‘새 모집 추가’가 열려 긴 공고를 입력한 뒤 중복을 알게 된다. 합성 공고에서는 관리자 목록에 `open`, 편집 미리보기에는 ‘모집 종료’가 표시됐다. 현재 기수에도 보관 버튼이 있다. [관리 목록](https://github.com/GDG-on-Campus-SYU/gdgoc-sahmyook.web.app/blob/78097358e7c721cc0a9154178129dcc7fa8394b3/src/components/admin-console.tsx#L237) · [기수별 문서 ID](https://github.com/GDG-on-Campus-SYU/gdgoc-sahmyook.web.app/blob/78097358e7c721cc0a9154178129dcc7fa8394b3/src/components/admin-console.tsx#L267) · [저장 제약](https://github.com/GDG-on-Campus-SYU/gdgoc-sahmyook.web.app/blob/78097358e7c721cc0a9154178129dcc7fa8394b3/src/lib/admin-writes.ts#L66) | 현재 기수의 공고 유무·보관 여부에 따라 추가·수정·복원 중 가능한 작업으로 연결한다. 공개 여부와 실제 모집 상태를 따로 보여준다. 현재 기수 보관 자리에는 다른 기수를 먼저 지정하는 방법을 표시한다. |
| 홈·소개·사람들 정보 순서 | 390×844에서 홈의 첫 실제 활동 카드 상단은 **2,924px**, 사람들 기수 필터는 **1,182px**, 첫 프로필은 **1,277px**였다. 프로필보다 앞에 역할 카드 세 장이 쌓인다. 소개 페이지에서도 대표 링크는 외부 공식 챕터로 향한다. [홈 구성](https://github.com/GDG-on-Campus-SYU/gdgoc-sahmyook.web.app/blob/78097358e7c721cc0a9154178129dcc7fa8394b3/src/app/page.tsx#L23) · [사람들 구성](https://github.com/GDG-on-Campus-SYU/gdgoc-sahmyook.web.app/blob/78097358e7c721cc0a9154178129dcc7fa8394b3/src/app/people/page.tsx#L9) · [소개](https://github.com/GDG-on-Campus-SYU/gdgoc-sahmyook.web.app/blob/78097358e7c721cc0a9154178129dcc7fa8394b3/src/app/about/page.tsx#L23) | 홈 첫 화면에 ‘활동 보기’를 두고 최근 기록을 가치 카드보다 앞에 배치한다. 소개에서도 챕터 자체 기록으로 연결한다. 사람들에서는 필터·프로필을 역할 설명 앞으로 옮긴다. 390×844에서 첫 화면에 활동 진입점과 사람들 페이지의 첫 공개 프로필 이름이 보이고, 홈에서 활동 상세를 두 번 이내의 선택으로 열 수 있어야 한다. |
| 활동·프로젝트 필터와 복귀 | 운영 활동에서 ‘Study’를 선택하면 ‘조건에 맞는 활동이 없습니다’ 아래에 별도 공식 행사 5건이 계속 보였다. ‘Session’에서 과육톤 상세를 열고 ‘← 활동 목록’을 누르면 카테고리가 ‘전체’로 돌아갔다. 합성 프로젝트에서도 상세의 목록 링크로 돌아오면 선택했던 기수가 풀렸다. [활동 목록](https://github.com/GDG-on-Campus-SYU/gdgoc-sahmyook.web.app/blob/78097358e7c721cc0a9154178129dcc7fa8394b3/src/app/activities/page.tsx#L18) · [필터](https://github.com/GDG-on-Campus-SYU/gdgoc-sahmyook.web.app/blob/78097358e7c721cc0a9154178129dcc7fa8394b3/src/components/public-content.tsx#L66) · [상세 복귀](https://github.com/GDG-on-Campus-SYU/gdgoc-sahmyook.web.app/blob/78097358e7c721cc0a9154178129dcc7fa8394b3/src/components/detail-view.tsx#L23) | 필터가 적용되는 ‘챕터 활동 기록’에 결과 수·초기화를 붙이고, 별도인 ‘공식 채널 행사’의 범위를 명시한다. 기수·카테고리를 URL에 보존한다. 실제 카드 선택→상세→목록, 새로고침, 공유 주소에서 같은 조건과 결과가 나오고 기존 상세 주소도 열린다. |
| 공통 모바일 메뉴·모집 진입 | 소개 페이지에서 마지막 메뉴 링크 다음으로 Tab을 누르면 초점은 본문 링크로 가는데 메뉴는 열린 채였다. 바깥 제목을 눌러도 열려 있었다. 데스크톱의 ‘Recruit’와 ‘Join us ↗’는 같은 내부 경로다. 홈 하단의 종료된 모집 패널에서는 공고·FAQ로 이동할 수 없다. [모바일 메뉴](https://github.com/GDG-on-Campus-SYU/gdgoc-sahmyook.web.app/blob/78097358e7c721cc0a9154178129dcc7fa8394b3/src/components/mobile-nav.tsx#L12) · [데스크톱 메뉴](https://github.com/GDG-on-Campus-SYU/gdgoc-sahmyook.web.app/blob/78097358e7c721cc0a9154178129dcc7fa8394b3/src/components/desktop-nav.tsx#L10) · [모집 패널](https://github.com/GDG-on-Campus-SYU/gdgoc-sahmyook.web.app/blob/78097358e7c721cc0a9154178129dcc7fa8394b3/src/components/public-content.tsx#L246) | 메뉴 밖 탭·초점 이동·페이지 전환 때 메뉴를 닫고 Escape는 트리거로 초점을 돌린다. 내부 모집 진입은 ‘모집 안내’, 열려 있는 외부 폼은 ‘지원하기’로 표시한다. 마감 후에도 홈 모집 패널에서 일정과 FAQ까지 갈 수 있어야 한다. |

## P3 · 콘텐츠와 마무리

- **프로젝트 빈 상태** — 운영 프로젝트 목록은 준비 상태를 명확히 알린다. 홈에서는 큰 빈 섹션을 짧은 안내로 줄이고, 목록에는 지금 볼 수 있는 활동 링크를 둔다. 첫 프로젝트를 게시하면 기존 프로젝트 목록과 상세가 다시 주된 경로가 되어야 한다. [프로젝트 목록](https://github.com/GDG-on-Campus-SYU/gdgoc-sahmyook.web.app/blob/78097358e7c721cc0a9154178129dcc7fa8394b3/src/components/public-content.tsx#L118)
- **상세 자료 링크** — 활동은 관련 URL을 줄 단위로 저장하고 공개 화면은 호스트명만 읽어 준다. 운영자는 잘못된 줄을 저장 전에 고칠 수 있게 하고, 같은 호스트의 발표 자료·공식 행사 등은 용도로 구분한다. 기존 URL만 있는 문서도 계속 연다. [등록 필드](https://github.com/GDG-on-Campus-SYU/gdgoc-sahmyook.web.app/blob/78097358e7c721cc0a9154178129dcc7fa8394b3/src/lib/admin-config.ts#L32) · [상세 링크](https://github.com/GDG-on-Campus-SYU/gdgoc-sahmyook.web.app/blob/78097358e7c721cc0a9154178129dcc7fa8394b3/src/components/detail-view.tsx#L78)
- **한국어 복구 경로** — 잘못된 상세 주소에는 한국어 설명과 목록 복귀가 있지만 일반 404 본문은 영문 한 줄이다. 한국어 안내와 홈·활동 목록 링크를 두고 실제 Hosting에서 응답 코드 404와 복귀를 확인한다.
- **유지할 접근성** — 본문 바로가기와 초점 표시, 키보드로 여는 FAQ, 모바일 메뉴의 Escape, 접근 가능한 이름이 붙은 동의·거부 버튼을 회귀 검사에 포함한다. 첫 방문 분석 배너는 390×844에서 약 167px 높이였고 두 선택 모두 보였다. 작은 화면에서 배너가 열린 채로도 새 주요 버튼을 조작할 수 있어야 한다. [공통 레이아웃](https://github.com/GDG-on-Campus-SYU/gdgoc-sahmyook.web.app/blob/78097358e7c721cc0a9154178129dcc7fa8394b3/src/app/layout.tsx#L25) · [분석 선택](https://github.com/GDG-on-Campus-SYU/gdgoc-sahmyook.web.app/blob/78097358e7c721cc0a9154178129dcc7fa8394b3/src/components/analytics.tsx#L45)

## 실행 순서와 검증

| 배포 단위 | 담당과 선행 결정 | 배포 전 확인 |
|---|---|---|
| 1. 관리자 입력 보존과 재시도 | 프런트엔드가 공용 편집 폼·목록부터 수정한다. 기수 선택의 임시 상태와 저장 완료 시 폼 종료를 한 흐름으로 검토한다. | 에뮬레이터에서 기수 해제·복구, 의도적 제거, 지연 저장·실패·재시도, 다른 편집자의 충돌을 재현한다. 저장된 문서와 다시 연 폼 둘 다 비교한다. 기존 보관→비공개 복원과 공개 동의 동작도 확인한다. |
| 2. 모집 정확성 | 다음 공고 작성 전 모집 담당자가 지원 폼의 마감 시각을 확인한다. 개발은 선택 시각과 저장 규칙·구형 공고 호환을 먼저 반영한 뒤 같은 판정을 모든 화면에 연결한다. | 시각 있는 공고·날짜만 있는 공고·수동 종료·공고 없음으로 홈과 모집 상세, 관리자 목록과 미리보기를 비교한다. 열린 상태의 외부 링크 목적지는 테스트 URL로 확인한다. |
| 3. 관리자 화면 재배치 | 운영진이 자주 쓰는 목록 행과 장문 폼부터 진행한다. 목록·필드의 데이터 모델은 그대로 두고 정보의 순서를 바꾼다. | 5개 메뉴에서 320·390·768·1440px로 검색→수정→저장→같은 행 복귀를 수행한다. 좁은 화면의 버튼 위치, 키보드 순서와 새 입력 초점을 확인한다. |
| 4. 공개 탐색과 문구 | 콘텐츠 담당자와 ‘최근 활동·프로필·모집 안내’의 이름을 확정한다. 홈·사람들 순서, 필터·복귀, 메뉴 닫힘을 작은 변경으로 나눠 적용한다. | 같은 390×844에서 카드·필터의 세로 위치를 다시 기록한다. 운영에서는 공개된 활동 목록→상세→조건 보존과 모집 종료를 읽기 위주로 점검한다. 실기기 터치와 스크린 리더로 메뉴·필터·배너를 한 차례 확인한다. |

각 변경에서는 `pnpm typecheck`와 관련 단위 테스트를 실행한다. 저장 규칙이 달라지는 모집 변경에는 `pnpm test:rules`, 배포 후보에는 기존 CI의 린트·정적 빌드·에뮬레이터 검사를 적용한다. 운영에 로그인해 테스트 콘텐츠를 게시할 필요 없이 공개 화면과 관리자 작성 흐름을 각각 검증할 수 있다. [기존 브라우저 검사](../tests/site-emulator.e2e.mjs) · [CI](../.github/workflows/firebase-hosting.yml)

## 적용 결과

| 영역 | 변경과 확인 |
|---|---|
| 관리자 입력 보존 | ‘이전 기수’를 해제했다가 다시 선택해 저장한 뒤 Firestore에서 기존 역할과 담당을 확인했다. 해제 상태로 저장하면 제외될 이력이 먼저 표시되고 그 기수의 이력만 빠진다. 저장 응답을 지연시키면 입력·취소·새 작성·관리 메뉴·로그아웃이 잠긴다. 실패한 저장은 폼에서 값을 복구해 재시도할 수 있다. [관리자 회귀 검사](../tests/site-emulator.e2e.mjs) |
| 관리자 목록·폼 | 320·390·768·1440px에서 5개 메뉴를 열었다. 20개 조합 모두 문서 가로 넘침 없이 수정 버튼을 누르고 첫 입력으로 이동했다. 저장·취소 뒤에는 원래 버튼으로 초점이 돌아왔다. 목록과 기수 옵션을 오프라인에서 실패시킨 뒤 같은 화면에서 복구했다. 현재 모집의 추가·수정·복원, 현재 기수 보관 방지, 공개본 링크도 확인했다. [관리 업무 검사](../tests/admin-workflows.e2e.mjs) |
| 모집 | 선택형 한국시간 마감 시각을 추가했다. 18시 공고를 연 홈과 모집 탭은 18:00부터 지원 링크를 숨긴다. 날짜만 지정한 기존 공고는 종료일 전체를 포함하고 수동 마감은 그대로 적용한다. 홈의 ‘모집 안내’는 종료 뒤에도 공고로 연결된다. [상태 계산 검사](../tests/recruitment-status.test.mjs) |
| 공개 탐색 | 홈에 ‘활동 보기’를 두고 최근 기록을 앞으로 옮겼다. 사람들 목록은 역할 설명보다 먼저 표시한다. 활동·프로젝트 필터와 결과 수, 상세 왕복, 공유 주소 새로고침, 필터 초기화를 확인했다. 기존 프로젝트의 문서 ID와 slug가 다른 경우도 열렸다. [공개 탐색 검사](../tests/public-navigation.e2e.mjs) |
| 빈 화면과 자료 링크 | 합성 프로젝트를 비공개로 바꾸자 홈은 짧은 안내를, 목록은 활동 링크를 표시했다. 다시 공개하자 카드와 상세가 복원됐다. 잘못된 관련 링크는 저장 전에 행 번호로 안내했고, 상세에서 이름을 붙인 자료와 기존 URL의 목적지 주소를 확인했다. 일반 404에서 한국어 안내와 활동 목록 복귀도 확인했다. |

운영 공개 데이터를 읽는 로컬 최종 빌드를 같은 390×844 Chrome 화면에서 다시 측정했다. 표의 값은 페이지 상단에서 각 요소 상단까지의 CSS 픽셀이다.

| 요소 | 수정 전 운영 화면 | 수정 후 로컬 빌드 |
|---|---:|---:|
| 홈의 첫 실제 활동 카드 | 2,924px | 1,239px |
| 사람들 페이지의 기수 필터 영역 | 1,182px | 420px |
| 첫 공개 프로필 카드 | 1,277px | 515px |

390px 홈의 ‘활동 보기’는 441px, 첫 공개 프로필의 이름은 570px에 표시됐다. 320×640에서는 첫 방문 분석 배너가 버튼을 덮던 문제를 추가로 수정했다. 버튼 하단은 445px, 배너 상단은 461px였고 실제 Chrome 터치 에뮬레이션에서 활동 목록이 열렸다.

타입 검사, 린트, 단위 테스트 17건, Firestore 규칙·공개 조회 테스트 17건, 정적 빌드를 통과했다. 합성 계정으로 관리자 쓰기를 검증한 뒤, 프로젝트의 기존 설정으로 다시 빌드해 로컬 Hosting에서 공개 데이터로 `pnpm verify:site`를 실행했다. 실제 과육톤 상세, 종료된 모집과 FAQ 8개, 관리자 로그인 진입, 존재하지 않는 주소의 404 응답과 복귀를 확인했다.

기존 날짜 전용 공고는 그대로 읽는다. 향후 시간제 공고는 운영자가 마감 시각을 입력해야 한다. 이번 수정은 작업공간에 적용했으며 운영 배포는 미실행이다. 실제 운영자 계정, 실기기 iOS·Android와 스크린 리더 음성 출력은 후속 확인 대상이다.
