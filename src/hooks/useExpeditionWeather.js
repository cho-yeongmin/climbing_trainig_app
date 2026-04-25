import { useState, useEffect, useCallback, useRef } from 'react'
import { getTodayKST, addDaysYmd } from '../utils/date'
import { geocodePlaceToLatLon } from '../utils/geocoding'

/** WMO code → 짧은 한국어 (Open-Meteo daily weathercode) */
function weathercodeLabel(code) {
  if (code == null) return '—'
  const c = Number(code)
  if (c === 0) return '맑음'
  if (c <= 3) return '구름'
  if (c <= 48) return '흐림/안개'
  if (c <= 67) return '비'
  if (c <= 77) return '눈'
  if (c <= 82) return '소나기'
  if (c <= 86) return '눈'
  if (c <= 99) return '뇌우'
  return '—'
}

function weathercodeIcon(code) {
  if (code == null) return '🌡️'
  const c = Number(code)
  if (c === 0) return '☀️'
  if (c <= 3) return '⛅'
  if (c <= 48) return '🌫️'
  if (c <= 67) return '🌧️'
  if (c <= 77) return '❄️'
  if (c <= 86) return '🌨️'
  if (c <= 99) return '⛈️'
  return '🌡️'
}

const FORECAST_CACHE_TTL_MS = 15 * 60 * 1000
const forecastCache = new Map()

function forecastCacheKey(lat, lon, start, end) {
  return `${Number(lat).toFixed(4)}|${Number(lon).toFixed(4)}|${start}|${end}`
}

function getCachedForecast(key) {
  const e = forecastCache.get(key)
  if (!e) return null
  if (Date.now() - e.t > FORECAST_CACHE_TTL_MS) {
    forecastCache.delete(key)
    return null
  }
  return e.data
}

function setCachedForecast(key, data) {
  forecastCache.set(key, { data, t: Date.now() })
}

/**
 * 일별 예보 Open-Meteo (200이어도 body에 error:true 인 경우 있음)
 * @see https://open-meteo.com/en/docs
 */
async function fetchOpenMeteoDailyForecast(lat, lon, startDate, endDate) {
  const buildUrl = (dailyVars) => {
    const u = new URL('https://api.open-meteo.com/v1/forecast')
    u.searchParams.set('latitude', String(lat))
    u.searchParams.set('longitude', String(lon))
    u.searchParams.set('timezone', 'Asia/Seoul')
    u.searchParams.set('start_date', startDate)
    u.searchParams.set('end_date', endDate)
    u.searchParams.set('daily', dailyVars)
    return u.toString()
  }

  const tryFetch = async (dailyVars) => {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 20000)
    try {
      const res = await fetch(buildUrl(dailyVars), { signal: controller.signal })
      const j = await res.json()
      if (j?.error) return null
      if (!res.ok) return null
      return j
    } catch {
      return null
    } finally {
      clearTimeout(t)
    }
  }

  const full = 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max'
  const minimal = 'weathercode,temperature_2m_max,temperature_2m_min'
  let data = await tryFetch(full)
  if (!data) data = await tryFetch(minimal)
  if (!data) throw new Error('forecast')
  return data
}

/**
 * @param {null | { date: string, placeName?: string, placeAddress?: string }} nextExpedition
 */
export function useExpeditionWeather(nextExpedition) {
  const [state, setState] = useState({
    loading: true,
    error: null,
    days: [],
  })
  const seq = useRef(0)

  const run = useCallback(async () => {
    if (!nextExpedition?.date) {
      setState({ loading: false, error: null, days: [] })
      return
    }
    const expeditionYmd = nextExpedition.date
    const today = getTodayKST()
    const dMinus3 = addDaysYmd(expeditionYmd, -3)
    const start = dMinus3 > today ? dMinus3 : today
    const end = expeditionYmd
    if (start > end) {
      setState({ loading: false, error: null, days: [] })
      return
    }

    const placeName = nextExpedition.placeName ?? ''
    const placeAddress = nextExpedition.placeAddress ?? ''
    if (!placeName && !placeAddress) {
      setState({ loading: false, error: 'no_address', days: [] })
      return
    }

    const id = ++seq.current
    setState((s) => ({ ...s, loading: true, error: null, days: [] }))

    try {
      const pos = await geocodePlaceToLatLon(placeName, placeAddress)
      if (id !== seq.current) return
      if (!pos || pos.lat == null || pos.lon == null) {
        setState({ loading: false, error: 'geocode', days: [] })
        return
      }
      const lat = pos.lat
      const lon = pos.lon
      const fcKey = forecastCacheKey(lat, lon, start, end)
      let data = getCachedForecast(fcKey)
      if (!data) {
        data = await fetchOpenMeteoDailyForecast(lat, lon, start, end)
        if (data) setCachedForecast(fcKey, data)
      }
      if (id !== seq.current) return
      const times = data?.daily?.time ?? []
      const codes = data?.daily?.weathercode ?? []
      const tmax = data?.daily?.temperature_2m_max ?? []
      const tmin = data?.daily?.temperature_2m_min ?? []
      const pprob = data?.daily?.precipitation_probability_max ?? []
      const days = times.map((t, i) => ({
        date: t,
        code: codes[i],
        label: weathercodeLabel(codes[i]),
        icon: weathercodeIcon(codes[i]),
        tmax: tmax[i] != null ? Math.round(tmax[i]) : null,
        tmin: tmin[i] != null ? Math.round(tmin[i]) : null,
        precipProb: pprob[i] != null ? Math.round(pprob[i]) : null,
      }))
      setState({ loading: false, error: null, days })
    } catch (e) {
      if (id !== seq.current) return
      setState({ loading: false, error: 'fetch', days: [] })
    }
  }, [nextExpedition])

  useEffect(() => {
    run()
  }, [run])

  return { ...state, refetch: run }
}

export function formatShortWeekday(ymd) {
  if (!ymd) return ''
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y) return ymd
  const w = new Date(y, m - 1, d).getDay()
  const k = ['일', '월', '화', '수', '목', '금', '토']
  return k[w] ?? ''
}
