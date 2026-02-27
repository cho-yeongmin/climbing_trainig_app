-- =====================================================
-- 공유 해제 RPC (양쪽 팀 중 한쪽이라도 요청하면 해제)
-- RLS 우회 - 어느 쪽 팀 관리자든 실행 가능
-- =====================================================

create or replace function public.remove_team_share(team_id_a uuid, team_id_b uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  prole text;
  pteam uuid;
begin
  if team_id_a = team_id_b then
    raise exception '동일한 팀입니다.';
  end if;

  -- 현재 사용자 프로필
  select role, team_id into prole, pteam
  from public.profiles where id = auth.uid();

  if prole is null then
    raise exception '로그인이 필요합니다.';
  end if;

  -- 슈퍼바이저 또는 두 팀 중 한쪽이라도 관리자여야 함
  if prole != 'supervisor' and (prole != 'admin' or pteam is null or (pteam != team_id_a and pteam != team_id_b)) then
    raise exception '관련 팀 관리자만 공유를 해제할 수 있습니다.';
  end if;

  -- 양방향 공유 두 행 모두 삭제
  delete from public.team_schedule_shares
  where (team_id = team_id_a and shared_with_team_id = team_id_b)
     or (team_id = team_id_b and shared_with_team_id = team_id_a);
end;
$$;

grant execute on function public.remove_team_share(uuid, uuid) to authenticated;
