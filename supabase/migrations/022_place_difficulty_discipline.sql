-- =====================================================
-- place_difficulty_colors: 종목 구분 (볼더링/리드)
-- =====================================================

-- 1. discipline 컬럼 추가 (기본값 bouldering)
alter table public.place_difficulty_colors
  add column if not exists discipline text not null default 'bouldering';

-- 2. 기존 unique 제거 후 (place_id, discipline, grade_label) unique 추가
drop index if exists public.idx_place_difficulty_colors_place_grade;
create unique index idx_place_difficulty_colors_place_discipline_grade
  on public.place_difficulty_colors(place_id, discipline, grade_label);

-- 3. discipline 체크 제약
alter table public.place_difficulty_colors
  drop constraint if exists place_difficulty_colors_discipline_check;
alter table public.place_difficulty_colors
  add constraint place_difficulty_colors_discipline_check
  check (discipline in ('bouldering', 'lead'));
