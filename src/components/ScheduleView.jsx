import { useState, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSchedules } from '../hooks/useSupabase'
import AddScheduleView from './AddScheduleView'
import './ScheduleView.css'

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일']

/** 1 = Mon, 7 = Sun (한국 요일 순) */
function getWeekdayIndex(date) {
  const d = date.getDay()
  return d === 0 ? 6 : d - 1
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

function buildCalendarGrid(year, month) {
  const first = new Date(year, month - 1, 1)
  const lastDay = getDaysInMonth(year, month)
  const startOffset = getWeekdayIndex(first)
  const totalCells = 42
  const grid = []
  let day = 1
  for (let i = 0; i < totalCells; i++) {
    if (i < startOffset || day > lastDay) {
      grid.push(null)
    } else {
      grid.push(day++)
    }
  }
  return grid
}

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const MIN_YEAR = 2024
const MAX_YEAR = 2030

export default function ScheduleView() {
  const { isAdmin } = useAuth()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [showPicker, setShowPicker] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [showAddSchedule, setShowAddSchedule] = useState(false)

  const grid = useMemo(() => buildCalendarGrid(year, month), [year, month])
  const { data: scheduleMap, refetch: refetchSchedules } = useSchedules(year, month)

  const getCellSchedule = (dateNum) => {
    if (!dateNum) return null
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dateNum).padStart(2, '0')}`
    return scheduleMap[dateStr]
  }

  const isSelected = (dateNum) =>
    selectedDate &&
    selectedDate.year === year &&
    selectedDate.month === month &&
    selectedDate.day === dateNum

  const handleYearMonthChange = (setter, value) => {
    setter(value)
    setSelectedDate(null)
  }

  return (
    <div className="schedule-view">
      <div className="schedule-view__calendar-wrap">
        <div className="schedule-view__header">
          <button
            type="button"
            className="schedule-view__ym"
            onClick={() => setShowPicker((v) => !v)}
            aria-expanded={showPicker}
            aria-haspopup="listbox"
            aria-label="연도 월 선택"
          >
            <span className="schedule-view__ym-text">{year}. {month}</span>
            <span className="schedule-view__ym-chevron" aria-hidden>∨</span>
          </button>
          {showPicker && (
            <div className="schedule-view__picker" role="listbox">
              <div className="schedule-view__picker-row">
                <label className="schedule-view__picker-label">연도</label>
                <select
                  className="schedule-view__select"
                value={year}
                onChange={(e) => handleYearMonthChange(setYear, Number(e.target.value))}
                  aria-label="연도 선택"
                >
                  {Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, i) => MIN_YEAR + i).map((y) => (
                    <option key={y} value={y}>{y}년</option>
                  ))}
                </select>
              </div>
              <div className="schedule-view__picker-row">
                <label className="schedule-view__picker-label">월</label>
                <select
                  className="schedule-view__select"
                value={month}
                onChange={(e) => handleYearMonthChange(setMonth, Number(e.target.value))}
                  aria-label="월 선택"
                >
                  {MONTHS.map((m) => (
                    <option key={m} value={m}>{m}월</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="schedule-view__picker-close"
                onClick={() => setShowPicker(false)}
              >
                닫기
              </button>
            </div>
          )}
        </div>

        <div className="schedule-view__body">
        <div className="schedule-view__weekdays">
          {WEEKDAYS.map((w) => (
            <span key={w} className="schedule-view__weekday">{w}</span>
          ))}
        </div>

        <div className="schedule-view__grid">
          {grid.map((dateNum, i) => {
            const schedule = getCellSchedule(dateNum)
            const selected = dateNum != null && isSelected(dateNum)
            const clickable = isAdmin && dateNum != null
            const imageUrl = schedule?.place?.image_url ?? schedule?.exerciseType?.image_url
            const cellClass = [
              'schedule-view__cell',
              dateNum == null ? 'schedule-view__cell--empty' : '',
              clickable ? 'schedule-view__cell--clickable' : '',
              selected ? 'schedule-view__cell--selected' : '',
            ].filter(Boolean).join(' ')

            const content = (
              <>
                {dateNum != null && (
                  <span className="schedule-view__cell-square" aria-hidden>
                    {imageUrl ? (
                      <img src={imageUrl} alt="" className="schedule-view__cell-img" />
                    ) : null}
                  </span>
                )}
                {dateNum != null ? (
                  <span className="schedule-view__cell-num">{dateNum}</span>
                ) : (
                  <span className="schedule-view__cell-num schedule-view__cell-num--empty" />
                )}
              </>
            )

            if (clickable) {
              return (
                <button
                  key={i}
                  type="button"
                  className={cellClass}
                  onClick={() => setSelectedDate({ year, month, day: dateNum })}
                  aria-pressed={selected}
                  aria-label={`${year}년 ${month}월 ${dateNum}일 선택`}
                >
                  {content}
                </button>
              )
            }
            return (
              <div key={i} className={cellClass}>
                {content}
              </div>
            )
          })}
        </div>
        </div>
      </div>

      {isAdmin && (
        <button
          type="button"
          className="schedule-view__add-btn"
          onClick={() => selectedDate && setShowAddSchedule(true)}
          disabled={!selectedDate}
          aria-label="일정 추가하기"
          aria-disabled={!selectedDate}
          data-selected={selectedDate ? `${selectedDate.year}-${selectedDate.month}-${selectedDate.day}` : ''}
        >
          <span className="schedule-view__add-btn-icon">+</span>
          일정추가하기
        </button>
      )}

      {isAdmin && showAddSchedule && (
        <AddScheduleView
          selectedDate={selectedDate}
          onClose={() => setShowAddSchedule(false)}
          onSuccess={() => refetchSchedules()}
        />
      )}
    </div>
  )
}
