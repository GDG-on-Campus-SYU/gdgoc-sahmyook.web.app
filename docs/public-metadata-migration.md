# 공개 문서 메타데이터 이전 (운영 실행 미승인)

현재 `members`, `activities`, `projects`, `recruitment`, `generations`의 공개 문서는 Firestore에서 익명 사용자에게 **문서 전체**가 반환됩니다. UI에서 필드를 숨겨도 `createdBy`, `updatedBy`, `archivedBy`, `consentConfirmedAt`, `consentConfirmedBy`는 노출됩니다.

이 브랜치는 새 관리자 저장 경로와 보안 규칙만 준비합니다. 운영 문서 이전 및 규칙 배포는 별도 승인 전까지 하지 않습니다. `node scripts/audit-public-metadata.mjs`는 공개 문서의 필드 존재 건수만 읽고 값을 출력하거나 쓰지 않습니다. 비공개 초안은 익명 권한으로 검사할 수 없으므로 운영 권한을 사용한 전체 드라이런이 추가로 필요합니다.

이전 시 각 공용 문서의 다섯 필드 중 존재하는 값을 `internalMetadata/{collectionId}/documents/{documentId}`로 옮기고, 원본에서 삭제합니다. `generations/current`도 포함합니다. `createdAt`, `updatedAt`, `archivedAt`은 공개 날짜 정보로 남깁니다. 이미 동의가 확인된 구성원의 시각·담당자 값은 그대로 이전하며, 누락된 동의를 추정하거나 새로 만들지 않습니다.

실행 전에는 Firestore 내보내기/복구 수단과 운영 권한을 확인하고, 전체 문서별 필드 수·메타데이터 충돌·공개 구성원의 동의 누락을 값 노출 없이 드라이런으로 보고해야 합니다. 충돌 또는 동의 누락이 있으면 중단합니다. 승인 후 문서별 원본/메타데이터 변경을 원자적으로 처리하고, 익명 공개 문서에서 다섯 필드가 모두 사라졌는지 확인한 다음에만 이 브랜치의 규칙·관리자 코드를 운영 배포합니다. 배포 전에는 기존 관리자 화면을 사용한 추가 편집을 멈춰야 합니다. 규칙만 먼저 배포하면 구형 문서의 관리자 수정이 거부될 수 있습니다.
