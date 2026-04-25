/**
 * 야간 배치: public.places(주소 있음)마다 Open-Meteo 16일 일별 예보 → place_weather_daily upsert
 *
 * Supabase: Project Settings → Edge Functions → 스케줄
 *   권장: 매일 18:00 UTC (한국 다음날 새벽 3시쯤, 서머타임 없음) → 로직은 항상 Asia/Seoul "오늘" 기준
 * 배포: supabase functions deploy nightly-weather
 * 수동: curl -X POST "https://<ref>.supabase.co/functions/v1/nightly-weather" -H "x-cron-secret: $CRON_SECRET" (CRON_SECRET 설정 시)
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10'
import { todayKstYmd, addDaysYmd, upsertPlaceWeatherForPlace } from '../_shared/place-weather.ts'

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET')
  if (secret) {
    const h = req.headers.get('x-cron-secret') ?? ''
    if (h !== secret) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
    }
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  const { data: places, error: pe } = await supabase
    .from('places')
    .select('id, name, address')
    .not('address', 'is', null)
    .neq('address', '')

  if (pe) {
    return new Response(JSON.stringify({ error: pe.message }), { status: 500 })
  }

  // 한 번에 너무 오래 돌지 않게 상한(필요 시 나눠서 백필)
  const list = (places ?? []).slice(0, 500)
  const start = todayKstYmd()
  const end = addDaysYmd(start, 15)

  let ok = 0
  let fail = 0
  for (const p of list) {
    const res = await upsertPlaceWeatherForPlace(supabase, {
      id: p.id as string,
      name: (p.name as string) || '',
      address: p.address as string,
    })
    if (res.ok) {
      ok++
    } else {
      fail++
    }
    await new Promise((r) => setTimeout(r, 250))
  }

  return new Response(
    JSON.stringify({
      ok: true,
      start,
      end,
      places: list.length,
      successPlaces: ok,
      failedOrSkipped: fail,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
