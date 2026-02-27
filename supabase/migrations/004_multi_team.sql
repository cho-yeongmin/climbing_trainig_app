-- =====================================================
-- 다팀·슈퍼바이저 확장
-- =====================================================

-- 1. teams 테이블
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_teams_name on public.teams(name);

alter table public.teams enable row level security;

create policy "팀 전체 읽기 (로그인 시)"
  on public.teams for select
  using (auth.uid() is not null);

create policy "슈퍼바이저만 팀 수정"
  on public.teams for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'supervisor'
    )
  );

-- 2. 기본 팀 생성
insert into public.teams (id, name) values (
  'a0000000-0000-0000-0000-000000000001'::uuid,
  '기본 팀'
) on conflict (id) do nothing;

-- 3. profiles 확장: team_id, role (supervisor/admin/trainee)
alter table public.profiles add column if not exists team_id uuid references public.teams(id) on delete set null;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('supervisor', 'admin', 'trainee'));

-- 기존 admin → admin 유지, trainee → trainee 유지
update public.profiles set role = 'admin' where role = 'admin';
update public.profiles set role = 'trainee' where role = 'trainee';

-- 기존 사용자에 기본 팀 할당
update public.profiles set team_id = 'a0000000-0000-0000-0000-000000000001'::uuid where team_id is null;

-- 신규 가입자에 기본 팀 할당
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role, team_id)
  values (new.id, 'trainee', 'a0000000-0000-0000-0000-000000000001'::uuid);
  return new;
end;
$$ language plpgsql security definer;

-- 4. places에 team_id (nullable = 공용)
alter table public.places add column if not exists team_id uuid references public.teams(id) on delete set null;
create index idx_places_team on public.places(team_id);

-- 5. exercise_types에 team_id (nullable = 공용)
alter table public.exercise_types add column if not exists team_id uuid references public.teams(id) on delete set null;
create index idx_exercise_types_team on public.exercise_types(team_id);

-- 6. schedules에 team_id
alter table public.schedules add column if not exists team_id uuid references public.teams(id) on delete cascade;

-- 기존 일정에 기본 팀 할당
update public.schedules set team_id = 'a0000000-0000-0000-0000-000000000001'::uuid where team_id is null;

-- date unique 제거, (team_id, date) unique로 변경
alter table public.schedules drop constraint if exists schedules_date_key;
alter table public.schedules alter column team_id set not null;
create unique index idx_schedules_team_date on public.schedules(team_id, date);
create index idx_schedules_team on public.schedules(team_id);

-- 7. training_records에 team_id
alter table public.training_records add column if not exists team_id uuid references public.teams(id) on delete set null;
update public.training_records tr
set team_id = (
  select team_id from public.profiles where id = tr.user_id
)
where tr.team_id is null;

-- 8. team_schedule_shares (팀 간 일정 공유)
create table public.team_schedule_shares (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  shared_with_team_id uuid not null references public.teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(team_id, shared_with_team_id),
  check (team_id != shared_with_team_id)
);

create index idx_team_schedule_shares_team on public.team_schedule_shares(team_id);
create index idx_team_schedule_shares_shared_with on public.team_schedule_shares(shared_with_team_id);

alter table public.team_schedule_shares enable row level security;

create policy "팀 관리자만 공유 관리"
  on public.team_schedule_shares for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
      and (p.role = 'supervisor' or (p.role = 'admin' and p.team_id = team_schedule_shares.team_id))
    )
  );

create policy "공유 목록 조회 (본인 팀 관련)"
  on public.team_schedule_shares for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
      and (p.role = 'supervisor' or p.team_id = team_schedule_shares.team_id or p.team_id = team_schedule_shares.shared_with_team_id)
    )
  );

-- 9. RLS 정책 업데이트: places (팀별 또는 공용)
drop policy if exists "장소 전체 읽기" on public.places;
drop policy if exists "관리자만 장소 수정" on public.places;

create policy "장소 읽기 (본인 팀 또는 공용)"
  on public.places for select
  using (
    team_id is null or
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and (p.role = 'supervisor' or p.team_id = places.team_id)
    )
  );

create policy "장소 수정 (슈퍼바이저 또는 본인 팀 관리자)"
  on public.places for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
      and (p.role = 'supervisor' or (p.role = 'admin' and p.team_id = places.team_id))
    )
  );

-- 10. RLS 정책 업데이트: exercise_types
drop policy if exists "운동 종류 전체 읽기" on public.exercise_types;
drop policy if exists "관리자만 운동 종류 수정" on public.exercise_types;

create policy "운동 종류 읽기 (본인 팀 또는 공용)"
  on public.exercise_types for select
  using (
    team_id is null or
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and (p.role = 'supervisor' or p.team_id = exercise_types.team_id)
    )
  );

create policy "운동 종류 수정 (슈퍼바이저 또는 본인 팀 관리자)"
  on public.exercise_types for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
      and (p.role = 'supervisor' or (p.role = 'admin' and p.team_id = exercise_types.team_id))
    )
  );

-- 11. RLS 정책 업데이트: schedules
drop policy if exists "일정 전체 읽기" on public.schedules;
drop policy if exists "관리자만 일정 수정" on public.schedules;

create policy "일정 읽기 (본인 팀 또는 공유 팀)"
  on public.schedules for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
      and (
        p.role = 'supervisor'
        or p.team_id = schedules.team_id
        or exists (
          select 1 from public.team_schedule_shares tss
          where (tss.team_id = p.team_id and tss.shared_with_team_id = schedules.team_id)
          or (tss.shared_with_team_id = p.team_id and tss.team_id = schedules.team_id)
        )
      )
    )
  );

create policy "일정 수정 (슈퍼바이저 또는 본인 팀 관리자만)"
  on public.schedules for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
      and (p.role = 'supervisor' or (p.role = 'admin' and p.team_id = schedules.team_id))
    )
  );

-- 12. place_difficulty_colors: supervisor 추가
drop policy if exists "관리자만 난이도 색상 수정" on public.place_difficulty_colors;
create policy "난이도 색상 수정 (슈퍼바이저 또는 관리자)"
  on public.place_difficulty_colors for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
      and (p.role in ('supervisor', 'admin'))
    )
  );
