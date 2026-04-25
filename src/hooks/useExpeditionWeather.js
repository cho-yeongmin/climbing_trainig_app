import { useState, useEffect, useCallback, useRef } from 'react'
import { getTodayKST, addDaysYmd } from '../utils/date'
import { supabase } from '../lib/supabase'

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

/**
 * D-day~D-3: place_weather_daily 조회. 캐시가 비어 있으면 refresh-place-weather Edge로 즉시 갱신.
 * @param {null | { date, placeId?, placeName?, placeAddress? }} nextExpedition
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

    if (!nextExpedition.placeId) {
      setState({ loading: false, error: 'no_place', days: [] })
      return
    }

    const id = ++seq.current
    setState((s) => ({ ...s, loading: true, error: null, days: [] }))

    const runSelect = () =>
      supabase
        .from('place_weather_daily')
        .select('forecast_date, weathercode, tmin, tmax, precip_prob, fetched_at')
        .eq('place_id', nextExpedition.placeId)
        .gte('forecast_date', start)
        .lte('forecast_date', end)
        .order('forecast_date', { ascending: true })

    const mapRows = (rows) =>
      (rows ?? []).map((r) => ({
        date: r.forecast_date,
        code: r.weathercode,
        label: weathercodeLabel(r.weathercode),
        icon: weathercodeIcon(r.weathercode),
        tmax: r.tmax,
        tmin: r.tmin,
        precipProb: r.precip_prob,
      }))

    try {
      const { data: rows, error: qe } = await runSelect()

      if (id !== seq.current) return
      if (qe) {
        setState({ loading: false, error: 'db', days: [] })
        return
      }

      let list = mapRows(rows)

      if (list.length === 0) {
        const { data: inv, error: invErr, response: fnRes } = await supabase.functions.invoke(
          'refresh-place-weather',
          { body: { place_id: nextExpedition.placeId } }
        )
        if (id !== seq.current) return
        if (invErr) {
          let reason
          if (fnRes) {
            try {
              const j = await fnRes.json()
              if (j && j.ok === false) reason = j.reason
            } catch {
              /* ignore */
            }
          }
          if (reason === 'geocode' || reason === 'forecast') {
            setState({ loading: false, error: 'no_weather', days: [] })
          } else {
            setState({ loading: false, error: 'refresh', days: [] })
          }
          return
        }
        if (inv && inv.ok === false) {
          setState({ loading: false, error: 'no_weather', days: [] })
          return
        }
        const { data: rows2, error: qe2 } = await runSelect()
        if (id !== seq.current) return
        if (qe2) {
          setState({ loading: false, error: 'db', days: [] })
          return
        }
        list = mapRows(rows2)
        if (list.length === 0) {
          setState({ loading: false, error: 'no_weather', days: [] })
          return
        }
      }
      setState({ loading: false, error: null, days: list })
    } catch (e) {
      if (id !== seq.current) return
      setState({ loading: false, error: 'db', days: [] })
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
