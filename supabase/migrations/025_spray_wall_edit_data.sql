-- =====================================================
-- 스프레이월 문제 편집: 원본 이미지 + 홀드(borders) 데이터 저장
-- =====================================================

alter table public.spray_wall_problems
  add column if not exists base_image_data text,
  add column if not exists borders jsonb not null default '[]';
