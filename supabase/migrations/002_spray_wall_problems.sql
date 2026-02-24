-- =====================================================
-- 스프레이월 문제 (문제내기 앱)
-- =====================================================
create table public.spray_wall_problems (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('bouldering', 'endurance')),
  image_data text not null,
  tags jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_spray_wall_problems_user on public.spray_wall_problems(user_id);
create index idx_spray_wall_problems_type on public.spray_wall_problems(type);
create index idx_spray_wall_problems_created on public.spray_wall_problems(created_at desc);

alter table public.spray_wall_problems enable row level security;

create policy "본인 스프레이월 문제만"
  on public.spray_wall_problems for all
  using (auth.uid() = user_id);
