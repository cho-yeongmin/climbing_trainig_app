-- =====================================================
-- 공유 요청 보내기 RPC (해제 후 재요청 시 기존 행 갱신)
-- 이전에 승인/거절/해제된 팀에도 다시 요청 가능
-- =====================================================

create or replace function public.send_share_request(p_from_team_id uuid, p_to_team_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  prole text;
  pteam uuid;
  rec record;
begin
  if p_from_team_id = p_to_team_id then
    raise exception '동일한 팀입니다.';
  end if;

  select role, team_id into prole, pteam
  from public.profiles where id = auth.uid();

  if prole is null then
    raise exception '로그인이 필요합니다.';
  end if;

  -- from_team 관리자 또는 슈퍼바이저만 요청 가능
  if prole != 'supervisor' and (prole != 'admin' or pteam is null or pteam != p_from_team_id) then
    raise exception '본인 팀 관리자만 요청을 보낼 수 있습니다.';
  end if;

  -- 이미 공유 중이면 거부
  if exists (
    select 1 from public.team_schedule_shares
    where (team_id = p_from_team_id and shared_with_team_id = p_to_team_id)
       or (team_id = p_to_team_id and shared_with_team_id = p_from_team_id)
  ) then
    raise exception '이미 공유 중인 팀입니다.';
  end if;

  -- 기존 요청이 있으면 갱신, 없으면 삽입
  insert into public.team_share_requests (from_team_id, to_team_id, status, updated_at)
  values (p_from_team_id, p_to_team_id, 'pending', now())
  on conflict (from_team_id, to_team_id) do update
  set status = 'pending', updated_at = now()
  returning id, from_team_id, to_team_id, status, created_at, updated_at into rec;

  return to_jsonb(rec);
end;
$$;

grant execute on function public.send_share_request(uuid, uuid) to authenticated;
