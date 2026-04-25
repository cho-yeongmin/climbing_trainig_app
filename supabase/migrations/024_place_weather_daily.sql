-- 일별 장소 날씨 캐시 (Open-Meteo, 야간 Edge Function이 갱신)
create table if not exists public.place_weather_daily (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  forecast_date date not null,
  weathercode int,
  tmin int,
  tmax int,
  precip_prob int,
  fetched_at timestamptz not null default now(),
  unique (place_id, forecast_date)
);

create index if not exists idx_place_weather_daily_place_date
  on public.place_weather_daily(place_id, forecast_date);

comment on table public.place_weather_daily is '장소×일자별 날씨(캐시). 앱은 SELECT만, 갱신은 service role(Edge)';

alter table public.place_weather_daily enable row level security;

-- 로그인 사용자 읽기만
create policy "place_weather_daily_select_authenticated"
  on public.place_weather_daily for select
  to authenticated
  using (true);
