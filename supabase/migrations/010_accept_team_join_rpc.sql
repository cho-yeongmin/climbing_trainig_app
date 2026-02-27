-- =====================================================
-- 팀 참가 승인 RPC
-- =====================================================

create or replace function public.accept_team_join_request(request_id uuid)
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
  select role, team_id into prole, pteam
  from public.profiles where id = auth.uid();

  if prole is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select user_id, from_team_id, to_team_id, status into req
  from public.team_join_requests where id = request_id;

  if req is null then
    raise exception '신청을 찾을 수 없습니다.';
  end if;

  if req.status != 'pending' then
    raise exception '이미 처리된 신청입니다.';
  end if;

  if prole != 'supervisor' and (prole != 'admin' or pteam != req.to_team_id) then
    raise exception '해당 팀 관리자만 승인할 수 있습니다.';
  end if;

  update public.profiles
  set team_id = req.to_team_id, role = 'trainee', updated_at = now()
  where id = req.user_id;

  update public.team_join_requests
  set status = 'accepted', updated_at = now()
  where id = request_id;
end;
$$;

create or replace function public.reject_team_join_request(request_id uuid)
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
  select role, team_id into prole, pteam
  from public.profiles where id = auth.uid();

  if prole is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select to_team_id, status into req
  from public.team_join_requests where id = request_id;

  if req is null then
    raise exception '신청을 찾을 수 없습니다.';
  end if;

  if req.status != 'pending' then
    raise exception '이미 처리된 신청입니다.';
  end if;

  if prole != 'supervisor' and (prole != 'admin' or pteam != req.to_team_id) then
    raise exception '해당 팀 관리자만 거절할 수 있습니다.';
  end if;

  update public.team_join_requests
  set status = 'rejected', updated_at = now()
  where id = request_id;
end;
$$;

grant execute on function public.accept_team_join_request(uuid) to authenticated;
grant execute on function public.reject_team_join_request(uuid) to authenticated;
