-- =====================================================
-- 프로필 확장: 닉네임, 뽐내기 정보, 팀 참가 신청
-- =====================================================

-- 1. profiles에 nickname, boast_info 추가
alter table public.profiles add column if not exists nickname text;
alter table public.profiles add column if not exists boast_info text;

-- 기존 display_name을 nickname으로 이전
update public.profiles set nickname = coalesce(display_name, '사용자') where nickname is null;

-- 신규 가입자에 기본 닉네임
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role, team_id, nickname)
  values (new.id, 'trainee', 'a0000000-0000-0000-0000-000000000001'::uuid, '사용자');
  return new;
end;
$$ language plpgsql security definer;

-- 2. team_join_requests (훈련생이 다른 팀으로 이동 요청, 관리자 승인)
create table public.team_join_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_team_id uuid references public.teams(id) on delete set null,
  to_team_id uuid not null references public.teams(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, to_team_id)
);

create index idx_team_join_requests_user on public.team_join_requests(user_id);
create index idx_team_join_requests_to on public.team_join_requests(to_team_id);
create index idx_team_join_requests_status on public.team_join_requests(status);

alter table public.team_join_requests enable row level security;

-- 본인 신청 조회
create policy "본인 팀 참가 신청 조회"
  on public.team_join_requests for select
  using (auth.uid() = user_id);

-- 훈련생만 신청 생성 (본인 팀 제외)
create policy "훈련생 팀 참가 신청"
  on public.team_join_requests for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'trainee'
    )
  );

-- 수신 팀 관리자만 승인/거절
create policy "팀 관리자 신청 수정"
  on public.team_join_requests for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
      and (p.role = 'supervisor' or (p.role = 'admin' and p.team_id = to_team_id))
    )
  );

-- 수신 팀 관리자만 본인 팀으로 들어온 신청 조회
create policy "관리자 본인 팀 신청 조회"
  on public.team_join_requests for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
      and (p.role = 'supervisor' or p.team_id = to_team_id)
    )
  );

-- 참고: 팀 참가 신청자 닉네임은 RPC get_team_join_requests_with_names 로 조회 (profiles 정책 재귀 방지)
