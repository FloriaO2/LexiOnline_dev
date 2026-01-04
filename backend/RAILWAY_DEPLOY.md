# Railway 배포 가이드

이 가이드는 LexiOnline 백엔드와 PostgreSQL 데이터베이스를 Railway에 배포하는 방법을 설명합니다.

## 사전 준비

1. [Railway](https://railway.app) 계정 생성
2. GitHub 저장소 준비 (선택사항, 자동 배포를 원하는 경우)

## 빠른 시작 (5분 가이드)

1. **Railway 대시보드 접속** → **"New Project"** 클릭
2. **PostgreSQL 추가**: **"New"** → **"Database"** → **"Add PostgreSQL"**
3. **백엔드 배포**: **"New"** → **"GitHub Repo"** → 저장소 선택
4. **Root Directory 설정**: 백엔드 서비스의 **"Settings"** → **"Root Directory"**를 `backend`로 설정
5. **환경 변수 설정**: 백엔드 서비스의 **"Variables"** 탭에서:
   - PostgreSQL 서비스의 `DATABASE_URL`을 `PRISMA_DATABASE_URL`로 참조
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` 설정
   - **`GOOGLE_REDIRECT_URI`**: 프론트엔드의 콜백 URL 설정 (예: `https://your-frontend.vercel.app/auth/google/callback`)
   - `JWT_SECRET` 설정
6. **도메인 생성**: **"Settings"** → **"Generate Domain"**
7. **배포 완료!** 🎉

## 1. PostgreSQL 데이터베이스 생성

1. Railway 대시보드에서 **"New Project"** 클릭
2. **"New"** → **"Database"** → **"Add PostgreSQL"** 선택
3. 데이터베이스가 생성되면, **"Variables"** 탭에서 다음 정보 확인:
   - `DATABASE_URL` (자동 생성됨)
   - `DATABASE_PUBLIC_URL` (자동 생성됨) ⚠️ **이것을 사용하세요**
   - `PGHOST`
   - `PGPORT`
   - `PGUSER`
   - `PGPASSWORD`
   - `PGDATABASE`

### PostgreSQL 서비스 확인 사항

PostgreSQL 서비스가 **"Online"** 상태로 떠있다면 기본 설정은 완료된 것입니다. 추가 설정이 필요하지 않습니다.

**확인할 사항**:
- ✅ 서비스 상태가 **"Online"**인지 확인
- ✅ **"Variables"** 탭에서 `DATABASE_URL`과 `DATABASE_PUBLIC_URL`이 생성되어 있는지 확인
- ✅ 백엔드 서비스와 같은 프로젝트에 있는지 확인 (같은 프로젝트여야 Reference Variable 사용 가능)

**Public Networking 설정**:
- Railway가 자동으로 생성한 Public Networking 설정(`switchyard.proxy.rlwy.net:30326` 등)은 **그대로 두세요**
- "Generate Domain" 버튼은 커스텀 도메인을 생성하는 것이며, 필수는 아닙니다
- `DATABASE_PUBLIC_URL` 환경 변수가 이미 올바른 값을 포함하고 있으므로 추가 설정 불필요

**추가 설정이 필요한 경우**:
- 특별한 PostgreSQL 확장(extensions)이 필요한 경우에만 추가 설정 필요
- 현재 프로젝트는 표준 PostgreSQL 기능만 사용하므로 추가 설정 불필요

## 2. 백엔드 서비스 생성

### 방법 A: GitHub 연동 (권장)

1. Railway 대시보드에서 **"New Project"** 클릭
2. **"Deploy from GitHub repo"** 선택
3. 저장소 선택 (전체 저장소가 연결됩니다)
4. **Root Directory 설정**:
   - 백엔드 서비스의 **"Settings"** 탭으로 이동
   - **"Root Directory"** 섹션에서 `backend` 입력
   - 또는 `railway.json` 파일에 `"rootDirectory": "backend"`가 이미 설정되어 있으면 자동으로 적용됩니다
5. Railway가 자동으로 `backend` 폴더의 Dockerfile을 감지합니다

**참고**: `railway.json` 파일에 `rootDirectory`가 설정되어 있으면, Railway가 자동으로 `backend` 폴더를 루트로 인식합니다.

### 방법 B: CLI를 통한 배포

```bash
# Railway CLI 설치
npm i -g @railway/cli

# 로그인
railway login

# 프로젝트 초기화
cd backend
railway init

# 배포
railway up
```

## 3. 환경 변수 설정

Railway 대시보드에서 백엔드 서비스의 **"Variables"** 탭에서 다음 환경 변수를 설정합니다:

### 필수 환경 변수

Railway 대시보드의 백엔드 서비스 **"Variables"** 탭에서 다음 환경 변수를 설정합니다:

```bash
# PostgreSQL 연결 (PostgreSQL 서비스의 DATABASE_URL을 사용)
# Railway의 PostgreSQL 서비스를 연결하면 자동으로 DATABASE_URL이 생성됩니다
# 백엔드 서비스에서 이 값을 PRISMA_DATABASE_URL로 복사하거나 참조합니다
PRISMA_DATABASE_URL=${DATABASE_URL}

# Node.js 환경
NODE_ENV=production
# PORT는 Railway가 자동으로 할당하므로 설정하지 않아도 됩니다
# 하지만 명시적으로 설정하려면 Railway가 제공하는 PORT 값을 사용하세요

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
# 중요: GOOGLE_REDIRECT_URI는 프론트엔드의 콜백 URL입니다 (백엔드 URL이 아님!)
# 로컬 개발: http://localhost:3000/auth/google/callback
# 프로덕션: https://your-frontend-domain.vercel.app/auth/google/callback
GOOGLE_REDIRECT_URI=https://your-frontend-domain.vercel.app/auth/google/callback

# JWT Secret (강력한 랜덤 문자열 사용)
JWT_SECRET=your_strong_random_jwt_secret_key
```

### 환경 변수 설정 방법

Railway에서는 같은 프로젝트 내의 다른 서비스(PostgreSQL)의 환경 변수를 참조할 수 있습니다. 

**중요: `DATABASE_URL` vs `DATABASE_PUBLIC_URL`**

Railway의 PostgreSQL 서비스는 두 가지 URL을 제공합니다:

- **`DATABASE_URL`**: 프라이빗 네트워크용 (같은 프로젝트 내 서비스 간 통신)
  - 런타임에만 사용 가능
  - 더 빠르고 안전함
  - 추가 비용 없음
  - ⚠️ **빌드 단계에서는 접근할 수 없어 오류 발생 가능**

- **`DATABASE_PUBLIC_URL`**: 퍼블릭 네트워크용 (외부 접근)
  - 빌드 및 런타임 모두에서 사용 가능 ✅
  - 로컬 개발 환경에서 사용
  - 외부 도구(Prisma Studio 등)에서 사용
  - **Railway 배포 시 권장** ✅

**Railway에 배포할 때는 `DATABASE_PUBLIC_URL`을 사용하는 것이 권장됩니다.**
빌드 단계에서도 접근 가능하므로 Prisma 마이그레이션 및 클라이언트 생성이 정상적으로 작동합니다.

**방법 1: Reference Variable 사용 (권장) - 자동 동기화**

이 방법은 PostgreSQL의 `DATABASE_URL`이 변경되면 자동으로 백엔드에도 반영됩니다.

1. Railway 대시보드에서 **백엔드 서비스** 선택
2. **"Variables"** 탭으로 이동
3. **"New Variable"** 버튼 클릭
4. **"Reference Variable"** 옵션 선택 (일반 변수 입력이 아닌 참조 옵션)
5. 드롭다운에서 **PostgreSQL 서비스** 선택
6. PostgreSQL 서비스의 **`DATABASE_PUBLIC_URL`** 변수 선택 ⚠️
   - **중요**: 빌드 단계에서도 접근 가능하도록 `DATABASE_PUBLIC_URL`을 사용하세요
   - `DATABASE_URL`은 런타임에만 사용 가능하며 빌드 시 오류를 발생시킬 수 있습니다
7. 백엔드에서 사용할 변수 이름을 **`PRISMA_DATABASE_URL`**로 입력
8. 저장

이제 백엔드에서 `PRISMA_DATABASE_URL` 환경 변수를 사용하면 PostgreSQL의 `DATABASE_URL` 값이 자동으로 사용됩니다.

**방법 2: 수동 설정 - 값 복사 (가장 간단한 방법)**

PostgreSQL의 `DATABASE_PUBLIC_URL` 값을 직접 복사하여 백엔드의 `PRISMA_DATABASE_URL`에 붙여넣는 방법입니다.

**단계별 가이드**:

1. Railway 대시보드에서 **PostgreSQL 서비스** 선택
2. **"Variables"** 탭으로 이동
3. **`DATABASE_PUBLIC_URL`** 변수를 찾아서 값 복사 (클릭하면 복사 버튼이 나타남)
   - 값 형식: `postgresql://user:password@host.railway.app:5432/railway`
   - ⚠️ **`DATABASE_URL`이 아닌 `DATABASE_PUBLIC_URL`을 복사하세요**
4. **백엔드 서비스**로 이동
5. **"Variables"** 탭에서 **"New Variable"** 클릭
6. 변수 이름: **`PRISMA_DATABASE_URL`** (정확히 이 이름으로!)
   - Prisma 스키마에서 `env("PRISMA_DATABASE_URL")`을 사용하므로 이 이름이어야 합니다
7. 변수 값: 복사한 `DATABASE_PUBLIC_URL` 값 붙여넣기
8. 저장

**완료!** 이제 재배포하면 됩니다.

**주의**: 
- 변수 이름은 정확히 `PRISMA_DATABASE_URL`이어야 합니다 (대소문자 구분)
- PostgreSQL의 `DATABASE_PUBLIC_URL`을 복사해야 합니다 (`DATABASE_URL`이 아님)
- 값이 변경되면 수동으로 다시 복사해야 합니다 (Reference Variable을 사용하면 자동 동기화됨)

**빌드 오류가 발생하는 경우**

만약 빌드 단계에서 `Can't reach database server at postgres.railway.internal:5432` 오류가 발생한다면, 빌드 시에는 프라이빗 네트워크에 접근할 수 없기 때문입니다.

**해결 방법: 빌드 시 `DATABASE_PUBLIC_URL` 사용**

Railway의 빌드 단계에서는 프라이빗 네트워크에 접근할 수 없으므로, 빌드 시에만 `DATABASE_PUBLIC_URL`을 사용하도록 설정해야 합니다:

1. 백엔드 서비스의 **"Variables"** 탭에서
2. `PRISMA_DATABASE_URL`을 **`DATABASE_PUBLIC_URL`**로 참조 (빌드 및 런타임 모두 사용)
   - 또는 두 개의 변수를 모두 설정:
     - `PRISMA_DATABASE_URL`: `DATABASE_URL` 참조 (런타임용)
     - `PRISMA_DATABASE_URL_BUILD`: `DATABASE_PUBLIC_URL` 참조 (빌드용)

**권장 방법: `DATABASE_PUBLIC_URL` 사용**

Railway에서 Prisma를 사용할 때는 `DATABASE_PUBLIC_URL`을 사용하는 것이 더 안정적입니다:

1. 백엔드 서비스의 **"Variables"** 탭에서
2. **"New Variable"** → **"Reference Variable"** 선택
3. PostgreSQL 서비스의 **`DATABASE_PUBLIC_URL`** 선택
4. 변수 이름: **`PRISMA_DATABASE_URL`**
5. 저장

이렇게 하면 빌드와 런타임 모두에서 작동합니다.

**어떤 방법을 사용해야 하나요?**
- **방법 1 (Reference Variable)**: PostgreSQL URL이 변경되어도 자동으로 동기화되므로 권장합니다
- **방법 2 (수동 설정)**: Reference Variable이 작동하지 않을 때 사용하거나, 특정 이유로 직접 값을 설정해야 할 때 사용합니다

### CORS 설정 업데이트

`src/app.config.ts`의 CORS 설정에 Railway 도메인을 추가해야 합니다:

```typescript
app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://lexionline-dev.vercel.app",
    "https://your-railway-app.up.railway.app" // Railway 도메인 추가
  ],
  credentials: true,
}));
```

## 4. 데이터베이스 마이그레이션

Railway는 Dockerfile의 `docker-entrypoint` 스크립트를 통해 자동으로 Prisma 마이그레이션을 실행합니다.

**⚠️ 중요**: 데이터베이스 테이블이 없다는 오류가 발생하면 마이그레이션이 실행되지 않은 것입니다.

### 자동 마이그레이션 (docker-entrypoint)

`docker-entrypoint` 스크립트가 자동으로 마이그레이션을 실행합니다:
1. `prisma migrate deploy` 시도
2. 실패 시 `prisma db push`로 스키마에서 직접 생성

### 수동 마이그레이션 실행

마이그레이션이 자동으로 실행되지 않으면 수동으로 실행하세요:

**방법 1: Railway CLI 사용**

```bash
# Railway CLI 설치 (아직 안 했다면)
npm i -g @railway/cli

# Railway에 로그인
railway login

# 프로젝트 선택
railway link

# 마이그레이션 실행
railway run npx prisma migrate deploy

# 또는 스키마에서 직접 생성 (마이그레이션 파일이 없는 경우)
railway run npx prisma db push
```

**방법 2: Railway 대시보드에서 실행**

1. Railway 대시보드 → 백엔드 서비스 선택
2. "Deployments" 탭 → 최신 배포 선택
3. "View Logs"에서 마이그레이션 로그 확인
4. 마이그레이션이 실패했다면 "Redeploy" 클릭하여 재배포

**방법 3: 로컬에서 Railway 데이터베이스에 직접 연결**

```bash
# Railway의 DATABASE_PUBLIC_URL을 환경 변수로 설정
set PRISMA_DATABASE_URL=postgresql://postgres:...@switchyard.proxy.rlwy.net:30326/railway

# 마이그레이션 실행
npx prisma migrate deploy

# 또는 스키마에서 직접 생성
npx prisma db push
```

### 마이그레이션 오류 해결

**오류**: `The table public.User does not exist`

**해결 방법**:
1. Railway CLI로 마이그레이션 실행: `railway run npx prisma db push`
2. 또는 Railway 대시보드에서 재배포하여 `docker-entrypoint`가 마이그레이션을 실행하도록 함
3. 재배포 후 로그에서 `마이그레이션 완료` 메시지 확인

## 5. 배포 확인

1. Railway 대시보드에서 배포 상태 확인
2. **"Settings"** → **"Generate Domain"**으로 공개 URL 생성
3. 브라우저에서 `https://your-app.up.railway.app` 접속하여 확인
4. `/hello_world` 엔드포인트로 테스트: `https://your-app.up.railway.app/hello_world`

## 6. 프론트엔드 연결 설정

### Railway URL 확인

Railway 대시보드에서 백엔드 서비스의 **"Settings"** → **"Generate Domain"**을 클릭하여 공개 URL을 생성합니다.
예: `https://lexionline-backend-production.up.railway.app`

### 프론트엔드 환경 변수 설정

Vercel 대시보드에서 다음 환경 변수를 설정합니다:

```bash
# Railway 백엔드 URL (HTTP/HTTPS)
REACT_APP_API_URL=https://your-railway-app.up.railway.app

# Colyseus WebSocket URL (WSS 프로토콜)
REACT_APP_COLYSEUS_URL=wss://your-railway-app.up.railway.app
```

또는 `.env.production` 파일에 추가:

```bash
REACT_APP_API_URL=https://your-railway-app.up.railway.app
REACT_APP_COLYSEUS_URL=wss://your-railway-app.up.railway.app
```

**중요 사항**:
1. **`REACT_APP_COLYSEUS_URL`**: WebSocket 연결용이므로 `wss://` 프로토콜 사용 (HTTPS는 `wss://`, HTTP는 `ws://`)
2. Railway 백엔드의 `GOOGLE_REDIRECT_URI`는 Vercel에 배포된 프론트엔드 URL을 사용해야 합니다:
   - 예: `https://your-frontend.vercel.app/auth/google/callback`
3. **CORS 설정**: 백엔드의 `app.config.ts`에 프론트엔드 도메인이 포함되어 있는지 확인

**Colyseus WebSocket 연결 문제 해결**:
- 방 만들기/참여는 되는데 게임 진행이 안 되는 경우, WebSocket 연결 문제일 가능성이 높습니다
- 브라우저 개발자 도구의 Network 탭에서 WebSocket 연결 상태 확인
- `REACT_APP_COLYSEUS_URL`이 올바르게 설정되었는지 확인 (`wss://` 프로토콜 사용)

### CORS 설정 업데이트

`backend/src/app.config.ts`의 CORS 설정에 Railway 도메인을 추가합니다:

```typescript
app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://lexionline-dev.vercel.app",
    "https://your-railway-app.up.railway.app", // Railway 도메인 추가
    process.env.FRONTEND_URL // 또는 환경 변수로 관리
  ],
  credentials: true,
}));
```

## 7. 모니터링 및 로그

- **Logs**: Railway 대시보드의 **"Deployments"** 탭에서 실시간 로그 확인
- **Metrics**: **"Metrics"** 탭에서 CPU, 메모리 사용량 확인
- **Settings**: **"Settings"** 탭에서 리소스 할당량 조정

## 모노레포 설정 (중요!)

이 프로젝트는 모노레포 구조입니다 (`frontend`와 `backend` 폴더가 분리되어 있음). Railway에서 `backend` 폴더만 배포하려면 다음 중 하나의 방법을 사용하세요:

### 방법 1: railway.json 사용 (권장)

`backend/railway.json` 파일에 `rootDirectory`가 이미 설정되어 있습니다:
```json
{
  "deploy": {
    "rootDirectory": "backend"
  }
}
```

이 파일이 `backend` 폴더에 있으면 Railway가 자동으로 인식합니다.

### 방법 2: Railway 대시보드에서 설정

1. 백엔드 서비스의 **"Settings"** 탭으로 이동
2. **"Root Directory"** 섹션 찾기
3. `backend` 입력
4. 저장

### 방법 3: 프로젝트 루트에 railway.json 생성

프로젝트 루트(`LexiOnline/`)에 `railway.json`을 생성하여 각 서비스의 루트 디렉토리를 지정할 수도 있습니다:

```json
{
  "services": {
    "backend": {
      "deploy": {
        "rootDirectory": "backend"
      }
    }
  }
}
```

## 트러블슈팅

### 데이터베이스 연결 오류

**증상**: `❌ Failed to connect Prisma` 또는 `Can't reach database server at postgres.railway.internal:5432` 오류

**원인**:
- 빌드 단계에서 프라이빗 네트워크(`postgres.railway.internal`)에 접근할 수 없음
- `DATABASE_URL`은 런타임에만 사용 가능하고 빌드 시에는 사용할 수 없음
- `PRISMA_DATABASE_URL`이 여전히 `DATABASE_URL`을 참조하고 있음

**즉시 해결 방법**:

1. **Railway 대시보드에서 환경 변수 확인**:
   - 백엔드 서비스 → **"Variables"** 탭
   - `PRISMA_DATABASE_URL`이 어떻게 설정되어 있는지 확인
   - 만약 `DATABASE_URL`을 참조하고 있다면 삭제하고 다시 설정

2. **`DATABASE_PUBLIC_URL`로 변경**:
   - 기존 `PRISMA_DATABASE_URL` 변수 삭제 (있다면)
   - **"New Variable"** → **"Reference Variable"** 선택
   - PostgreSQL 서비스의 **`DATABASE_PUBLIC_URL`** 선택
   - 변수 이름: `PRISMA_DATABASE_URL`
   - 저장

3. **또는 수동으로 값 복사** (더 확실한 방법):
   - PostgreSQL 서비스 → **"Variables"** 탭
   - `DATABASE_PUBLIC_URL` 값 복사 (전체 URL)
   - 백엔드 서비스 → **"Variables"** 탭
   - `PRISMA_DATABASE_URL` 변수 생성 (Reference가 아닌 일반 변수)
   - 복사한 `DATABASE_PUBLIC_URL` 값 붙여넣기
   - 저장

4. **재배포 필수**:
   - 환경 변수를 변경한 후에는 **반드시 재배포**해야 합니다
   - Railway 대시보드에서 **"Deployments"** 탭 → **"Redeploy"** 클릭
   - 또는 코드를 푸시하면 자동으로 재배포됩니다

**확인 사항**:
- `PRISMA_DATABASE_URL` 값에 `postgres.railway.internal`이 포함되어 있으면 안 됩니다
- `DATABASE_PUBLIC_URL`은 보통 `postgresql://...@...railway.app:5432/railway` 형식입니다

```bash
# Railway CLI로 연결 문자열 확인
railway variables

# Prisma 스튜디오로 데이터베이스 확인 (로컬에서)
PRISMA_DATABASE_URL="your_railway_db_url" npx prisma studio
```

### 포트 오류

**증상**: 서버가 시작되지 않음

**해결 방법**:
- Railway는 자동으로 `PORT` 환경 변수를 제공합니다
- 코드에서 이미 `process.env.PORT`를 사용하고 있으므로 추가 설정 불필요
- 만약 문제가 있다면 Railway 대시보드의 로그를 확인하세요

### 빌드 실패

**증상**: 배포가 실패하거나 빌드 에러 발생

**해결 방법**:
1. Railway 대시보드의 **"Deployments"** → **"View Logs"**에서 빌드 로그 확인
2. **Root Directory**가 올바르게 설정되었는지 확인 (`backend` 폴더)
3. Dockerfile의 빌드 단계 확인
4. `package.json`의 빌드 스크립트 확인
5. Node.js 버전이 20.9.0 이상인지 확인

### Root Directory 오류

**증상**: `package.json`을 찾을 수 없다는 오류 또는 잘못된 폴더에서 빌드 시도

**해결 방법**:
1. Railway 대시보드에서 백엔드 서비스의 **"Settings"** → **"Root Directory"** 확인
2. `backend`로 설정되어 있는지 확인
3. `railway.json` 파일이 `backend` 폴더에 있는지 확인
4. 저장 후 재배포

### CORS 오류

**증상**: 프론트엔드에서 백엔드로 요청 시 CORS 에러

**해결 방법**:
1. `backend/src/app.config.ts`의 CORS 설정에 프론트엔드 도메인 추가
2. Railway 도메인도 CORS에 포함되어 있는지 확인
3. `credentials: true` 설정 확인

### Prisma 마이그레이션 실패

**증상**: 데이터베이스 스키마가 적용되지 않음

**해결 방법**:
1. Railway 로그에서 마이그레이션 오류 확인
2. 수동으로 마이그레이션 실행:
   ```bash
   railway run npx prisma migrate deploy
   ```
3. `docker-entrypoint` 스크립트가 올바르게 실행되는지 확인

### Google OAuth 오류

**증상**: Google 로그인이 작동하지 않음

**해결 방법**:
1. **`GOOGLE_REDIRECT_URI` 확인**: 
   - 이 값은 **프론트엔드의 콜백 URL**이어야 합니다 (백엔드 URL이 아님!)
   - 로컬: `http://localhost:3000/auth/google/callback`
   - 프로덕션: `https://your-frontend-domain.vercel.app/auth/google/callback`
   
2. **Google Cloud Console 설정**:
   - [Google Cloud Console](https://console.cloud.google.com/) 접속
   - APIs & Services → Credentials → OAuth 2.0 Client IDs 선택
   - 승인된 리디렉션 URI에 다음 추가:
     - `http://localhost:3000/auth/google/callback` (개발용)
     - `https://your-frontend-domain.vercel.app/auth/google/callback` (프로덕션용)
   
3. `GOOGLE_CLIENT_ID`와 `GOOGLE_CLIENT_SECRET`이 올바른지 확인

**참고**: `GOOGLE_REDIRECT_URI`는 Google이 인증 후 사용자를 리디렉션할 프론트엔드 URL입니다. 백엔드 URL이 아닙니다!

### Colyseus WebSocket 연결 오류

**증상**: 방 만들기/참여는 되는데 게임 진행이 안 됨, WebSocket 연결 실패

**원인**:
- **Railway와 Fly.io의 차이점**: Fly.io는 자동으로 WebSocket 업그레이드를 처리하지만, Railway는 리버스 프록시를 사용하므로 추가 설정이 필요할 수 있습니다
- WebSocket URL이 올바르게 설정되지 않음 (`https://`를 `ws://`로 변환하는 버그)
- CORS 설정에 프론트엔드 도메인이 없음
- Railway의 HTTP 서비스 설정에서 WebSocket 지원 확인 필요

**해결 방법**:

1. **프론트엔드 환경 변수 설정 (Vercel)**:
   ```bash
   REACT_APP_API_URL=https://your-railway-app.up.railway.app
   REACT_APP_COLYSEUS_URL=wss://your-railway-app.up.railway.app
   ```
   ⚠️ **중요**: `REACT_APP_COLYSEUS_URL`은 `wss://` 프로토콜을 사용해야 합니다 (HTTPS는 `wss://`, HTTP는 `ws://`)

2. **백엔드 CORS 설정 확인**:
   - `backend/src/app.config.ts`의 CORS 설정에 프론트엔드 도메인 추가
   - Railway 도메인도 포함되어 있는지 확인

3. **브라우저 개발자 도구 확인**:
   - Network 탭 → WS 필터 → WebSocket 연결 상태 확인
   - Console 탭에서 WebSocket 연결 오류 메시지 확인

4. **코드 수정**:
   - `frontend/src/services/ColyseusService.ts`가 이미 수정되어 `https://`를 `wss://`로 올바르게 변환합니다
   - 변경사항을 커밋하고 Vercel에 재배포하세요

5. **Railway 로그 확인**:
   - Railway 대시보드 → 백엔드 서비스 → "Deployments" → "View Logs"
   - WebSocket 연결 관련 오류 메시지 확인

## 비용

- Railway는 무료 티어를 제공합니다 ($5 크레딧/월)
- PostgreSQL은 사용량에 따라 과금됩니다
- 자세한 내용: https://railway.app/pricing

## 추가 리소스

- [Railway 문서](https://docs.railway.app)
- [Railway Discord](https://discord.gg/railway)
- [Prisma 배포 가이드](https://www.prisma.io/docs/guides/deployment)

