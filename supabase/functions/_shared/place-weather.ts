/**
 * Open-Meteo → place_weather_daily upsert (nightly-weather, refresh-place-weather 공용)
 *
 * 좌표: 1) KAKAO_REST_API_KEY 있으면 카카오 로컬(주소·키워드) → 2) Open-Meteo 지오
 * Supabase: Project Settings → Edge Functions (Secrets) → KAKAO_REST_API_KEY = KakaoAK 아닌 REST API 키
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10'

const KAKAO_ADDR = 'https://dapi.kakao.com/v2/local/search/address.json'
const KAKAO_KEYWORD = 'https://dapi.kakao.com/v2/local/search/keyword.json'
const OPEN_METEO_GEO = 'https://geocoding-api.open-meteo.com/v1/search'
const OPEN_METEO_FX = 'https://api.open-meteo.com/v1/forecast'

export function todayKstYmd(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
}

export function addDaysYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const t = Date.UTC(y, m - 1, d) + n * 86400000
  const u = new Date(t)
  return `${u.getUTCFullYear()}-${String(u.getUTCMonth() + 1).padStart(2, '0')}-${String(u.getUTCDate()).padStart(2, '0')}`
}

type GeocodeRow = {
  latitude: number
  longitude: number
  name?: string
  admin1?: string
  admin2?: string
  admin3?: string
  country_code?: string
  admin1_id?: number
}

/** countryCode=KR 여러 건일 때, 주소(hint)와 맞는 행정구역(영/한) 우선. */
function pickGeocodeResult(hint: string, results: GeocodeRow[]): GeocodeRow | null {
  if (!results.length) return null
  const h = hint.replace(/\s+/g, '')

  const aStr = (r: GeocodeRow) =>
    [r.admin1, r.admin2, r.admin3, r.name, r.country].filter(Boolean).join(' ').toLowerCase()
  const rank = (r: GeocodeRow) => aStr(r)

  // '남해' 동명: 대전(목상동) vs 경남 남해군 — 힌트에 '경상'·'군'·'면' 있으면 경남+Namhae 우선
  if (h.includes('남해') && (h.includes('경상') || h.includes('군') || h.includes('남해군') || h.includes('남면'))) {
    const j = results.find(
      (r) =>
        (rank(r).includes('gyeongsangnam') || rank(r).includes('gyeongnam') || rank(r).includes('경상')) &&
        (rank(r).includes('namhae') || aStr(r).includes('남해'))
    )
    if (j) return j
  }
  const tokens = [hint, ...hint.split(/[\s,，、]+/u)]
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
  let best = results[0]!
  let bestScore = -1
  for (const r of results) {
    const a = aStr(r)
    let s = 0
    for (const t of new Set(tokens)) {
      if (h.includes(t.replace(/\s/g, '')) && a.includes(t.toLowerCase())) s += 4
    }
    if (s > bestScore) {
      bestScore = s
      best = r
    }
  }
  return best
}

async function geocodeOpenMeteoName(query: string, hint: string): Promise<{ lat: number; lon: number } | null> {
  if (!query?.trim()) return null
  const u = new URL(OPEN_METEO_GEO)
  u.searchParams.set('name', query.trim().slice(0, 200))
  u.searchParams.set('count', '10')
  u.searchParams.set('language', 'ko')
  u.searchParams.set('format', 'json')
  u.searchParams.set('countryCode', 'KR')
  const res = await fetch(u.toString())
  if (!res.ok) return null
  const j = await res.json()
  const list: GeocodeRow[] = j?.results ?? []
  const r = pickGeocodeResult(hint, list)
  if (r && typeof r.latitude === 'number' && typeof r.longitude === 'number') {
    return { lat: r.latitude, lon: r.longitude }
  }
  return null
}

function parseKakaoLatLon(d: { x?: string; y?: string }): { lat: number; lon: number } | null {
  if (d?.x == null || d?.y == null) return null
  const lon = Number(d.x)
  const lat = Number(d.y)
  if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon }
  return null
}

/**
 * Kakao Local: 주소 검색(도로명/지번) → 없으면 키워드(장소명+주소). WGS84 y=위도, x=경도.
 */
export async function geocodeKakao(
  restApiKey: string,
  name: string,
  address: string
): Promise<{ lat: number; lon: number } | null> {
  const k = restApiKey.trim()
  if (!k) return null
  const headers = { Authorization: `KakaoAK ${k}` }

  const runAddr = async (q: string) => {
    if (!q.trim()) return null
    const u = new URL(KAKAO_ADDR)
    u.searchParams.set('query', q.trim().slice(0, 200))
    u.searchParams.set('size', '3')
    const res = await fetch(u.toString(), { headers })
    if (!res.ok) return null
    const j = await res.json()
    for (const d of j?.documents ?? []) {
      const p = parseKakaoLatLon(d)
      if (p) return p
    }
    return null
  }

  const runKeyword = async (q: string) => {
    if (!q.trim()) return null
    const u = new URL(KAKAO_KEYWORD)
    u.searchParams.set('query', q.trim().slice(0, 200))
    u.searchParams.set('size', '5')
    const res = await fetch(u.toString(), { headers })
    if (!res.ok) return null
    const j = await res.json()
    for (const d of j?.documents ?? []) {
      const p = parseKakaoLatLon(d)
      if (p) return p
    }
    return null
  }

  if (address.trim()) {
    const a = address.trim().slice(0, 200)
    const p = (await runAddr(a)) ?? (await runKeyword(a))
    if (p) return p
  }
  if (name.trim() && address.trim()) {
    const combined = `${name} ${address}`.trim().slice(0, 200)
    const p =
      (await runAddr(combined)) ??
      (await runKeyword(combined)) ??
      (await runKeyword(name.trim().slice(0, 200)))
    if (p) return p
  } else if (name.trim() && !address.trim()) {
    return (await runKeyword(name.trim().slice(0, 200))) ?? null
  }
  return null
}

function buildQueries(name: string, address: string): string[] {
  const n = name.trim()
  const a = address.trim()
  const full = [n, a].filter(Boolean).join(' ').trim()
  const out: string[] = []
  const push = (q: string) => {
    if (q && !out.includes(q)) out.push(q)
  }
  const stripLot = (s: string) => s.replace(/\s+\d+(-\d+)?\s*$/, '').trim()
  const addrNe = /^전북\s/.test(a) || a.startsWith('전북 ') ? a.replace(/^전북\s?/, '전라북도 ') : null
  const stripped = stripLot(a)
  const strippedNe = addrNe ? stripLot(addrNe) : null
  // '남면로'는 면+로(무공백) → (?:.+)면)만 쓰면 '남면 남면' 오탐. 첫 'xx면'만: \S+?면, 뒤는 공백/로/…
  const m = a.match(
    /(.+?(?:군|시))\s+(\S+?면)(?=\s|$|로|동|리|길|번|\d)/u
  )
  if (m) push(`${m[1].trim()} ${m[2].trim()}`)
  const m2 = a.match(/(.+군)/)
  if (m2) push(m2[1].trim())
  if (addrNe) {
    const m3 = addrNe.match(/(.+?(?:군|시))\s+(\S+?면)(?=\s|$|로|동|리|길|번|\d)/u)
    if (m3) push(`${m3[1].trim()} ${m3[2].trim()}`)
  }
  if (stripped !== a) {
    const sm = stripped.match(/(.+?(?:군|시))\s+(\S+?면)(?=\s|$|로|동|리|길|번|\d)/u)
    if (sm) push(`${sm[1].trim()} ${sm[2].trim()}`)
  }
  const forRi = strippedNe || stripped
  if (forRi) {
    const mRi = forRi.match(/(.+면)\s+(.+리)/)
    if (mRi) push(`${mRi[1].trim()} ${mRi[2].trim()}`)
  }
  if (addrNe && /진안/.test(a)) {
    push('전라북도 진안군')
    push('진안군')
  }
  if (full) push(full)
  if (n) push(n)
  if (stripped) push(stripped)
  if (a) push(a)
  return out
}

export async function geocodePlace(
  name: string,
  address: string
): Promise<{ lat: number; lon: number } | null> {
  const kakaoKey = typeof Deno !== 'undefined' ? Deno.env.get('KAKAO_REST_API_KEY')?.trim() : ''
  if (kakaoKey) {
    const k = await geocodeKakao(kakaoKey, name, address)
    if (k) return k
  }
  const hint = [name, address].filter(Boolean).join(' ')
  for (const q of buildQueries(name, address)) {
    const g = await geocodeOpenMeteoName(q, hint)
    if (g) return g
  }
  return null
}

export async function fetchDaily(lat: number, lon: number, start: string, end: string) {
  const u = new URL(OPEN_METEO_FX)
  u.searchParams.set('latitude', String(lat))
  u.searchParams.set('longitude', String(lon))
  u.searchParams.set('timezone', 'Asia/Seoul')
  u.searchParams.set('start_date', start)
  u.searchParams.set('end_date', end)
  u.searchParams.set('daily', 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max')
  const res = await fetch(u.toString())
  if (!res.ok) return null
  const j = await res.json()
  if (j?.error) return null
  return j
}

export type UpsertResult =
  | { ok: true; start: string; end: string; rowCount: number }
  | { ok: false; reason: 'geocode' | 'forecast' | 'db'; message?: string }

/**
 * KST 기준 오늘부터 16일(오늘+15) 예보를 place_id에 upsert
 */
export async function upsertPlaceWeatherForPlace(
  supabase: SupabaseClient,
  place: { id: string; name: string; address: string }
): Promise<UpsertResult> {
  const start = todayKstYmd()
  const end = addDaysYmd(start, 15)
  const now = new Date().toISOString()

  const pos = await geocodePlace((place.name as string) || '', place.address as string)
  if (!pos) {
    return { ok: false, reason: 'geocode' }
  }
  const j = await fetchDaily(pos.lat, pos.lon, start, end)
  if (!j?.daily?.time) {
    return { ok: false, reason: 'forecast' }
  }
  const times: string[] = j.daily.time
  const codes = j.daily.weathercode ?? []
  const tmax = j.daily.temperature_2m_max ?? []
  const tmin = j.daily.temperature_2m_min ?? []
  const pprob = j.daily.precipitation_probability_max ?? []
  const rows = times.map((t: string, i: number) => ({
    place_id: place.id,
    forecast_date: t,
    weathercode: codes[i] != null ? Math.round(Number(codes[i])) : null,
    tmin: tmin[i] != null ? Math.round(Number(tmin[i])) : null,
    tmax: tmax[i] != null ? Math.round(Number(tmax[i])) : null,
    precip_prob: pprob[i] != null ? Math.round(Number(pprob[i])) : null,
    fetched_at: now,
  }))
  const { error: ue } = await supabase.from('place_weather_daily').upsert(rows, {
    onConflict: 'place_id,forecast_date',
  })
  if (ue) {
    return { ok: false, reason: 'db', message: ue.message }
  }
  return { ok: true, start, end, rowCount: rows.length }
}
