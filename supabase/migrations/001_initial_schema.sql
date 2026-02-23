-- =====================================================
-- 클라이밍 훈련 앱 Supabase 스키마
-- =====================================================

-- Extensions (Supabase 기본 제공)
-- create extension if not exists "uuid-ossp";

-- =====================================================
-- 1. 프로필 (auth.users 확장, 역할 저장)
-- =====================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'trainee' check (role in ('admin', 'trainee')),
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- auth.users 가입 시 자동으로 profiles 생성
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'trainee');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;

create policy "본인 프로필 읽기"
  on public.profiles for select
  using (auth.uid() = id);

create policy "본인 프로필 수정"
  on public.profiles for update
  using (auth.uid() = id);

-- =====================================================
-- 2. 원정 장소
-- =====================================================
create table public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_places_name on public.places(name);

alter table public.places enable row level security;

create policy "장소 전체 읽기"
  on public.places for select
  using (true);

create policy "관리자만 장소 수정"
  on public.places for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- =====================================================
-- 3. 운동 종류 (7가지 날 유형)
-- =====================================================
create table public.exercise_types (
  id uuid primary key default gen_random_uuid(),
  day_type_id text not null unique,
  name text not null,
  image_url text,
  config jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_exercise_types_day_type on public.exercise_types(day_type_id);

alter table public.exercise_types enable row level security;

create policy "운동 종류 전체 읽기"
  on public.exercise_types for select
  using (true);

create policy "관리자만 운동 종류 수정"
  on public.exercise_types for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- =====================================================
-- 4. 일정 (날짜별 스케줄)
-- =====================================================
create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  exercise_type_id uuid not null references public.exercise_types(id) on delete restrict,
  place_id uuid references public.places(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_schedules_date on public.schedules(date);
create index idx_schedules_exercise on public.schedules(exercise_type_id);

alter table public.schedules enable row level security;

create policy "일정 전체 읽기"
  on public.schedules for select
  using (true);

create policy "관리자만 일정 수정"
  on public.schedules for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- =====================================================
-- 5. 훈련 기록
-- =====================================================
create table public.training_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  schedule_id uuid references public.schedules(id) on delete set null,
  exercise_type_id uuid not null references public.exercise_types(id) on delete restrict,
  record_date date not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, record_date, exercise_type_id)
);

create index idx_training_records_user_date on public.training_records(user_id, record_date desc);
create index idx_training_records_user_exercise on public.training_records(user_id, exercise_type_id, record_date desc);

alter table public.training_records enable row level security;

create policy "본인 훈련 기록만"
  on public.training_records for all
  using (auth.uid() = user_id);

-- =====================================================
-- 6. 훈련 상세 (운동별 가변 구조 → JSONB)
-- =====================================================
create table public.training_record_details (
  id uuid primary key default gen_random_uuid(),
  training_record_id uuid not null references public.training_records(id) on delete cascade,
  detail_type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_training_details_record on public.training_record_details(training_record_id);

alter table public.training_record_details enable row level security;

create policy "본인 훈련 상세만"
  on public.training_record_details for all
  using (
    exists (
      select 1 from public.training_records tr
      where tr.id = training_record_id and tr.user_id = auth.uid()
    )
  );

-- =====================================================
-- 7. (선택) 사용자별 최근 검색 장소
-- =====================================================
create table public.user_recent_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  searched_at timestamptz not null default now(),
  unique(user_id, place_id)
);

create index idx_user_recent_places_user on public.user_recent_places(user_id, searched_at desc);

alter table public.user_recent_places enable row level security;

create policy "본인 최근 장소만"
  on public.user_recent_places for all
  using (auth.uid() = user_id);
