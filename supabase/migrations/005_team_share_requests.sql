-- =====================================================
-- 팀 일정 공유 요청 (신청 → 동의)
-- =====================================================

create table public.team_share_requests (
  id uuid primary key default gen_random_uuid(),
  from_team_id uuid not null references public.teams(id) on delete cascade,
  to_team_id uuid not null references public.teams(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(from_team_id, to_team_id),
  check (from_team_id != to_team_id)
);

create index idx_team_share_requests_from on public.team_share_requests(from_team_id);
create index idx_team_share_requests_to on public.team_share_requests(to_team_id);
create index idx_team_share_requests_status on public.team_share_requests(status);

alter table public.team_share_requests enable row level security;

-- 팀 관리자: 자신의 팀이 from 또는 to인 요청 조회
create policy "공유 요청 조회 (관련 팀)"
  on public.team_share_requests for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
      and (p.role = 'supervisor' or (p.team_id = from_team_id or p.team_id = to_team_id))
    )
  );

-- from_team 관리자만 요청 생성 (보내기)
create policy "공유 요청 생성 (본인 팀에서)"
  on public.team_share_requests for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
      and (p.role = 'supervisor' or p.team_id = from_team_id)
    )
  );

-- to_team 관리자만 status 수정 (승인/거절)
create policy "공유 요청 수정 (수신 팀 관리자)"
  on public.team_share_requests for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
      and (p.role = 'supervisor' or p.team_id = to_team_id)
    )
  );
