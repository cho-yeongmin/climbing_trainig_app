import { useExpeditionWeather, formatShortWeekday } from '../hooks/useExpeditionWeather'
import './ExpeditionWeather.css'

/**
 * D-day 카드: Open-Meteo 지오코딩 + 일별 예보 (프론트는 OSM Nominatim 미사용: CORS/429)
 */
export default function ExpeditionWeather({ nextExpedition }) {
  const { loading, error, days } = useExpeditionWeather(nextExpedition)

  if (loading) {
    return (
      <div className="expedition-weather" aria-busy>
        <p className="expedition-weather__title">원정지 날씨</p>
        <div className="expedition-weather__skeleton">
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    )
  }

  if (error === 'no_address') {
    return null
  }
  if (error === 'geocode') {
    return (
      <div className="expedition-weather expedition-weather--muted">
        <p className="expedition-weather__title">원정지 날씨</p>
        <p className="expedition-weather__hint">주소로 위치를 찾지 못했습니다. 시·군·구·도로명이 보이게 수정해 보세요.</p>
      </div>
    )
  }
  if (!error && (!days || days.length === 0)) {
    return null
  }
  if (error === 'fetch') {
    return (
      <div className="expedition-weather expedition-weather--muted">
        <p className="expedition-weather__title">원정지 날씨</p>
        <p className="expedition-weather__hint">날씨를 불러오지 못했습니다. 잠시 뒤 다시 열어 보세요.</p>
      </div>
    )
  }

  return (
    <div className="expedition-weather">
      <p className="expedition-weather__title">원정지 날씨 (D-3 ~ 당일)</p>
      <div className="expedition-weather__scroll" role="list">
        {days.map((day) => {
          const md = day.date?.slice(5)?.replace('-', '/')
          const w = formatShortWeekday(day.date)
          return (
            <div key={day.date} className="expedition-weather__day" role="listitem">
              <div className="expedition-weather__day-top">
                <span className="expedition-weather__md">{md}</span>
                <span className="expedition-weather__w">({w})</span>
              </div>
              <span className="expedition-weather__icon" aria-hidden>
                {day.icon}
              </span>
              <div className="expedition-weather__label">{day.label}</div>
              {day.tmax != null && day.tmin != null && (
                <div className="expedition-weather__temp">
                  {day.tmin}° / {day.tmax}°
                </div>
              )}
              {day.precipProb != null && day.precipProb > 0 && (
                <div className="expedition-weather__rain">강수 {day.precipProb}%</div>
              )}
            </div>
          )
        })}
      </div>
      <p className="expedition-weather__credit">위치·예보: Open-Meteo</p>
    </div>
  )
}
