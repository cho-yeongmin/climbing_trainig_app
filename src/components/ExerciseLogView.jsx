import { useAuth } from '../contexts/AuthContext'
import { useTrainingLogChartData } from '../hooks/useSupabase'
import './ExerciseLogView.css'

const LOG_ITEMS = [
  { id: 'finger', title: '손가락훈련', dayTypeId: 'finger' },
  { id: 'power', title: '파워볼더링', dayTypeId: 'power_bouldering' },
  { id: 'endurance', title: '근지구력', dayTypeId: 'endurance' },
]

function formatDateLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${m}월 ${day}일`
}

function LineChartCard({ id, title, data, loading }) {
  const padding = { top: 12, right: 12, bottom: 28, left: 44 }
  const width = 280
  const height = 140
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  const hasData = Array.isArray(data) && data.length > 0

  if (loading) {
    return (
      <article className="log-card">
        <h3 className="log-card__title">{title}</h3>
        <div className="log-card__chart-wrap log-card__chart-wrap--empty">
          <p className="log-card__empty">로딩 중...</p>
        </div>
      </article>
    )
  }

  if (!hasData) {
    return (
      <article className="log-card">
        <h3 className="log-card__title">{title}</h3>
        <div className="log-card__chart-wrap log-card__chart-wrap--empty">
          <p className="log-card__empty">현재 기록된 내용이 없습니다.</p>
        </div>
      </article>
    )
  }

  const values = data.map((d) => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const xStep = data.length > 1 ? chartWidth / (data.length - 1) : chartWidth
  const points = data.map((y, i) => {
    const x = padding.left + (data.length > 1 ? i * xStep : chartWidth / 2)
    const ny = padding.top + chartHeight - ((y.value - min) / range) * chartHeight
    return [x, ny]
  })
  const pathLine = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ')
  const pathFill = `${pathLine} L ${points[points.length - 1][0]} ${padding.top + chartHeight} L ${points[0][0]} ${padding.top + chartHeight} Z`
  const gradientId = `chartFill-${id}`

  const xLabels = data.map((d) => formatDateLabel(d.date))

  return (
    <article className="log-card">
      <h3 className="log-card__title">{title}</h3>
      <div className="log-card__chart-wrap">
        <svg
          className="log-card__chart"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4285f4" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#4285f4" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={pathFill} fill={`url(#${gradientId})`} />
          <path d={pathLine} fill="none" stroke="#4285f4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((p, i) => (
            <circle key={i} cx={p[0]} cy={p[1]} r="4" fill="#4285f4" />
          ))}
        </svg>
        <div className="log-card__x-labels" aria-hidden>
          {xLabels.map((label) => (
            <span key={label} className="log-card__x-label">
              {label}
            </span>
          ))}
        </div>
      </div>
    </article>
  )
}

export default function ExerciseLogView() {
  const { user } = useAuth()
  const { data: chartData, loading } = useTrainingLogChartData()

  return (
    <div className="exercise-log-view">
      <div className="exercise-log-view__list">
        {LOG_ITEMS.map((item) => (
          <LineChartCard
            key={item.id}
            id={item.id}
            title={item.title}
            data={user ? chartData[item.dayTypeId] : []}
            loading={loading}
          />
        ))}
      </div>
    </div>
  )
}
