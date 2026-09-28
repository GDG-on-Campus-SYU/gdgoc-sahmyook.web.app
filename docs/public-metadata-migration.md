# 공개 문서 메타데이터 이전

현재 `members`, `activities`, `projects`, `recruitment`, `generations`의 공개 문서는 Firestore에서 익명 사용자에게 **문서 전체**가 반환됩니다. UI에서 필드를 숨겨도 `createdBy`, `updatedBy`, `archivedBy`, `consentConfirmedAt`, `consentConfirmedBy`는 노출됩니다.

`node scripts/audit-public-metadata.mjs`는 익명으로 공개된 문서의 필드 존재 건수만 읽습니다. 2026-09-28에는 별도의 [전체 드라이런](https://github.com/GDG-on-Campus-SYU/gdgoc-sahmyook.web.app/actions/runs/36424360657)이 운영 권한으로 문서 6건을 검사해 이전 대상 5건, 충돌·동의 누락 0건을 확인했습니다. 값과 문서 ID는 로그에 출력하지 않았습니다.

이전 시 각 공용 문서의 다섯 필드 중 존재하는 값을 `internalMetadata/{collectionId}/documents/{documentId}`로 옮기고, 원본에서 삭제합니다. `generations/current`도 포함합니다. `createdAt`, `updatedAt`, `archivedAt`은 공개 날짜 정보로 남깁니다. 이미 동의가 확인된 구성원의 시각·담당자 값은 그대로 이전하며, 누락된 동의를 추정하거나 새로 만들지 않습니다.

Spark 프로젝트에서는 관리형 Firestore 내보내기/복원을 사용할 수 없습니다(Blaze 필요). 대신 이전 스크립트는 제거할 값을 비공개 메타데이터 문서에 그대로 보존하며, 복사와 원본 필드 삭제를 문서별 원자적 커밋으로 실행합니다. 양쪽 문서의 변경 시각을 전제조건으로 확인하고, 충돌이나 공개 구성원의 동의 누락이 있으면 적용 전에 중단합니다. 외부 독립 백업은 없지만 옮긴 원본 값은 비공개 문서에서 복구할 수 있습니다.

운영 적용 중에는 기존 관리자 화면에서 추가 편집을 멈춰야 합니다. `MIGRATION_MODE=apply` 실행 후 스크립트가 전체 재검사를 통과하면 새 규칙·관리자 코드를 배포하고, 익명 공개 문서에서 다섯 필드가 사라졌는지 다시 확인합니다. 규칙만 먼저 배포하면 구형 문서의 관리자 수정이 거부될 수 있습니다.
