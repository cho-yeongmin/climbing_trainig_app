/**
 * 기상청 동네예보 getVilageFcst (2.0) + LCC 격자 변환
 * — kimjbstar/korea-public-village-forecast 등 공개 구현과 동일한 LCC 수식
 */
const KMA_VILAGE =
  'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst'

/** 단기 발표 시각(시) — base_time = HH+00 (공공데이터 동네예보) */
const KMA_SLOTS = [2, 5, 8, 11, 14, 17, 20, 23] as const

const RE = 6371.00877
const GRID = 5.0
const SLAT1 = 30.0
const SLAT2 = 60.0
const OLON = 126.0
const OLAT = 38.0
const XO = 43
const YO = 136

export function latLngToGrid(lat: number, lng: number): { nx: number; ny: number } {
  const { PI, tan, log, cos, pow, floor, sin, atan2 } = Math
  const DEGRAD = Math.PI / 180.0
  const re = RE / GRID
  const slat1 = SLAT1 * DEGRAD
  const slat2 = SLAT2 * DEGRAD
  const olon = OLON * DEGRAD
  const olat = OLAT * DEGRAD
  let sn = tan(PI * 0.25 + slat2 * 0.5) / tan(PI * 0.25 + slat1 * 0.5)
  sn = log(cos(slat1) / cos(slat2)) / log(sn)
  let sf = tan(PI * 0.25 + slat1 * 0.5)
  sf = (pow(sf, sn) * cos(slat1)) / sn
  let ro = tan(PI * 0.25 + olat * 0.5)
  ro = (re * sf) / pow(ro, sn)
  const ra = tan(PI * 0.25 + lat * DEGRAD * 0.5)
  const raf = (re * sf) / pow(ra, sn)
  let theta = lng * DEGRAD - olon
  if (theta > PI) theta -= 2.0 * PI
  if (theta < -PI) theta += 2.0 * PI
  theta *= sn
  const nx = floor(raf * sin(theta) + XO + 0.5)
  const ny = floor(ro - raf * cos(theta) + YO + 0.5)
  return { nx, ny }
}

function kmaVilageShiftEarlier(
  baseDate8: string,
  time4: string,
  addKst: (ymd: string, n: number) => string
): { baseDate: string; baseTime: string } | null {
  const h = Math.floor(parseInt(time4, 10) / 100)
  const idx = KMA_SLOTS.findIndex((s) => s === h)
  if (idx < 0) return null
  if (idx > 0) {
    return { baseDate: baseDate8, baseTime: String(KMA_SLOTS[idx - 1]).padStart(2, '0') + '00' }
  }
  const iso = `${baseDate8.slice(0, 4)}-${baseDate8.slice(4, 6)}-${baseDate8.slice(6, 8)}`
  const prev = addKst(iso, -1)
  return { baseDate: prev.replace(/-/g, ''), baseTime: '2300' }
}

export function kmaVilageBaseCandidates(
  addKst: (ymd: string, n: number) => string
): { baseDate: string; baseTime: string }[] {
  const seen = new Set<string>()
  const out: { baseDate: string; baseTime: string }[] = []
  const push = (baseDate: string, baseTime: string) => {
    const k = `${baseDate}-${baseTime}`
    if (seen.has(k)) return
    seen.add(k)
    out.push({ baseDate, baseTime })
  }
  const primary = kmaVilageBaseDateTime(addKst)
  let cur: { baseDate: string; baseTime: string } = primary
  for (let i = 0; i < 6; i++) {
    push(cur.baseDate, cur.baseTime)
    const n = kmaVilageShiftEarlier(cur.baseDate, cur.baseTime, addKst)
    if (!n) break
    cur = n
  }
  return out
}

/** KST. 단기 02·05·08·11·14·17·20·23 + 약 10분 이후에만 해당 발표 사용 */
export function kmaVilageBaseDateTime(addKst: (ymd: string, n: number) => string): { baseDate: string; baseTime: string } {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? '0'
  const y = g('year')
  const m = g('month')
  const d = g('day')
  const h = parseInt(g('hour'), 10)
  const min = parseInt(g('minute'), 10)
  const tmin = h * 60 + min
  if (tmin < 2 * 60 + 10) {
    const prev = addKst(`${y}-${m}-${d}`, -1)
    return { baseDate: prev.replace(/-/g, ''), baseTime: '2300' }
  }
  let best: (typeof KMA_SLOTS)[number] = 2
  for (const s of KMA_SLOTS) {
    if (tmin >= s * 60 + 10) best = s
  }
  return { baseDate: `${y}${m}${d}`, baseTime: String(best).padStart(2, '0') + '00' }
}

type KmaItem = {
  category: string
  fcstDate: string | number
  fcstTime: string | number
  fcstValue: string | number
}

function asYmd8(d: string | number): string {
  const s = String(d ?? '').replace(/\D/g, '')
  return s.length >= 8 ? s.slice(0, 8) : s
}

function asFcstValue(v: string | number | undefined): string {
  if (v == null) return ''
  return typeof v === 'number' && Number.isFinite(v) ? String(v) : String(v).trim()
}

function ymdKmaToIso(ymd: string): string {
  if (ymd.length !== 8) return ymd
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`
}

function skyPtyToWmo(sky: string | undefined, pty: string | undefined): number {
  const p = pty != null && pty !== '' ? parseInt(pty, 10) : 0
  if (p === 1) return 61
  if (p === 2) return 66
  if (p === 3) return 71
  if (p === 4) return 80
  const s = sky != null && sky !== '' ? parseInt(sky, 10) : 0
  if (s === 1) return 0
  if (s === 3) return 2
  if (s === 4) return 3
  return 2
}

/**
 * getVilageFcst 응답 → fcstDate(YYYYMMDD) 별 1일 요약(대표 시각: 낮권 15시 슬롯 우선, 없으면 임의)
 */
export function parseKmaVilageToDaily(
  items: KmaItem[]
): Map<string, { tmin: number | null; tmax: number | null; precipProb: number | null; wmo: number }> {
  const byDate = new Map<
    string,
    {
      tmn?: string
      tmx?: string
      popList: number[]
      skyAt15?: string
      ptyAt15?: string
      anySky?: string
      anyPty?: string
    }
  >()
  for (const it of items) {
    const d = asYmd8(it.fcstDate)
    if (d.length !== 8) continue
    if (!byDate.has(d)) {
      byDate.set(d, { popList: [] })
    }
    const o = byDate.get(d)!
    const c = it.category
    const v = asFcstValue(it.fcstValue)
    const ftime = String(it.fcstTime ?? '').padStart(4, '0')
    if (c === 'TMN' && v) o.tmn = v
    if (c === 'TMX' && v) o.tmx = v
    if (c === 'POP' && v) {
      const n = parseInt(v, 10)
      if (Number.isFinite(n)) o.popList.push(n)
    }
    if (ftime === '1500' || ftime === '1200' || ftime === '1800' || ftime === '0000') {
      if (c === 'SKY' && v) o.skyAt15 = v
      if (c === 'PTY' && v) o.ptyAt15 = v
    }
    if (c === 'SKY' && v) o.anySky = v
    if (c === 'PTY' && v) o.anyPty = v
  }
  const out = new Map<string, { tmin: number | null; tmax: number | null; precipProb: number | null; wmo: number }>()
  for (const [d, o] of byDate) {
    const tmin = o.tmn != null ? Math.round(parseFloat(o.tmn)) : null
    const tmax = o.tmx != null ? Math.round(parseFloat(o.tmx)) : null
    const precipProb = o.popList.length
      ? Math.round(o.popList.reduce((a, b) => a + b, 0) / o.popList.length)
      : null
    const sky = o.skyAt15 ?? o.anySky
    const pty = o.ptyAt15 ?? o.anyPty
    const wmo = skyPtyToWmo(sky, pty)
    out.set(ymdKmaToIso(d), { tmin, tmax, precipProb, wmo })
  }
  return out
}

export type KmaFetchResult = {
  dailyByYmd: Map<string, { tmin: number | null; tmax: number | null; precipProb: number | null; wmo: number }>
} | null

/**
 * 공공데이터포털 키: **일반(디코딩)** 권장(URLSearchParams가 인코딩).
 * "URL 인코딩"으로 복사한 키(이미 %2F 등)는 이중 인코딩되면 실패하므로 그대로 붙임.
 */
function buildVilageRequestUrl(
  key: string,
  nx: number,
  ny: number,
  baseDate: string,
  baseTime: string
): string {
  const p = new URLSearchParams()
  p.set('pageNo', '1')
  p.set('numOfRows', '2000')
  p.set('dataType', 'JSON')
  p.set('base_date', baseDate)
  p.set('base_time', baseTime)
  p.set('nx', String(nx))
  p.set('ny', String(ny))
  const looksPreEncoded =
    /%[0-9A-Fa-f]{2}/.test(key) && key.length >= 48 && (key.includes('%2F') || key.includes('%2B'))
  if (looksPreEncoded) {
    return `${KMA_VILAGE}?${p.toString()}&serviceKey=${key}`
  }
  p.set('serviceKey', key)
  return `${KMA_VILAGE}?${p.toString()}`
}

/**
 * KMA REST 키 + addKst(addDaysYmd). 발표 시각 여러 개 시도(이전 슬롯·전일 23시).
 */
export async function fetchKmaVilageShortTerm(
  serviceKey: string,
  lat: number,
  lon: number,
  addKst: (ymd: string, n: number) => string
): Promise<KmaFetchResult> {
  const k = serviceKey.trim()
  if (!k) return null
  const { nx, ny } = latLngToGrid(lat, lon)
  const candidates = kmaVilageBaseCandidates(addKst)
  for (const { baseDate, baseTime } of candidates) {
    const url = buildVilageRequestUrl(k, nx, ny, baseDate, baseTime)
    let res: Response
    try {
      res = await fetch(url)
    } catch (e) {
      console.error('[KMA] fetch error', e, { nx, ny, baseDate, baseTime })
      continue
    }
    if (!res.ok) {
      console.error('[KMA] http', res.status, { nx, ny, baseDate, baseTime })
      continue
    }
    let j: {
      response?: {
        header?: { resultCode?: string; resultMsg?: string }
        body?: { items?: { item?: KmaItem | KmaItem[] }; totalCount?: string | number }
      }
    }
    try {
      j = await res.json()
    } catch {
      console.error('[KMA] json parse', { nx, ny, baseDate, baseTime })
      continue
    }
    const rc = j?.response?.header?.resultCode
    const rm = j?.response?.header?.resultMsg
    if (rc && rc !== '00') {
      console.error('[KMA] result', rc, rm, { nx, ny, baseDate, baseTime })
      continue
    }
    const raw = j?.response?.body?.items?.item
    if (raw == null) {
      console.error('[KMA] no item', {
        nx,
        ny,
        baseDate,
        baseTime,
        total: j?.response?.body?.totalCount,
      })
      continue
    }
    const arr: KmaItem[] = Array.isArray(raw) ? raw : [raw]
    if (!arr.length) continue
    const dailyByYmd = parseKmaVilageToDaily(arr)
    if (dailyByYmd.size === 0) {
      console.error('[KMA] parsed 0 days; sample', arr[0])
      continue
    }
    console.log('[KMA] ok', {
      nx,
      ny,
      baseDate,
      baseTime,
      kmaDayCount: dailyByYmd.size,
      kmaDays: [...dailyByYmd.keys()].slice(0, 5),
    })
    return { dailyByYmd }
  }
  console.error('[KMA] exhausted', { nx, ny, tryCount: candidates.length })
  return null
}
