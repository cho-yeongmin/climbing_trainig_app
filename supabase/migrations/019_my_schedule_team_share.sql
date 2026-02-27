-- =====================================================
-- 같은 팀 소속 시 내 일정 공유 (읽기 허용)
-- =====================================================

-- user_my_schedule_selections: 팀원도 SELECT 가능
drop policy if exists "본인 내 일정 선택" on public.user_my_schedule_selections;

create policy "본인 내 일정 선택 수정삭제"
  on public.user_my_schedule_selections for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "같은 팀 내 일정 조회"
  on public.user_my_schedule_selections for select
  using (
    exists (
      select 1 from public.profiles p1, public.profiles p2
      where p1.id = auth.uid()
        and p2.id = user_my_schedule_selections.user_id
        and p1.team_id = p2.team_id
        and p1.team_id is not null
    )
  );

-- user_personal_schedules: 팀원도 SELECT 가능
drop policy if exists "본인 개인 일정" on public.user_personal_schedules;

create policy "본인 개인 일정 수정삭제"
  on public.user_personal_schedules for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "같은 팀 개인 일정 조회"
  on public.user_personal_schedules for select
  using (
    exists (
      select 1 from public.profiles p1, public.profiles p2
      where p1.id = auth.uid()
        and p2.id = user_personal_schedules.user_id
        and p1.team_id = p2.team_id
        and p1.team_id is not null
    )
  );
