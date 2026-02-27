-- =====================================================
-- 팀 참가 신청 취소 RPC
-- =====================================================

create or replace function public.cancel_team_join_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req record;
begin
  select user_id, status into req
  from public.team_join_requests where id = p_request_id;

  if req is null then
    raise exception '신청을 찾을 수 없습니다.';
  end if;

  if req.user_id != auth.uid() then
    raise exception '본인 신청만 취소할 수 있습니다.';
  end if;

  if req.status != 'pending' then
    raise exception '승인 대기 중인 신청만 취소할 수 있습니다.';
  end if;

  delete from public.team_join_requests where id = p_request_id;
end;
$$;

grant execute on function public.cancel_team_join_request(uuid) to authenticated;
