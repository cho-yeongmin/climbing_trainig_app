-- =====================================================
-- 팀원 명단 조회 RPC (본인 팀 또는 일정공유 팀만)
-- =====================================================

create or replace function public.get_team_members(p_team_id uuid)
returns table (
  id uuid,
  nickname text,
  display_name text,
  boast_info text,
  role text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  pmy_team uuid;
begin
  select team_id into pmy_team from public.profiles where id = auth.uid();
  if pmy_team is null then
    return;
  end if;

  -- 본인 팀이거나, 일정공유 관계인 팀만 조회 허용
  if pmy_team = p_team_id then
    -- ok
  elsif exists (
    select 1 from public.team_schedule_shares
    where (team_id = pmy_team and shared_with_team_id = p_team_id)
       or (team_id = p_team_id and shared_with_team_id = pmy_team)
  ) then
    -- ok
  else
    return;
  end if;

  return query
  select pr.id, pr.nickname, pr.display_name, pr.boast_info, pr.role
  from public.profiles pr
  where pr.team_id = p_team_id
  order by case pr.role when 'supervisor' then 0 when 'admin' then 1 else 2 end,
           coalesce(pr.nickname, pr.display_name, '') asc;
end;
$$;

grant execute on function public.get_team_members(uuid) to authenticated;
