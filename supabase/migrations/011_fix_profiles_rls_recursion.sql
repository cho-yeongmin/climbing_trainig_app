-- =====================================================
-- profiles RLS 무한 재귀 수정
-- "팀 참가 신청자 프로필 조회" 정책이 profiles를 참조해 재귀 발생
-- → 정책 제거 후 RPC로 대체
-- =====================================================

drop policy if exists "팀 참가 신청자 프로필 조회" on public.profiles;

-- 팀 참가 신청 목록 + 신청자 닉네임 반환 (관리자용)
create or replace function public.get_team_join_requests_with_names(p_team_id uuid)
returns table (
  id uuid,
  user_id uuid,
  from_team_id uuid,
  to_team_id uuid,
  status text,
  created_at timestamptz,
  user_nickname text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  prole text;
  pteam uuid;
begin
  select role, team_id into prole, pteam
  from public.profiles where id = auth.uid();

  if prole is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if prole != 'supervisor' and (prole != 'admin' or pteam != p_team_id) then
    raise exception '해당 팀 관리자만 조회할 수 있습니다.';
  end if;

  return query
  select
    tjr.id,
    tjr.user_id,
    tjr.from_team_id,
    tjr.to_team_id,
    tjr.status,
    tjr.created_at,
    coalesce(pr.nickname, pr.display_name, '사용자') as user_nickname
  from public.team_join_requests tjr
  left join public.profiles pr on pr.id = tjr.user_id
  where tjr.to_team_id = p_team_id
  and tjr.status = 'pending'
  order by tjr.created_at desc;
end;
$$;

grant execute on function public.get_team_join_requests_with_names(uuid) to authenticated;
