# GDGoC Sahmyook

GDGoC Sahmyook의 공식 웹사이트이자 활동 아카이브입니다. Next.js App Router를 정적 export하고 Firebase Hosting, Firestore, Authentication, Storage를 사용합니다.

## 로컬 실행

```bash
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

Firebase 값이 없을 때도 공개 페이지는 검증되지 않은 활동이나 인물을 꾸며내지 않고 준비 상태로 실행됩니다. Admin은 Firebase 설정 전까지 연결 안내만 표시합니다.

## Firebase 설정

1. Firebase Console에서 Web App, Firestore, Authentication의 Google Provider, Storage, Hosting을 활성화합니다.
2. `.env.local`에 `.env.example`의 공개 Web App 설정을 입력합니다.
3. 최초 운영자는 Google 로그인 후 확인한 UID로 `users/{uid}` 문서를 만들고 `role`을 `admin` 또는 `editor`로 설정합니다.
4. `firebase deploy --only firestore:rules,storage`로 보안 규칙을 배포합니다.

공개 콘텐츠는 `published: true`, 구성원은 본인 동의 후 `visible: true`인 문서만 조회합니다. 이미지는 Admin 화면에서 업로드하며 대표 이미지와 프로필은 500KB, Storage Rules의 전체 상한은 2MB입니다.

## 검증과 배포

```bash
pnpm typecheck
pnpm lint
pnpm build
```

GitHub Actions 배포에는 Firebase 서비스 계정 JSON을 `FIREBASE_SERVICE_ACCOUNT` Secret으로, Firebase와 사이트 설정값을 같은 이름의 Repository Variables로 등록합니다. Pull Request는 Preview Channel, `main`은 Production Channel에 배포됩니다.

정적 Hosting에서 Firestore에 새로 추가한 상세 콘텐츠를 배포 없이 열 수 있도록 상세 URL은 `/activities/detail?slug=...`와 `/projects/detail?slug=...` 형식을 사용합니다.
