-- =====================================================
-- 장소별 난이도 색상 (운동장소마다 난이도 색상이 다름)
-- 프로그래머가 직접 INSERT로 데이터 입력
-- =====================================================
create table public.place_difficulty_colors (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  color_hex text not null,
  grade_label text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_place_difficulty_colors_place on public.place_difficulty_colors(place_id);
create unique index idx_place_difficulty_colors_place_grade on public.place_difficulty_colors(place_id, grade_label);

alter table public.place_difficulty_colors enable row level security;

create policy "난이도 색상 전체 읽기"
  on public.place_difficulty_colors for select
  using (true);

create policy "관리자만 난이도 색상 수정"
  on public.place_difficulty_colors for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );
