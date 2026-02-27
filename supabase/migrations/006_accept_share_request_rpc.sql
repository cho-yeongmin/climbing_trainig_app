-- =====================================================
-- 공유 요청 승인 RPC (RLS 우회 - 수신 팀 관리자만 실행 가능)
-- =====================================================

create or replace function public.accept_share_request(request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req record;
  prole text;
  pteam uuid;
begin
  -- 현재 사용자 프로필
  select role, team_id into prole, pteam
  from public.profiles where id = auth.uid();

  if prole is null then
    raise exception '로그인이 필요합니다.';
  end if;

  -- 요청 조회
  select from_team_id, to_team_id, status into req
  from public.team_share_requests
  where id = request_id;

  if req is null then
    raise exception '요청을 찾을 수 없습니다.';
  end if;

  if req.status != 'pending' then
    raise exception '이미 처리된 요청입니다.';
  end if;

  -- 슈퍼바이저 또는 수신 팀(to_team) 관리자만 승인 가능
  if prole != 'supervisor' and (prole != 'admin' or pteam is null or pteam != req.to_team_id) then
    raise exception '수신 팀 관리자만 승인할 수 있습니다.';
  end if;

  -- 양방향 공유 생성
  insert into public.team_schedule_shares (team_id, shared_with_team_id)
  values (req.from_team_id, req.to_team_id)
  on conflict (team_id, shared_with_team_id) do nothing;

  insert into public.team_schedule_shares (team_id, shared_with_team_id)
  values (req.to_team_id, req.from_team_id)
  on conflict (team_id, shared_with_team_id) do nothing;

  -- 요청 상태 갱신
  update public.team_share_requests
  set status = 'accepted', updated_at = now()
  where id = request_id;
end;
$$;

-- RPC 호출 권한
grant execute on function public.accept_share_request(uuid) to authenticated;
