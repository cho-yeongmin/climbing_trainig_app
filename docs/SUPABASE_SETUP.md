# Supabase 설정 가이드

관리자/훈련자 계정, 원정 장소, 운동 DB 이미지를 직접 입력하는 방법입니다.

---

## 0. 설치 및 환경 변수

```bash
npm install
```

프로젝트 루트에 `.env.local` 파일 생성:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

(Supabase 대시보드 → **Project Settings** → **API** 에서 확인)

---

## 1. Supabase 프로젝트 설정

1. [Supabase](https://supabase.com) 로그인 후 새 프로젝트 생성
2. 프로젝트 대시보드 → **SQL Editor** → 새 쿼리 생성
3. `supabase/migrations/001_initial_schema.sql` 내용 전체 복사 후 실행
4. `supabase/migrations/002_spray_wall_problems.sql` 실행 (스프레이월 문제 테이블)
5. 이어서 `supabase/seed.sql` 실행 (운동 종류 7개 초기 데이터)
6. **Realtime 활성화** (관리자가 일정 추가/수정 시 이용자 화면 자동 갱신용):  
   대시보드 → **Database** → **Replication** → **Tables**에서 `schedules` 테이블 옆 토글을 켜서 Realtime을 활성화합니다.

---

## 2. 관리자 / 훈련자 계정 추가

Supabase는 **이메일 + 비밀번호**로 로그인합니다. ID 역할은 이메일로 대체합니다.

### 방법 A: Supabase Dashboard (권장)

1. **Authentication** → **Users** → **Add user**
2. **Create new user** 선택
3. 입력 예시:
   - 관리자: `admin@climbing.local` / 비밀번호 설정
   - 훈련자: `trainee@climbing.local` / 비밀번호 설정
4. **Create user** 클릭
5. 생성된 사용자 **UUID** 복사 (행 클릭 → User UID)

### 방법 B: SQL로 role 설정

가입 시 기본 `role`은 `trainee`입니다. 관리자로 지정하려면:

1. **SQL Editor**에서 실행:

```sql
-- admin@climbing.local 의 UUID로 교체
update public.profiles
set role = 'admin'
where id = '여기에-관리자-user-uuid-붙여넣기';
```

2. UUID는 **Authentication** → **Users** → 해당 사용자 클릭 → **User UID**에서 확인

---

## 3. 원정 장소(places) 입력

### Table Editor 사용

1. **Table Editor** → **places** 테이블 선택
2. **Insert row** → 새 행 추가
3. 필드 입력:

| 컬럼    | 설명           | 예시                          |
|---------|----------------|-------------------------------|
| name    | 장소명         | 레드원클라이밍 첨단점         |
| address | 주소           | 광주 광산구 첨단강변로87번길 20 2층 |
| image_url | 이미지 URL (선택) | https://... 또는 Supabase Storage URL |

### 이미지 업로드 (Supabase Storage)

1. **Storage** → **New bucket** → 이름 `place-images`
2. **Upload file**로 이미지 업로드
3. 파일 우클릭 → **Get public URL** 복사
4. 해당 URL을 `places.image_url`에 저장

---

## 4. 운동 종류 이미지(exercise_types) 입력

`seed.sql` 실행 후 `exercise_types`에는 7개 행이 이미 있습니다.

### Table Editor에서 image_url 수정

1. **Table Editor** → **exercise_types** 선택
2. 각 행의 **image_url** 열 클릭 후 URL 입력

### 이미지 업로드

1. **Storage** → 새 버킷 `exercise-images` 생성 (또는 `place-images`와 같은 버킷 사용)
2. 이미지 업로드 후 **Get public URL** 복사
3. 해당 URL을 `exercise_types.image_url`에 저장

---

## 5. 일정(schedules) 입력 (관리자 기능)

웹앱에서 관리자가 일정 추가 시 이 테이블에 자동 저장됩니다.  
수동 입력 시:

```sql
-- exercise_type_id: exercise_types 테이블의 id
-- place_id: 원정 날에만 입력, 나머지는 null
insert into public.schedules (date, exercise_type_id, place_id)
values ('2025-03-01', '운동종류-uuid', null);
```

---

## 6. 권한 요약

| 역할   | 일정·장소·운동종류 | 본인 훈련기록 | 본인 프로필 |
|--------|--------------------|---------------|-------------|
| admin  | 읽기/쓰기          | 읽기/쓰기     | 읽기/수정   |
| trainee | 읽기만            | 읽기/쓰기     | 읽기/수정   |

---

## 7. 환경 변수 (.env.local)

웹앱에서 Supabase 사용 시:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

- **Project Settings** → **API** → Project URL, anon public key 복사
