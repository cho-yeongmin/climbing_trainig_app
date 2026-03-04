-- =====================================================
-- 스프레이월 팀 공유: 같은 팀 팀원끼리 문제 공유
-- =====================================================

-- 1. team_id 컬럼 추가
alter table public.spray_wall_problems
  add column if not exists team_id uuid references public.teams(id) on delete set null;

create index if not exists idx_spray_wall_problems_team on public.spray_wall_problems(team_id);

-- 2. 기존 데이터: 작성자의 팀으로 채우기
update public.spray_wall_problems swp
set team_id = p.team_id
from public.profiles p
where swp.user_id = p.id and swp.team_id is null and p.team_id is not null;

-- 3. RLS 정책 수정: 본인만 → 본인 + 같은 팀 팀원
drop policy if exists "본인 스프레이월 문제만" on public.spray_wall_problems;

-- SELECT: 본인이 만든 문제 OR (팀 문제이고 내 팀과 일치)
create policy "스프레이월 SELECT 본인+팀"
  on public.spray_wall_problems for select
  using (
    auth.uid() = user_id
    or (
      team_id is not null
      and team_id = (select team_id from public.profiles where id = auth.uid() limit 1)
    )
  );

-- INSERT: 본인 user_id로만 생성 가능
create policy "스프레이월 INSERT 본인"
  on public.spray_wall_problems for insert
  with check (auth.uid() = user_id);

-- UPDATE: 본인이 만든 문제만
create policy "스프레이월 UPDATE 본인"
  on public.spray_wall_problems for update
  using (auth.uid() = user_id);

-- DELETE: 본인이 만든 문제만
create policy "스프레이월 DELETE 본인"
  on public.spray_wall_problems for delete
  using (auth.uid() = user_id);
