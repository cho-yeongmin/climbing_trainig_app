-- =====================================================
-- 팀 스프레이월 배경 (팀당 1장, 관리자 등록·편집)
-- =====================================================

create table public.team_spray_wall (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null unique references public.teams(id) on delete cascade,
  image_data text not null,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_team_spray_wall_team on public.team_spray_wall(team_id);

alter table public.team_spray_wall enable row level security;

-- SELECT: 같은 팀 팀원
create policy "팀 스프레이월 SELECT 팀원"
  on public.team_spray_wall for select
  using (
    team_id = (select team_id from public.profiles where id = auth.uid() limit 1)
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'supervisor'
    )
  );

-- INSERT: 슈퍼바이저 또는 본인 팀 관리자
create policy "팀 스프레이월 INSERT 관리자"
  on public.team_spray_wall for insert
  with check (
    auth.uid() = uploaded_by
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (
          p.role = 'supervisor'
          or (p.role = 'admin' and p.team_id = team_id)
        )
    )
  );

-- UPDATE: 슈퍼바이저 또는 본인 팀 관리자
create policy "팀 스프레이월 UPDATE 관리자"
  on public.team_spray_wall for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (
          p.role = 'supervisor'
          or (p.role = 'admin' and p.team_id = team_spray_wall.team_id)
        )
    )
  );
