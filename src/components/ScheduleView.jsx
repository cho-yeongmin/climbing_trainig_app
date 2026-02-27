import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSchedules, useSharableTeams } from '../hooks/useSupabase'
import AddScheduleView from './AddScheduleView'
import ShareRequestView from './ShareRequestView'
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

const MIN_YEAR = 2024
const MAX_YEAR = 2030
const SWIPE_THRESHOLD = 50

export default function ScheduleView({ hasShareBadge = false, sharedCount, onShareModalOpen } = {}) {
  const { isAdmin, isSupervisor, teamId } = useAuth()
  const { data: sharableTeams } = useSharableTeams()
  const [selectedTeamId, setSelectedTeamId] = useState(null)
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false)
  const teamDropdownRef = useRef(null)

  useEffect(() => {
    if (!selectedTeamId && sharableTeams?.length) {
      setSelectedTeamId(sharableTeams[0].id)
    }
  }, [sharableTeams, selectedTeamId])

  const displayTeamId = selectedTeamId ?? teamId ?? sharableTeams?.[0]?.id

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [selectedDate, setSelectedDate] = useState(null)
  const [showAddSchedule, setShowAddSchedule] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const swipeStartX = useRef(0)

  const canManageShare = isAdmin || isSupervisor

  const grid = useMemo(() => buildCalendarGrid(year, month), [year, month])
  const { data: scheduleMap, refetch: refetchSchedules } = useSchedules(year, month, displayTeamId)

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

  useEffect(() => {
    const fn = (e) => {
      if (teamDropdownRef.current && !teamDropdownRef.current.contains(e.target)) {
        setTeamDropdownOpen(false)
      }
    }
    if (teamDropdownOpen) {
      document.addEventListener('mousedown', fn)
      document.addEventListener('touchstart', fn)
      return () => {
        document.removeEventListener('mousedown', fn)
        document.removeEventListener('touchstart', fn)
      }
    }
  }, [teamDropdownOpen])

  const goPrevMonth = useCallback(() => {
    if (month === 1) {
      setYear((y) => Math.max(MIN_YEAR, y - 1))
      setMonth(12)
    } else {
      setMonth((m) => m - 1)
    }
    setSelectedDate(null)
  }, [month])

  const goNextMonth = useCallback(() => {
    if (month === 12) {
      setYear((y) => Math.min(MAX_YEAR, y + 1))
      setMonth(1)
    } else {
      setMonth((m) => m + 1)
    }
    setSelectedDate(null)
  }, [month])

  const handleSwipeStart = (e) => {
    swipeStartX.current = e.touches ? e.touches[0].clientX : e.clientX
  }
  const handleSwipeEnd = (e) => {
    const endX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX
    const diff = swipeStartX.current - endX
    if (Math.abs(diff) >= SWIPE_THRESHOLD) {
      e.stopPropagation() // 탭 스와이프와 충돌 방지
      if (diff > 0) goNextMonth()
      else goPrevMonth()
    }
  }

  const selectedSchedule = useMemo(() => {
    if (!selectedDate) return null
    const dateStr = `${selectedDate.year}-${String(selectedDate.month).padStart(2, '0')}-${String(selectedDate.day).padStart(2, '0')}`
    return scheduleMap[dateStr] ?? null
  }, [selectedDate, scheduleMap])

  const canEditSelectedTeam = isAdmin && displayTeamId === teamId

  return (
    <div className="schedule-view">
      <div className="schedule-view__top-row">
        {sharableTeams?.length > 1 && (
        <div className="schedule-view__team-select" ref={teamDropdownRef}>
          <span className="schedule-view__team-label">팀</span>
          <div className="schedule-view__team-dropdown-wrap">
            <button
              type="button"
              className="schedule-view__team-combo-btn"
              onClick={() => setTeamDropdownOpen((v) => !v)}
              aria-label="조회할 팀 선택"
              aria-expanded={teamDropdownOpen}
              aria-haspopup="listbox"
            >
              {sharableTeams.find((t) => t.id === displayTeamId)?.name ?? '팀 선택'}
              <span className="schedule-view__team-combo-arrow">{teamDropdownOpen ? '▲' : '▼'}</span>
            </button>
            {teamDropdownOpen && (
              <ul className="schedule-view__team-dropdown-list" role="listbox" aria-label="조회할 팀 목록">
                {sharableTeams.map((t) => (
                  <li key={t.id} role="option">
                    <button
                      type="button"
                      className={`schedule-view__team-dropdown-item ${displayTeamId === t.id ? 'schedule-view__team-dropdown-item--selected' : ''}`}
                      onClick={() => {
                        setSelectedTeamId(t.id)
                        setTeamDropdownOpen(false)
                      }}
                    >
                      {t.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        )}
        {canManageShare && (
          <button
            type="button"
            className="schedule-view__share-btn"
            onClick={() => {
              setShowShareModal(true)
              onShareModalOpen?.()
            }}
            aria-label="일정공유 설정"
          >
            일정공유
            {hasShareBadge && <span className="schedule-view__share-badge" aria-hidden />}
          </button>
        )}
      </div>
      <div
        className="schedule-view__calendar-wrap"
        onTouchStart={handleSwipeStart}
        onTouchEnd={handleSwipeEnd}
        onMouseDown={(e) => { swipeStartX.current = e.clientX }}
        onMouseUp={(e) => {
          const diff = swipeStartX.current - e.clientX
          if (Math.abs(diff) >= SWIPE_THRESHOLD) {
            e.stopPropagation()
            if (diff > 0) goNextMonth()
            else goPrevMonth()
          }
        }}
      >
        <div className="schedule-view__header schedule-view__ym-row">
          <button type="button" className="schedule-view__ym-nav" onClick={goPrevMonth} aria-label="이전 달">
            ‹
          </button>
          <span className="schedule-view__ym-text">{year}. {month}</span>
          <button type="button" className="schedule-view__ym-nav" onClick={goNextMonth} aria-label="다음 달">
            ›
          </button>
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
            const clickable = dateNum != null
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
                      <img src={imageUrl} alt="" className="schedule-view__cell-img" loading="lazy" />
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

      <div className="schedule-view__date-info">
        {selectedDate ? (
          selectedSchedule ? (
            <div className="schedule-view__info-card">
              <div className="schedule-view__info-icon" aria-hidden>
                {selectedSchedule.place?.image_url || selectedSchedule.exerciseType?.image_url ? (
                  <img
                    src={selectedSchedule.place?.image_url || selectedSchedule.exerciseType?.image_url}
                    alt=""
                  />
                ) : (
                  <span />
                )}
              </div>
              <div className="schedule-view__info-body">
                <div className="schedule-view__info-title">
                  {selectedSchedule.place?.name || selectedSchedule.exerciseType?.name || '일정'}
                </div>
                {(selectedSchedule.place?.address) && (
                  <div className="schedule-view__info-address">{selectedSchedule.place.address}</div>
                )}
              </div>
            </div>
          ) : (
            <div className="schedule-view__info-empty">일정이 없습니다.</div>
          )
        ) : (
          <div className="schedule-view__info-placeholder">날짜를 선택하세요</div>
        )}
      </div>

      {canEditSelectedTeam && (
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

      {canEditSelectedTeam && showAddSchedule && (
        <AddScheduleView
          selectedDate={selectedDate}
          teamId={displayTeamId}
          onClose={() => setShowAddSchedule(false)}
          onSuccess={() => refetchSchedules()}
        />
      )}

      {showShareModal && (
        <div className="schedule-view__share-modal" role="dialog" aria-modal="true" aria-labelledby="share-modal-title">
          <div className="schedule-view__share-backdrop" onClick={() => setShowShareModal(false)} aria-hidden />
          <div className="schedule-view__share-panel">
            <div className="schedule-view__share-header">
              <h2 id="share-modal-title" className="schedule-view__share-title">일정공유</h2>
              <button
                type="button"
                className="schedule-view__share-close"
                onClick={() => setShowShareModal(false)}
                aria-label="닫기"
              >
                ✕
              </button>
            </div>
            <ShareRequestView />
          </div>
        </div>
      )}
    </div>
  )
}
