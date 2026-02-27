-- =====================================================
-- 팀 참가 신청 RPC 수정: 예전 팀으로 재신청 허용
-- (승인 후 다른 팀으로 이동한 경우, 이전 소속 팀에 다시 신청 가능)
-- =====================================================

create or replace function public.send_team_join_request(
  p_user_id uuid,
  p_from_team_id uuid,
  p_to_team_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  exist_req record;
  prole text;
  pcurrent_team uuid;
begin
  select role into prole from public.profiles where id = auth.uid();
  if prole is null or auth.uid() != p_user_id then
    raise exception '권한이 없습니다.';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_user_id and role = 'trainee'
  ) then
    raise exception '훈련생만 팀 참가 신청할 수 있습니다.';
  end if;

  if p_from_team_id = p_to_team_id then
    raise exception '같은 팀으로의 신청은 불가합니다.';
  end if;

  -- 이미 다른 팀에 승인 대기 중이면 신청 불가 (한 팀만 신청 가능)
  if exists (
    select 1 from public.team_join_requests
    where user_id = p_user_id and status = 'pending' and to_team_id != p_to_team_id
  ) then
    raise exception '이미 다른 팀에 신청 중입니다. 기존 신청을 취소한 후 다시 신청해 주세요.';
  end if;

  select id, status into exist_req
  from public.team_join_requests
  where user_id = p_user_id and to_team_id = p_to_team_id
  limit 1;

  if exist_req.id is not null then
    if exist_req.status = 'pending' then
      raise exception '이미 신청한 팀입니다.';
    end if;
    -- 거절됨: 재신청 허용
    if exist_req.status = 'rejected' then
      update public.team_join_requests
      set status = 'pending', from_team_id = p_from_team_id, updated_at = now()
      where id = exist_req.id;
      return;
    end if;
    -- accepted: 현재 해당 팀 소속이면 재신청 불가, 다른 팀 소속이면 재신청 허용 (예전 팀으로 복귀)
    select team_id into pcurrent_team from public.profiles where id = p_user_id;
    if pcurrent_team = p_to_team_id then
      raise exception '이미 승인된 팀입니다.';
    end if;
    update public.team_join_requests
    set status = 'pending', from_team_id = p_from_team_id, updated_at = now()
    where id = exist_req.id;
    return;
  end if;

  insert into public.team_join_requests (user_id, from_team_id, to_team_id, status)
  values (p_user_id, p_from_team_id, p_to_team_id, 'pending');
end;
$$;
