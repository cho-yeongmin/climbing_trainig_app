-- =====================================================
-- 팀원 프로필 읽기 RLS (본인 팀 + 일정공유 팀)
-- =====================================================

create policy "팀원 프로필 읽기"
  on public.profiles for select
  using (
    -- 본인 팀
    team_id = (select team_id from public.profiles where id = auth.uid())
    or
    -- 일정공유 팀
    team_id in (
      select shared_with_team_id from public.team_schedule_shares
      where team_id = (select team_id from public.profiles where id = auth.uid())
      union
      select team_id from public.team_schedule_shares
      where shared_with_team_id = (select team_id from public.profiles where id = auth.uid())
    )
  );
