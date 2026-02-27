import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  useSchedules,
  useSharableTeams,
  useSchedulesMultiTeam,
  useMyScheduleSelections,
  useMyPersonalSchedules,
  addToMySchedule,
  removeFromMySchedule,
  deletePersonalSchedule,
} from '../hooks/useSupabase'
import { useTeamMembers } from '../hooks/useProfile'
import AddScheduleView from './AddScheduleView'
import AddPersonalScheduleView from './AddPersonalScheduleView'
import ShareRequestView from './ShareRequestView'
import './ScheduleView.css'

const MY_SCHEDULE_ID = 'my'
const TEAM_DOT_COLORS = ['#ea4335', '#4285f4', '#34a853', '#fbbc04', '#9c27b0', '#00acc1', '#ff7043']

/** 장소 썸네일 우선, 없으면 훈련 썸네일. 순서대로 first place, first training */
function getThumbnailForItems(items) {
  if (!items?.length) return null
  const firstPlace = items.find((i) => i?.place?.image_url || i?.schedule?.place?.image_url)
  if (firstPlace) return (firstPlace.place || firstPlace.schedule?.place)?.image_url
  const firstEx = items.find((i) => i?.exerciseType?.image_url || i?.schedule?.exerciseType?.image_url)
  if (firstEx) return (firstEx.exerciseType || firstEx.schedule?.exerciseType)?.image_url
  return null
}

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
  const { user, isAdmin, isSupervisor, teamId } = useAuth()
  const { data: sharableTeams } = useSharableTeams()
  const [selectedTeamId, setSelectedTeamId] = useState(MY_SCHEDULE_ID)
  const [viewingUserId, setViewingUserId] = useState(null) // null = 내 일정(본인)
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false)
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false)
  const teamDropdownRef = useRef(null)
  const memberDropdownRef = useRef(null)

  const { data: teamMembers } = useTeamMembers(teamId)
  const isMyScheduleMode = selectedTeamId === MY_SCHEDULE_ID
  const displayTeamId = isMyScheduleMode ? null : (selectedTeamId ?? teamId ?? sharableTeams?.[0]?.id)
  const scheduleOwnerId = viewingUserId ?? user?.id
  const isViewingSelf = scheduleOwnerId === user?.id

  useEffect(() => {
    if (selectedTeamId === null && sharableTeams?.length) {
      setSelectedTeamId(MY_SCHEDULE_ID)
    }
  }, [sharableTeams, selectedTeamId])

  useEffect(() => {
    if (isMyScheduleMode && user?.id && (viewingUserId === null || viewingUserId === undefined)) {
      setViewingUserId(user.id)
    }
  }, [isMyScheduleMode, user?.id, viewingUserId])

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
  const teamIds = useMemo(() => (sharableTeams ?? []).map((t) => t.id), [sharableTeams])
  const { data: multiScheduleMap, refetch: refetchMulti } = useSchedulesMultiTeam(year, month, isMyScheduleMode ? teamIds : [])
  const { selectedIds: mySelectedIds, refetch: refetchMySelections } = useMyScheduleSelections(scheduleOwnerId)
  const { data: personalMap, refetch: refetchPersonal } = useMyPersonalSchedules(scheduleOwnerId, year, month)

  const getCellSchedules = (dateNum) => {
    if (!dateNum) return []
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dateNum).padStart(2, '0')}`
    const arr = scheduleMap?.[dateStr]
    return Array.isArray(arr) ? arr : (arr ? [arr] : [])
  }

  const getCellMyItems = (dateNum) => {
    if (!dateNum || !isMyScheduleMode) return { team: [], personal: [] }
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dateNum).padStart(2, '0')}`
    const teamSchedules = (multiScheduleMap?.[dateStr] ?? []).filter(({ id }) => mySelectedIds?.has?.(id) ?? false)
    const personal = personalMap?.[dateStr] ?? []
    return {
      team: teamSchedules.map(({ id, schedule, teamId }) => ({ id, schedule, teamId })),
      personal,
    }
  }

  const getCellSchedulesForMyMode = (dateNum) => {
    if (!dateNum) return []
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dateNum).padStart(2, '0')}`
    return multiScheduleMap?.[dateStr] ?? []
  }

  const teamColorByIndex = useMemo(() => {
    const m = {}
    ;(sharableTeams ?? []).forEach((t, i) => { m[t.id] = TEAM_DOT_COLORS[i % TEAM_DOT_COLORS.length] })
    return m
  }, [sharableTeams])

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
      if (memberDropdownRef.current && !memberDropdownRef.current.contains(e.target)) {
        setMemberDropdownOpen(false)
      }
    }
    if (teamDropdownOpen || memberDropdownOpen) {
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
    const arr = scheduleMap?.[dateStr]
    const list = Array.isArray(arr) ? arr : (arr ? [arr] : [])
    return list[0] ?? null
  }, [selectedDate, scheduleMap])

  const selectedDayMyItems = useMemo(() => {
    if (!selectedDate || !isMyScheduleMode) return { team: [], personal: [] }
    const dateStr = `${selectedDate.year}-${String(selectedDate.month).padStart(2, '0')}-${String(selectedDate.day).padStart(2, '0')}`
    const teamSchedules = (multiScheduleMap?.[dateStr] ?? []).filter(({ id }) => mySelectedIds?.has?.(id) ?? false)
    const personal = personalMap?.[dateStr] ?? []
    return {
      team: teamSchedules.map(({ id, schedule, teamId }) => ({
        id,
        schedule,
        teamId,
        teamName: sharableTeams?.find((t) => t.id === teamId)?.name ?? '',
      })),
      personal,
    }
  }, [selectedDate, isMyScheduleMode, multiScheduleMap, personalMap, mySelectedIds, sharableTeams])

  const selectedDayAllTeamSchedules = useMemo(() => {
    if (!selectedDate || !isMyScheduleMode) return []
    const dateStr = `${selectedDate.year}-${String(selectedDate.month).padStart(2, '0')}-${String(selectedDate.day).padStart(2, '0')}`
    return (multiScheduleMap?.[dateStr] ?? []).map(({ id, schedule, teamId }) => ({
      id,
      schedule,
      teamId,
      teamName: sharableTeams?.find((t) => t.id === teamId)?.name ?? '',
      inMySchedule: mySelectedIds.has(id),
    }))
  }, [selectedDate, isMyScheduleMode, multiScheduleMap, mySelectedIds, sharableTeams])

  const [showDayModal, setShowDayModal] = useState(false)
  const [showAddPersonal, setShowAddPersonal] = useState(false)
  const [dayModalCheckedIds, setDayModalCheckedIds] = useState(new Set())

  useEffect(() => {
    if (selectedDate && isMyScheduleMode) setShowDayModal(true)
    else setShowDayModal(false)
  }, [selectedDate, isMyScheduleMode])

  // 모달 열릴 때 선택 상태 초기화
  useEffect(() => {
    if (showDayModal && selectedDate && isViewingSelf) {
      const dateStr = `${selectedDate.year}-${String(selectedDate.month).padStart(2, '0')}-${String(selectedDate.day).padStart(2, '0')}`
      const dayScheduleIds = (multiScheduleMap?.[dateStr] ?? []).map((s) => s.id)
      setDayModalCheckedIds(
        new Set(dayScheduleIds.filter((id) => mySelectedIds.has(id)))
      )
    }
  }, [showDayModal, selectedDate, isViewingSelf, multiScheduleMap, mySelectedIds])

  const handleDayModalCheckboxChange = useCallback((scheduleId, checked) => {
    setDayModalCheckedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(scheduleId)
      else next.delete(scheduleId)
      return next
    })
  }, [])

  const handleApplySelectedSchedules = useCallback(async () => {
    if (!user?.id || !selectedDate) return
    const dateStr = `${selectedDate.year}-${String(selectedDate.month).padStart(2, '0')}-${String(selectedDate.day).padStart(2, '0')}`
    const dayScheduleIds = (multiScheduleMap?.[dateStr] ?? []).map((s) => s.id)
    try {
      for (const id of dayScheduleIds) {
        const shouldBeIn = dayModalCheckedIds.has(id)
        const isIn = mySelectedIds.has(id)
        if (shouldBeIn && !isIn) await addToMySchedule(user.id, id)
        if (!shouldBeIn && isIn) await removeFromMySchedule(user.id, id)
      }
      refetchMySelections()
    } catch (e) {
      console.error('선택한 일정 추가 실패', e)
    }
  }, [user?.id, selectedDate, multiScheduleMap, dayModalCheckedIds, mySelectedIds, refetchMySelections])

  const handleDeletePersonal = useCallback(async (id) => {
    try {
      await deletePersonalSchedule(id)
      refetchPersonal()
    } catch (e) {
      console.error('개인 일정 삭제 실패', e)
    }
  }, [refetchPersonal])

  const canEditSelectedTeam = isAdmin && displayTeamId === teamId
  const selectedDateStr = selectedDate
    ? `${selectedDate.year}-${String(selectedDate.month).padStart(2, '0')}-${String(selectedDate.day).padStart(2, '0')}`
    : null

  return (
    <div className="schedule-view">
      <div className="schedule-view__top-row">
        <div className="schedule-view__team-select" ref={teamDropdownRef}>
          <span className="schedule-view__team-label">일정</span>
          <div className="schedule-view__team-dropdown-wrap">
            <button
              type="button"
              className="schedule-view__team-combo-btn"
              onClick={() => setTeamDropdownOpen((v) => !v)}
              aria-label="조회할 일정 선택"
              aria-expanded={teamDropdownOpen}
              aria-haspopup="listbox"
            >
              {isMyScheduleMode ? '내 일정' : (sharableTeams?.find((t) => t.id === displayTeamId)?.name ?? '팀 선택')}
              <span className="schedule-view__team-combo-arrow">{teamDropdownOpen ? '▲' : '▼'}</span>
            </button>
            {teamDropdownOpen && (
              <ul className="schedule-view__team-dropdown-list" role="listbox" aria-label="조회할 일정 목록">
                <li role="option">
                  <button
                    type="button"
                    className={`schedule-view__team-dropdown-item ${isMyScheduleMode ? 'schedule-view__team-dropdown-item--selected' : ''}`}
                    onClick={() => { setSelectedTeamId(MY_SCHEDULE_ID); setTeamDropdownOpen(false) }}
                  >
                    내 일정
                  </button>
                </li>
                {sharableTeams?.map((t) => (
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
                )) ?? null}
              </ul>
            )}
          </div>
        </div>
        {isMyScheduleMode && teamId && (teamMembers?.length ?? 0) > 1 && (
          <div className="schedule-view__team-select schedule-view__member-select" ref={memberDropdownRef}>
            <span className="schedule-view__team-label">보기</span>
            <div className="schedule-view__team-dropdown-wrap">
              <button
                type="button"
                className="schedule-view__team-combo-btn"
                onClick={() => setMemberDropdownOpen((v) => !v)}
                aria-label="일정 보기 대상 선택"
                aria-expanded={memberDropdownOpen}
              >
                {isViewingSelf ? '나' : (teamMembers?.find((m) => m.id === scheduleOwnerId)?.nickname || teamMembers?.find((m) => m.id === scheduleOwnerId)?.display_name || '팀원')}
                <span className="schedule-view__team-combo-arrow">{memberDropdownOpen ? '▲' : '▼'}</span>
              </button>
              {memberDropdownOpen && (
                <ul className="schedule-view__team-dropdown-list" role="listbox">
                  <li role="option">
                    <button
                      type="button"
                      className={`schedule-view__team-dropdown-item ${isViewingSelf ? 'schedule-view__team-dropdown-item--selected' : ''}`}
                      onClick={() => { setViewingUserId(user?.id); setMemberDropdownOpen(false) }}
                    >
                      나
                    </button>
                  </li>
                  {teamMembers
                    ?.filter((m) => m.id !== user?.id)
                    .map((m) => (
                      <li key={m.id} role="option">
                        <button
                          type="button"
                          className={`schedule-view__team-dropdown-item ${scheduleOwnerId === m.id ? 'schedule-view__team-dropdown-item--selected' : ''}`}
                          onClick={() => { setViewingUserId(m.id); setMemberDropdownOpen(false) }}
                        >
                          {m.nickname || m.display_name || '팀원'}
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
            const teamSchedules = !isMyScheduleMode ? getCellSchedules(dateNum) : []
            const myItems = isMyScheduleMode ? getCellMyItems(dateNum) : { team: [], personal: [] }
            const mySchedules = isMyScheduleMode ? getCellSchedulesForMyMode(dateNum) : []
            const myAllItems = [...(myItems.team || []).map((t) => t.schedule || t), ...(myItems.personal || [])]
            const imageUrl = isMyScheduleMode
              ? (myAllItems.length > 0 ? getThumbnailForItems(myAllItems) : null)
              : getThumbnailForItems(teamSchedules.map((s) => ({ place: s.place, exerciseType: s.exerciseType })))
            const selected = dateNum != null && isSelected(dateNum)
            const clickable = dateNum != null
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
                    {isMyScheduleMode ? (
                      <>
                        {myAllItems.length > 0 && imageUrl && (
                          <img src={imageUrl} alt="" className="schedule-view__cell-img" loading="lazy" />
                        )}
                        {mySchedules.length > 0 && (
                          <span className="schedule-view__cell-corners schedule-view__cell-corners--overlay">
                            {[...new Set(mySchedules.map((s) => s.teamId).filter(Boolean))].slice(0, 4).map((tid, idx) => (
                              <span
                                key={tid}
                                className={`schedule-view__cell-corner schedule-view__cell-corner--${['tl', 'tr', 'bl', 'br'][idx]}`}
                                style={{ '--team-color': teamColorByIndex[tid] ?? '#9e9e9e' }}
                                title={sharableTeams?.find((t) => t.id === tid)?.name}
                              />
                            ))}
                          </span>
                        )}
                      </>
                    ) : imageUrl ? (
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
        {isMyScheduleMode ? (
          selectedDate ? (
            selectedDayMyItems.team.length > 0 || selectedDayMyItems.personal.length > 0 ? (
              <div
                className="schedule-view__my-summary"
                role="button"
                tabIndex={0}
                onClick={() => setShowDayModal(true)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowDayModal(true) }}
              >
                <div className="schedule-view__my-summary-count">
                  {selectedDayMyItems.team.length + selectedDayMyItems.personal.length}개 일정
                </div>
                {isViewingSelf && <span className="schedule-view__my-summary-hint">클릭하여 편집</span>}
              </div>
            ) : (
              isViewingSelf ? (
                <div
                  className="schedule-view__info-empty schedule-view__info-empty--clickable"
                  role="button"
                  tabIndex={0}
                  onClick={() => setShowDayModal(true)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowDayModal(true) }}
                >
                  일정이 없습니다. 클릭하여 추가
                </div>
              ) : (
                <div
                  className="schedule-view__info-empty schedule-view__info-empty--clickable"
                  role="button"
                  tabIndex={0}
                  onClick={() => setShowDayModal(true)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowDayModal(true) }}
                >
                  일정이 없습니다.
                </div>
              )
            )
          ) : (
            <div className="schedule-view__info-placeholder">날짜를 선택하세요</div>
          )
        ) : selectedDate ? (
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

      {!isMyScheduleMode && canEditSelectedTeam && (
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

      {isMyScheduleMode && selectedDate && isViewingSelf && (
        <button
          type="button"
          className="schedule-view__add-btn"
          onClick={() => setShowAddPersonal(true)}
          aria-label="개인 일정 추가"
        >
          <span className="schedule-view__add-btn-icon">+</span>
          개인 일정 추가
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

      {showDayModal && selectedDate && isMyScheduleMode && (
        <div className="schedule-view__day-modal" role="dialog" aria-modal="true" aria-labelledby="day-modal-title">
          <div className="schedule-view__share-backdrop" onClick={() => setShowDayModal(false)} aria-hidden />
          <div className="schedule-view__day-panel">
            <div className="schedule-view__share-header">
              <h2 id="day-modal-title" className="schedule-view__share-title">
                {selectedDate.year}.{selectedDate.month}.{selectedDate.day} 일정
              </h2>
              <button
                type="button"
                className="schedule-view__share-close"
                onClick={() => setShowDayModal(false)}
                aria-label="닫기"
              >
                ✕
              </button>
            </div>
            <div className="schedule-view__day-list">
              {isViewingSelf
                ? selectedDayAllTeamSchedules.map(({ id, schedule, teamName, teamId }) => (
                    <label key={id} className="schedule-view__day-item">
                      <input
                        type="checkbox"
                        checked={dayModalCheckedIds.has(id)}
                        onChange={(e) => handleDayModalCheckboxChange(id, e.target.checked)}
                      />
                      <span
                        className="schedule-view__day-dot"
                        style={{ backgroundColor: teamColorByIndex[teamId] ?? '#9e9e9e' }}
                      />
                      <span className="schedule-view__day-team">{teamName}</span>
                      <span className="schedule-view__day-title">
                        {schedule?.place?.name || schedule?.exerciseType?.name || '일정'}
                      </span>
                    </label>
                  ))
                : selectedDayMyItems.team.map(({ id, schedule, teamName, teamId }) => (
                    <div key={id} className="schedule-view__day-item">
                      <span
                        className="schedule-view__day-dot"
                        style={{ backgroundColor: teamColorByIndex[teamId] ?? '#9e9e9e' }}
                      />
                      <span className="schedule-view__day-team">{teamName}</span>
                      <span className="schedule-view__day-title">
                        {schedule?.place?.name || schedule?.exerciseType?.name || '일정'}
                      </span>
                    </div>
                  ))}
              {selectedDayMyItems.personal.map((p) => (
                <div key={p.id} className="schedule-view__day-item schedule-view__day-item--personal">
                  <span className="schedule-view__day-dot schedule-view__day-dot--personal" />
                  <span className="schedule-view__day-title">
                    {(p.place?.name ?? p.exerciseType?.name ?? p.title) || '개인 일정'}
                  </span>
                  {isViewingSelf && (
                    <button
                      type="button"
                      className="schedule-view__day-delete"
                      onClick={() => handleDeletePersonal(p.id)}
                      aria-label="삭제"
                    >
                      삭제
                    </button>
                  )}
                </div>
              ))}
              {((isViewingSelf && selectedDayAllTeamSchedules.length === 0 && selectedDayMyItems.personal.length === 0) ||
                (!isViewingSelf && selectedDayMyItems.team.length === 0 && selectedDayMyItems.personal.length === 0)) && (
                <div className="schedule-view__day-empty">일정이 없습니다.</div>
              )}
            </div>
            {isViewingSelf && selectedDayAllTeamSchedules.length > 0 && (
              <button
                type="button"
                className="schedule-view__apply-selected-btn"
                onClick={handleApplySelectedSchedules}
              >
                선택한 일정 추가
              </button>
            )}
            {isViewingSelf && (
              <button
                type="button"
                className="schedule-view__add-personal-btn"
                onClick={() => { setShowDayModal(false); setShowAddPersonal(true) }}
              >
                + 개인 일정 추가
              </button>
            )}
          </div>
        </div>
      )}

      {showAddPersonal && selectedDate && (
        <AddPersonalScheduleView
          selectedDate={selectedDate}
          userId={user?.id}
          onClose={() => setShowAddPersonal(false)}
          onSuccess={() => { refetchPersonal(); refetchMulti() }}
        />
      )}
    </div>
  )
}
