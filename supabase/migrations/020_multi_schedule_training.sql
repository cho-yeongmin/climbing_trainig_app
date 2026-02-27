-- =====================================================
-- 복수 일정/훈련 지원
-- =====================================================

-- 1. schedules: (team_id, date) unique 제거 → 하루에 복수 일정 허용
drop index if exists public.idx_schedules_team_date;
create index idx_schedules_team_date on public.schedules(team_id, date);

-- 2. user_personal_schedules: title nullable (제목 미사용, 장소/훈련만 사용)
alter table public.user_personal_schedules alter column title set default '';
alter table public.user_personal_schedules alter column title drop not null;

-- 3. training_records: (user_id, record_date, exercise_type_id) unique 제거 → 복수 훈련 기록 허용
alter table public.training_records drop constraint if exists training_records_user_id_record_date_exercise_type_id_key;
