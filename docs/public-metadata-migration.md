# 공개 문서 메타데이터 이전

2026년 9월 28일 운영 Firestore 문서 5건에서 작성·수정·보관 담당자와 구성원 동의 확인 정보를 비공개 문서로 옮겼습니다. 당시 적용 직후와 별도로 실행한 재검사에서 모두 남은 이전 대상이 0건이었습니다. [운영 적용 로그](https://github.com/GDG-on-Campus-SYU/gdgoc-sahmyook.web.app/actions/runs/36425206685) · [재검사 로그](https://github.com/GDG-on-Campus-SYU/gdgoc-sahmyook.web.app/actions/runs/36425852661)

## 이전 범위와 저장 위치

Firestore는 익명 사용자가 읽을 수 있는 문서의 모든 필드를 반환합니다. 이전 전에는 공개 문서에 저장된 `createdBy`, `updatedBy`, `archivedBy`, `consentConfirmedAt`, `consentConfirmedBy`를 UI에서 숨겨도 조회할 수 있었습니다.

운영 권한으로 `members`, `activities`, `projects`, `recruitment`, `generations`에서 `generations/current`를 포함한 문서 6건을 검사했습니다. 이 중 5건에 이전할 필드가 있었고 충돌과 동의 누락은 0건이었습니다. 값과 문서 ID는 로그에 출력하지 않았습니다. [적용 전 검사 로그](https://github.com/GDG-on-Campus-SYU/gdgoc-sahmyook.web.app/actions/runs/36424360657)

현재 관리자 화면은 해당 필드를 편집 권한이 있는 운영자만 읽을 수 있는 `internalMetadata/{collectionId}/documents/{documentId}`에 저장합니다. `createdAt`, `updatedAt`, `archivedAt`은 공개 문서에 남기는 날짜 정보입니다. [관리자 저장 코드](../src/lib/admin-writes.ts) · [Firestore 규칙](../firestore.rules)

## 구형 문서 이전 절차

1. 운영 권한으로 `MIGRATION_MODE=dry-run`을 실행해 전체 대상과 충돌·동의 누락 여부를 확인합니다. 공개 구성원의 동의 시각이나 담당자 값이 누락되면 적용 전에 중단합니다.
2. 적용할 문서가 있으면 구형 관리자 화면에서 편집을 멈추고 `MIGRATION_MODE=apply`를 실행합니다. 스크립트는 두 문서의 변경 시각을 확인하고, 비공개 문서로 복사하는 작업과 원본 필드 삭제를 문서별로 한 번에 반영합니다. 당시 Spark 프로젝트에는 외부 독립 백업이 없었고, 이전한 원본 값은 비공개 문서에 보존했습니다.
3. 적용 후 스크립트가 전체 문서를 재검사합니다. 구형 환경을 전환할 때는 이 검사가 통과한 뒤 새 규칙과 관리자 코드를 배포합니다. 규칙을 먼저 배포하면 구형 문서의 관리자 수정이 거부될 수 있습니다.

공개 문서만 다시 점검하려면 저장소 루트에서 `node --env-file=.env.local scripts/audit-public-metadata.mjs`를 실행합니다. 이 명령은 익명으로 읽을 수 있는 문서를 조회해 다섯 필드가 남은 문서 수를 필드별로 출력합니다.
