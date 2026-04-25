/**
 * 캐시가 비어 있을 때, 로그인 사용자가 조회한 장소 1곳에 대해 Open-Meteo → place_weather_daily upsert
 * (JWT: 읽을 수 있는 places만 처리; RLS는 anon+Authorization으로 검사)
 * 배포: supabase functions deploy refresh-place-weather
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10'
import { upsertPlaceWeatherForPlace } from '../_shared/place-weather.ts'

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    })
  }
  if (req.method !== 'POST') {
    return json({ error: 'method not allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.trim()) {
    return json({ error: 'unauthorized' }, 401)
  }

  let place_id: string
  try {
    const b = await req.json()
    place_id = typeof b?.place_id === 'string' ? b.place_id : ''
  } catch {
    return json({ error: 'invalid body' }, 400)
  }
  if (!place_id) {
    return json({ error: 'place_id required' }, 400)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: place, error: pe } = await userClient
    .from('places')
    .select('id, name, address')
    .eq('id', place_id)
    .maybeSingle()

  if (pe) {
    return json({ error: 'forbidden', message: pe.message }, 403)
  }
  if (!place) {
    return json({ error: 'forbidden' }, 403)
  }
  if (!place.address || !String(place.address).trim()) {
    return json({ error: 'no address' }, 400)
  }

  const service = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const res = await upsertPlaceWeatherForPlace(service, {
    id: place.id,
    name: (place.name as string) || '',
    address: place.address as string,
  })

  if (!res.ok) {
    return json(
      { ok: false, reason: res.reason, message: res.message },
      res.reason === 'db' ? 500 : 422
    )
  }

  return json({
    ok: true,
    start: res.start,
    end: res.end,
    place_id: place.id,
    rowCount: res.rowCount,
  })
})
