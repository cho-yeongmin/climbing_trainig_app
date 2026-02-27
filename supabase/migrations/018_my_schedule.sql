-- =====================================================
-- 내 일정 (팀 일정 선택 + 개인 일정)
-- =====================================================

-- 1. 사용자가 팀 일정을 "내 일정"에 추가한 목록
create table public.user_my_schedule_selections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, schedule_id)
);

create index idx_user_my_schedule_selections_user on public.user_my_schedule_selections(user_id);

alter table public.user_my_schedule_selections enable row level security;

create policy "본인 내 일정 선택"
  on public.user_my_schedule_selections for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2. 개인 일정 (사용자 직접 추가)
create table public.user_personal_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  title text not null,
  place_id uuid references public.places(id) on delete set null,
  exercise_type_id uuid references public.exercise_types(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_user_personal_schedules_user on public.user_personal_schedules(user_id);
create index idx_user_personal_schedules_date on public.user_personal_schedules(user_id, date);

alter table public.user_personal_schedules enable row level security;

create policy "본인 개인 일정"
  on public.user_personal_schedules for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
