# 클라이밍 훈련 앱 다팀·슈퍼바이저 확장 계획서

## 1. 표 형식 정리

### 1.1 현재 vs 확장 후 역할 비교

| 구분 | 현재 시스템 | 확장 후 시스템 |
|------|-------------|----------------|
| **최상위** | (없음) | **슈퍼바이저** – 전체 팀·장소·운동 종류 관리 |
| **관리자** | 팀 전체 관리 (1팀만) | **팀 관리자** – 해당 팀의 일정·원정 계획만 관리 |
| **훈련생** | 운동·기록 조회/입력 | **훈련생** – 소속 팀 데이터만 조회·기록 |

### 1.2 테이블별 team_id 추가 및 권한

| 테이블 | 현재 구조 | 확장 시 변경 | RLS 정책 예시 |
|--------|-----------|--------------|---------------|
| `profiles` | id, role, display_name | + `team_id`, role → `supervisor`/`admin`/`trainee` | 슈퍼바이저: 전체, 관리자: 자기 팀, 훈련생: 자기 팀 |
| `places` | (공통) | + `team_id` (nullable = 전체 공용) | 팀별 또는 공용 장소만 접근 |
| `exercise_types` | (공통) | + `team_id` (nullable = 기본 템플릿) | 팀별 또는 공용 |
| `schedules` | date, exercise_type, place | + `team_id` | 팀 관리자: 자기 팀, 훈련생: 읽기만 |
| `training_records` | user_id, schedule_id | + `team_id` (user 소속 팀 기준) | 본인 기록 + 팀 관리자: 팀 전체 조회 |
| `training_record_details` | training_record_id | (training_records 통해 team_id 간접) | 상위 record와 동일 |
| `user_recent_places` | user_id, place_id | (places team_id 통해 필터) | 본인 + 팀 장소만 |
| `place_difficulty_colors` | place_id | (places 통해) | 장소 접근 권한 상속 |
| `spray_wall_problems` | user_id | + `team_id` (선택) | 본인 또는 팀 내 공유 옵션 |
| `team_schedule_shares` | (신규) | 팀 간 일정 공유 동의 | 공유 동의된 팀끼리만 조회 |

### 1.3 단계별 작업 요약

| 단계 | 작업 내용 | 예상 공수 |
|------|-----------|-----------|
| 1단계 | `teams` 테이블 생성, `profiles`에 team_id 추가 | 0.5일 |
| 2단계 | 핵심 테이블(places, schedules 등)에 team_id 추가 및 RLS 수정 | 1~2일 |
| 3단계 | AuthContext 확장 (team_id, role, isSupervisor) | 0.5일 |
| 4단계 | useSupabase 훅에 team_id 필터 적용 | 1~2일 |
| 5단계 | UI: 팀 선택(슈퍼바이저), 팀 대시보드 | 1일 |
| 6단계 | 마이그레이션 스크립트 및 기존 데이터 이전 | 0.5일 |
| 7단계 | `team_schedule_shares` + 일정 화면 팀 선택 콤보박스 | 1일 |

---

## 2. 보고서 형식

### 제목: 클라이밍 훈련 앱 다팀 확장 프로젝트 보고서

---

**1. 개요**

현재 1팀(관리자 + 훈련생) 구조의 클라이밍 훈련 앱을, 슈퍼바이저와 다수의 팀이 각각 독립적으로 운영되도록 확장한다.

**2. 목표**

- 슈퍼바이저: 모든 팀·장소·운동 종류·기본 설정 관리
- 팀 관리자: 본인 팀의 일정·원정 계획만 관리, 공유 동의 팀 일정 조회 가능
- **일정 화면**: 콤보박스로 팀 선택 → 공유 동의된 팀들의 일정 캘린더 조회
- 훈련생: 본인 팀의 일정·계획 조회 및 기록 입력

**3. 기술적 접근**

- Supabase(PostgreSQL) 기반
- `teams` 테이블 신설, 기존 테이블에 `team_id` 컬럼 추가
- RLS(Row Level Security)로 팀 단위 접근 제어
- 프론트엔드: AuthContext에 팀·역할 정보 반영, API 호출 시 team_id 자동 적용

**4. 위험 요소 및 대응**

| 위험 | 대응 |
|------|------|
| 기존 데이터 마이그레이션 오류 | 기본 팀 생성 후 기존 레코드에 team_id 일괄 설정 |
| RLS로 인한 성능 저하 | team_id, user_id 등 인덱스 추가 |
| 프론트 복잡도 증가 | useTeamContext 등 팀 컨텍스트 훅으로 로직 분리 |

**5. 권장 일정**

- 1~2주 (개발 및 테스트)
- 운영 환경 배포 전 스테이징 환경 검증 필수

---

## 3. 글로 자세한 설명

### 3.1 현재 시스템 구조

현재 앱은 **단일 팀** 구조입니다.

- **profiles**: `admin`(관리자), `trainee`(훈련생)
- **일정(schedules)**: `date` 기준 전역 (팀 구분 없음)
- **장소(places), 운동 종류(exercise_types)**: 전역 공유
- **훈련 기록(training_records)**: `user_id` 기준 본인만 접근

즉, 한 계정이 관리자이면 모든 일정과 장소를 관리하고, 모든 훈련생이 동일한 일정·원정 계획을 공유합니다.

### 3.2 확장 목표 구조

**슈퍼바이저(Supervisor)**

- 여러 팀을 생성·수정·삭제
- 장소·운동 종류를 전역(공용) 또는 팀별로 등록
- 각 팀의 요약/통계 조회

**팀 관리자(Admin)**

- 본인 팀의 일정·원정 계획만 관리 (추가/수정/삭제)
- 본인 팀 훈련생의 기록 조회

**훈련생(Trainee)**

- 소속 팀의 일정·원정 계획만 조회
- 본인 훈련 기록만 입력·조회

### 3.3 데이터베이스 설계

**1) teams 테이블 신설**

```sql
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

**2) profiles 확장**

- `role`: `supervisor` | `admin` | `trainee`
- `team_id`: uuid (references teams). 슈퍼바이저는 NULL(전체 팀 접근)

**3) 팀 구분이 필요한 테이블에 team_id 추가**

- `places`: team_id (nullable = 공용 장소)
- `exercise_types`: team_id (nullable = 공용 운동 종류)
- `schedules`: team_id (필수, 팀별 일정)
- `training_records`: team_id (user 소속 팀 또는 기록 시점 팀 기준)
- `spray_wall_problems`: team_id (선택, 팀 공유 여부)

**4) RLS 정책 예시**

- 슈퍼바이저: `profiles.role = 'supervisor'` → 모든 팀 데이터 접근
- 관리자: `profiles.team_id = schedules.team_id` → 자기 팀 일정만
- 훈련생: `profiles.team_id = schedules.team_id` → 자기 팀 일정만 읽기

### 3.4 프론트엔드 변경

**AuthContext**

- `profile.team_id`, `profile.role` 활용
- `isSupervisor`, `isAdmin`, `currentTeamId` 등 계산값 제공

**데이터 조회 훅(useSupabase)**

- `useSchedules`, `useTodaySchedule`, `useNextExpedition` 등에 team_id 조건 자동 추가
- 슈퍼바이저일 때는 팀 선택 UI 후 선택한 team_id 사용

**UI 변경**

- 슈퍼바이저: 팀 목록·팀별 대시보드, 팀 생성/수정 화면
- 관리자: 기존과 유사하되, 데이터가 자기 팀으로 제한
- **일정 화면**: 콤보박스로 팀 선택 → 공유 동의된 팀들의 일정 캘린더 조회
- 훈련생: 변경 최소화, 데이터만 팀 제한됨 (공유 팀 조회는 관리자만 또는 옵션)

### 3.5 마이그레이션 전략

1. `teams` 테이블 생성
2. 기본 팀 1개 생성 (예: "기본 팀")
3. `profiles`에 `team_id` 추가, 기존 admin/trainee에 기본 팀 연결
4. `schedules`, `places` 등에 `team_id` 추가, 기존 레코드에 기본 팀 ID 설정
5. RLS 정책을 새 구조에 맞게 수정
6. 프론트엔드 단계별 반영 후 테스트

### 3.6 팀 간 일정 공유 (콤보박스로 팀 선택)

서로 공유를 동의한 관리자끼리 타팀 일정을 조회할 수 있도록 한다.

**1) team_schedule_shares 테이블**

```sql
create table public.team_schedule_shares (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  shared_with_team_id uuid not null references public.teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(team_id, shared_with_team_id),
  check (team_id != shared_with_team_id)
);
```

- 양방향 공유: (A→B), (B→A) 두 행 저장

**2) 일정 화면 UI (ScheduleView)**

| 요소 | 동작 |
|------|------|
| **콤보박스(팀 선택)** | 상단에 배치, 조회 대상 팀 선택 |
| **옵션 목록** | ① 내 팀 ② 공유 동의된 타팀들 (공유 동의 없으면 내 팀만) |
| **캘린더** | 선택된 팀의 `schedules`만 표시 |
| **권한** | 공유 팀 일정은 **조회 전용** (수정/삭제 불가) |

**3) 콤보박스 옵션 구성**

```
[예시]
┌─────────────────────────────┐
│ 우리 팀 (파워클라이머)      │  ← 기본 선택, 항상 표시
│ 동료 팀 A (실력팀)          │  ← team_schedule_shares로 공유 동의된 팀
│ 동료 팀 B (초보팀)          │
└─────────────────────────────┘
```

**4) 데이터 흐름**

1. `useSharableTeams()`: 내 팀 + 공유 동의된 팀 목록 조회
2. 사용자가 콤보박스에서 팀 선택 → `selectedTeamId` 상태
3. `useSchedules(year, month, selectedTeamId)` → 해당 팀 일정만 조회
4. 캘린더에 선택된 팀의 일정만 렌더링

**5) 훈련생**

- 훈련생은 내 팀만 조회 (공유 동의는 관리자 간만)
- 또는: 팀 관리자가 훈련생에게 공유 팀 조회 권한을 부여하는 옵션 추가 가능

### 3.7 추가 고려 사항

- **훈련생 팀 이동**: 필요 시 관리자가 훈련생의 `team_id` 변경
- **장소·운동 종류 공유**: team_id = NULL → 모든 팀에서 사용
- **감사 로그**: 팀별·역할별 변경 이력을 남기려면 별도 `audit_log` 테이블 검토

---

## 4. 마이그레이션 SQL 예시 (요약)

```sql
-- 1. teams 테이블
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. profiles 확장
alter table public.profiles add column team_id uuid references public.teams(id);
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('supervisor', 'admin', 'trainee'));

-- 3. 기본 팀 생성 및 기존 사용자 매핑
insert into public.teams (id, name) values ('default-team-uuid', '기본 팀');
update public.profiles set team_id = 'default-team-uuid' where team_id is null;

-- 4. schedules 등에 team_id 추가
alter table public.schedules add column team_id uuid references public.teams(id);
update public.schedules set team_id = 'default-team-uuid';
alter table public.schedules alter column team_id set not null;
```

이후 RLS 정책을 `team_id` 기반으로 재작성하고, 인덱스를 추가한 뒤 프론트엔드를 단계적으로 수정하면 됩니다.

---

## 5. 배포 전 체크리스트

1. **마이그레이션 실행**: `supabase db push` 또는 `supabase migration up`으로 004_multi_team.sql, 005_team_share_requests.sql 적용
2. **기존 admin 사용자**: profiles에 team_id가 할당되며, role은 그대로 admin
3. **슈퍼바이저 전환**: DB에서 해당 사용자 role을 'supervisor'로, team_id를 null로 수정
4. **팀 공유 설정**: `일정공유` 탭에서 요청 보내기 → 상대 팀 관리자가 승인 → 양방향 공유 완료
