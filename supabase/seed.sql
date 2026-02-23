-- =====================================================
-- 운동 종류 초기 데이터 (7가지 날 유형)
-- image_url, config는 Supabase Table Editor에서 직접 입력
-- =====================================================
insert into public.exercise_types (day_type_id, name, image_url, config)
values
  ('expedition', '원정가는 날', null, '{}'),
  ('rest', '휴식하는 날', null, '{}'),
  ('finger', '손가락훈련하는 날', null, '{}'),
  ('power_bouldering', '파워볼더링하는 날', null, '{}'),
  ('rest_cardio', '휴식/유산소하는 날', null, '{}'),
  ('endurance', '근지구력하는 날', null, '{}'),
  ('rest_strength', '휴식/보강운동하는 날', null, '{}')
on conflict (day_type_id) do nothing;
