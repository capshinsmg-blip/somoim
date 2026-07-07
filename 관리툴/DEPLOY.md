# 배포 가이드 (clasp)

이 프로젝트는 **하나의 Apps Script**가 두 가지 웹앱을 서빙합니다. 접근 권한이 서로 달라서
`appsscript.json`의 `webapp.access` 값을 배포 대상에 맞게 바꿔가며 배포해야 합니다.

| 배포 | deploymentId (앞부분) | 용도 | 필요한 access |
|------|----------------------|------|--------------|
| 공개 API | `AKfycbyLzhL2tJzHQQQT5O_...` | 홈페이지(`docs/index.html`)가 fetch하는 `?api=events` / 신청 처리 | `ANYONE_ANONYMOUS` (로그인 없이 공개) |
| 관리자 | `AKfycbwXsGlkX3vjsP0uIX9...`, `AKfycbzgENH12OI5egcIwqd...` | 운영진 관리툴 | `ANYONE` (구글 로그인 필요 — `requireAuth_`가 신원 확인) |

> ⚠️ **주의:** 저장소의 `appsscript.json`은 기본값 `"access": "ANYONE"`(관리자 기준)으로 둡니다.
> 공개 API를 재배포할 때는 반드시 `ANYONE_ANONYMOUS`로 바꿔 push 후 배포해야 홈페이지가 로그인 없이 열립니다.
> (안 그러면 홈페이지 API가 구글 로그인 페이지로 리다이렉트되어 모임 목록이 안 뜹니다.)

## 사전 준비 (최초 1회)
```powershell
npm install -g @google/clasp
clasp login            # capshinsmg@gmail.com 로 승인
```

## 코드만 반영 (권한 변화 없음)
```powershell
cd 관리툴
clasp push --force
```
- HEAD(@HEAD dev URL)에는 즉시 반영. `/exec` 운영 URL은 아래 배포까지 안 바뀜.

## 공개 API 재배포 (홈페이지 반영)
```powershell
cd 관리툴
# 1) 익명 공개로 전환
#    appsscript.json → "access": "ANYONE_ANONYMOUS"
clasp push --force
clasp deploy -i AKfycbyLzhL2tJzHQQQT5O_fL5nhbOIzugDzozOCQClQIUewq8SKuJ7efG5oJomIi3BII1ch -d "설명"
# 2) 관리자용 기본값으로 복구
#    appsscript.json → "access": "ANYONE"
clasp push --force
# 확인: JSON이 나오면 정상 (로그인 페이지 HTML이면 실패)
#   https://script.google.com/macros/s/AKfycbyLzhL2tJzHQQQT5O_.../exec?api=events
```

## 관리자 재배포
```powershell
cd 관리툴
# appsscript.json 은 "access": "ANYONE" 상태여야 함 (기본값)
clasp push --force
clasp deploy -i AKfycbwXsGlkX3vjsP0uIX9TPuoF0mQwhdWNucWKdA4PKkiOrbdHgpJr-8J1ISP1nYJx2qwt -V <버전> -d "설명"
clasp deploy -i AKfycbzgENH12OI5egcIwqdiiGTZVK2imCDRtV_Zu_Hl0ioZhYOpeSo75ctQdeS8VPsxFiR8 -V <버전> -d "설명"
```

## 버전 아끼기 (200개 한도)
`clasp deploy -i <id>` 를 `-V` 없이 실행하면 매번 새 버전이 생깁니다.
여러 배포에 같은 코드를 반영할 땐 첫 배포에서 생긴 버전 번호를 확인한 뒤,
나머지는 `-V <그 번호>` 로 같은 버전을 재사용하세요.
