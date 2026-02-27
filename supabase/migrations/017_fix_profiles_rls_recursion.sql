-- =====================================================
-- "팀원 프로필 읽기" 정책의 profiles 자기참조 제거
-- (select from profiles in profiles policy → 무한 재귀 → 500 에러)
-- =====================================================

drop policy if exists "팀원 프로필 읽기" on public.profiles;

-- auth.uid()의 team_id 반환 (RLS 우회)
create or replace function public.current_user_team_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select team_id from public.profiles where id = auth.uid() limit 1;
$$;

-- 조회 가능한 팀 ID 목록 반환 (본인 팀 + 일정공유 팀)
create or replace function public.current_user_readable_team_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  with my_team as (
    select team_id as tid from public.profiles where id = auth.uid() limit 1
  ),
  shared as (
    select shared_with_team_id as tid from public.team_schedule_shares
    where team_id = (select tid from my_team) and (select tid from my_team) is not null
    union
    select team_id as tid from public.team_schedule_shares
    where shared_with_team_id = (select tid from my_team) and (select tid from my_team) is not null
  )
  select tid from my_team where tid is not null
  union
  select tid from shared where tid is not null;
$$;

-- 팀원 프로필 읽기 (재귀 제거)
create policy "팀원 프로필 읽기"
  on public.profiles for select
  using (
    team_id in (select public.current_user_readable_team_ids())
  );
