import { useExpeditionWeather, formatShortWeekday } from '../hooks/useExpeditionWeather'
import './ExpeditionWeather.css'

/**
 * D-day 카드: place_weather_daily (새벽 배치 + 캐시 없을 때 refresh-place-weather로 즉시 갱신)
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

  if (error === 'no_place') {
    return null
  }
  if (error === 'db') {
    return (
      <div className="expedition-weather expedition-weather--muted">
        <p className="expedition-weather__title">원정지 날씨</p>
        <p className="expedition-weather__hint">날씨 정보를 불러오지 못했습니다.</p>
      </div>
    )
  }
  if (error === 'no_weather') {
    return (
      <div className="expedition-weather expedition-weather--muted">
        <p className="expedition-weather__title">원정지 날씨</p>
        <p className="expedition-weather__hint">
          이 주소의 날씨를 찾지 못했습니다. 장소 주소를 확인하거나 잠시 후 다시 열어 보세요.
        </p>
      </div>
    )
  }
  if (error === 'refresh') {
    return (
      <div className="expedition-weather expedition-weather--muted">
        <p className="expedition-weather__title">원정지 날씨</p>
        <p className="expedition-weather__hint">날씨를 갱신하지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
      </div>
    )
  }
  if (!days || days.length === 0) {
    return null
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
      <p className="expedition-weather__credit">데이터: Open-Meteo · 저장: 새벽 일괄 + 최초 열람 시</p>
    </div>
  )
}
