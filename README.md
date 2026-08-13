# Saju Me

생년월일만 알려 주면 사주와 연애운을 함께 읽어 주는 웹 앱입니다.

[Vite](https://vite.dev/) + React로 만들고, [ssaju](https://www.npmjs.com/package/ssaju)로 명식을 계산한 뒤 Gemini로 해석합니다. 로그인한 사용자는 해석과 기본 정보를 Supabase에 남겨 둘 수 있습니다.

## 기능

- 양력/음력, 성별, 출생 시간으로 사주 명식(시·일·월·년주)과 만나이 계산
- 전체 사주 해석 / 연애운 해석
- Google 로그인 후 해석 저장, 다시 보기, 삭제
- 내 기본 정보 기억하기 (다음 입력에 바로 채움)
- 결과 공유 (네이티브 공유 또는 클립보드 복사)
- Google Analytics 4 (`G-MCYEV4XB25`) 페이지뷰 및 주요 액션 이벤트

## 시작하기

```bash
npm install
cp .env.example .env
npm run dev
```

`.env`에 아래 값을 채웁니다.

| 변수 | 설명 |
| --- | --- |
| `VITE_GEMINI_API_KEY` | Gemini API 키 |
| `VITE_SUPABASE_URL` | Supabase 프로젝트 URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (legacy anon key도 가능) |

Supabase에는 Google OAuth와 아래 테이블이 필요합니다.

- `saju_readings` — 저장된 해석
- `profiles` — 사용자 기본 생년월일 정보

Auth redirect URL은 앱 origin과 같아야 합니다. (로컬은 `http://localhost:5173`)

## 스크립트

```bash
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run preview  # 빌드 미리보기
npm run lint     # oxlint
```

## 구조

```
src/
  App.jsx              # 화면 상태와 해석 흐름
  components/          # Hero, 입력 폼, 결과, 사이드바, 토스트
  hooks/               # 인증, 토스트
  lib/
    saju.js            # 명식 계산
    gemini.js          # 해석 프롬프트 / API
    readings.js        # 저장된 해석
    profiles.js        # 기본 정보
    auth.js            # Google 로그인
    analytics.js       # GA4 이벤트
```

## Analytics

페이지 태그는 `index.html`의 `<head>`에 직접 설치되어 있습니다. 주요 이벤트:

| 이벤트 | 시점 |
| --- | --- |
| `login` / `login_success` / `login_error` | Google 로그인 |
| `logout` | 로그아웃 |
| `generate_reading` | 사주/연애운 읽기 시작 (`reading_kind`) |
| `generate_reading_success` | 해석 성공 |
| `generate_reading_error` | 해석 실패 |
| `share` | 결과 나누기 |
| `save_profile` | 내 기본 정보 저장 |
| `save_reading_info` | 입력 정보만 저장 |
| `new_reading` | 새 사주 만들기 |
| `select_content` | 남겨 둔 해석 선택 |
| `delete_reading` | 기록 삭제 |

이름·이메일 같은 개인정보는 보내지 않습니다. 로그인 시 GA `user_id`만 연결합니다.
