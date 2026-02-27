-- =====================================================
-- training_records: 개인 일정 기반 훈련 기록 지원
-- =====================================================

alter table public.training_records
  add column if not exists personal_schedule_id uuid
  references public.user_personal_schedules(id) on delete cascade;

create index if not exists idx_training_records_personal_schedule
  on public.training_records(personal_schedule_id)
  where personal_schedule_id is not null;
