/**
 * 주소/장소명 → 위·경도 (브라우저 전용)
 *
 * Open-Meteo Geocoding API만 사용합니다.
 * Nominatim(OSM)은 CORS 미허용·429 정책으로 프론트에서 직접 호출하지 않습니다.
 * (서버 프록시가 있을 때만 서버에서 호출하는 것이 맞습니다.)
 *
 * 세션 캐시로 동일 주소 재요청 방지.
 */

const GEO_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const geoCache = new Map()

function cacheKey(placeName, placeAddress) {
  return `${(placeName ?? '').trim()}|${(placeAddress ?? '').trim()}`
}

function getCachedGeo(key) {
  const e = geoCache.get(key)
  if (!e) return null
  if (Date.now() - e.t > GEO_CACHE_TTL_MS) {
    geoCache.delete(key)
    return null
  }
  return e.pos
}

function setCachedGeo(key, pos) {
  if (pos?.lat != null && pos?.lon != null) {
    geoCache.set(key, { pos, t: Date.now() })
  }
}

export async function geocodeOpenMeteoName(query) {
  if (!query?.trim()) return null
  const u = new URL('https://geocoding-api.open-meteo.com/v1/search')
  u.searchParams.set('name', query.trim().slice(0, 200))
  u.searchParams.set('count', '5')
  u.searchParams.set('language', 'ko')
  u.searchParams.set('format', 'json')
  const res = await fetch(u.toString())
  if (!res.ok) return null
  const j = await res.json()
  const r = j?.results?.[0]
  if (r && typeof r.latitude === 'number' && typeof r.longitude === 'number') {
    return { lat: r.latitude, lon: r.longitude, source: 'open-meteo' }
  }
  return null
}

function stripLot(addr) {
  return (addr ?? '').trim().replace(/\s+\d+(-\d+)?\s*$/, '').trim()
}

function expandJeonbuk(addr) {
  const t = (addr ?? '').trim()
  if (/^전북\s/.test(t) || t.startsWith('전북 ')) {
    return t.replace(/^전북\s?/, '전라북도 ')
  }
  return null
}

/**
 * Open-Meteo 검색 후보 (앞쪽이 우선). 군·면·리·지번 제거 순으로 잘게 쪼갬.
 */
function buildOpenMeteoQueriesOrdered(placeName, placeAddress) {
  const name = (placeName ?? '').trim()
  const addr = (placeAddress ?? '').trim()
  const full = [name, addr].filter(Boolean).join(' ').trim()
  const out = []
  const push = (q) => {
    if (!q) return
    if (!out.includes(q)) out.push(q)
  }

  const addrNe = expandJeonbuk(addr)
  const stripped = stripLot(addr)
  const strippedNe = addrNe ? stripLot(addrNe) : null

  // 군+면 (가장 안정적으로 잡히는 경우 많음)
  const m = addr.match(/(.+?(?:군|시))\s+(.+면)/)
  if (m) push(`${m[1].trim()} ${m[2].trim()}`)
  const m2 = addr.match(/(.+군)/)
  if (m2) push(m2[1].trim())
  if (addrNe) {
    const m3 = addrNe.match(/(.+?(?:군|시))\s+(.+면)/)
    if (m3) push(`${m3[1].trim()} ${m3[2].trim()}`)
    const m4 = addrNe.match(/(.+군)/)
    if (m4) push(m4[1].trim())
  }
  if (stripped !== addr && stripped) {
    const sm = stripped.match(/(.+?(?:군|시))\s+(.+면)/)
    if (sm) push(`${sm[1].trim()} ${sm[2].trim()}`)
  }
  if (strippedNe && strippedNe !== addrNe) {
    const s3 = strippedNe.match(/(.+?(?:군|시))\s+(.+면)/)
    if (s3) push(`${s3[1].trim()} ${s3[2].trim()}`)
  }
  // 면+리 (지번 제거 뒤)
  const forRi = strippedNe || stripped
  if (forRi) {
    const mRi = forRi.match(/(.+면)\s+(.+리)/)
    if (mRi) push(`${mRi[1].trim()} ${mRi[2].trim()}`)
  }
  if (addrNe && /진안/.test(addr)) {
    push('전라북도 진안군')
    push('진안군')
  }
  if (full) push(full)
  if (name) push(name)
  if (stripped) push(stripped)
  if (addr) push(addr)
  if (strippedNe) push(strippedNe)
  return out
}

/**
 * @returns {Promise<null | { lat: number, lon: number, source?: string }>}
 */
export async function geocodePlaceToLatLon(placeName, placeAddress) {
  if (!placeName?.trim() && !placeAddress?.trim()) return null

  const ckey = cacheKey(placeName, placeAddress)
  const hit = getCachedGeo(ckey)
  if (hit) return hit

  const oQueries = buildOpenMeteoQueriesOrdered(placeName, placeAddress)
  for (const q of oQueries) {
    const g = await geocodeOpenMeteoName(q)
    if (g) {
      setCachedGeo(ckey, g)
      return g
    }
  }

  return null
}
