import { useState, useMemo, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useShareBadge, markShareModalSeen } from '../hooks/useShareRequests'
import { useTeamJoinBadge, markTeamJoinModalSeen } from '../hooks/useProfile'
import { useNextExpedition, useExerciseTypes, useTodaySchedule, useTodayTrainingRecord, useLatestTrainingRecord, usePlaceDifficultyColors, useLatestExpeditionRecordByPlace, saveTrainingRecord, deleteTodayTrainingRecord } from '../hooks/useSupabase'
import { getDayContentByType } from '../data/dayContent'
import { lazy, Suspense } from 'react'
import DayContentCard from './DayContentCard'
import ExerciseLogView from './ExerciseLogView'
import ProfileEditModal from './ProfileEditModal'

const ScheduleView = lazy(() => import('./ScheduleView'))
const TeamView = lazy(() => import('./TeamView'))
import SprayWallView from './SprayWallView'
import TimerView from './TimerView'
import './HomeScreen.css'

const TABS = [
  { id: 'home', label: '홈' },
  { id: 'schedule', label: '일정' },
  { id: 'team', label: '팀' },
  { id: 'log', label: '기록' },
  { id: 'spraywall', label: '스프레이월' },
]

const SWIPE_THRESHOLD = 50

export default function HomeScreen() {
  const { logout, user, profile, teamId, isAdmin, isSupervisor, refetchProfile } = useAuth()
  const [activeTab, setActiveTab] = useState('home')
  const swipeStartX = useRef(0)

  const tabIds = TABS.map((t) => t.id)
  const currentIndex = tabIds.indexOf(activeTab)

  const goPrevTab = useCallback(() => {
    if (currentIndex > 0) setActiveTab(tabIds[currentIndex - 1])
  }, [currentIndex, tabIds])

  const goNextTab = useCallback(() => {
    if (currentIndex < tabIds.length - 1) setActiveTab(tabIds[currentIndex + 1])
  }, [currentIndex, tabIds])

  const handleSwipeStart = (e) => {
    swipeStartX.current = e.touches ? e.touches[0].clientX : e.clientX
  }
  const handleSwipeEnd = (e) => {
    const endX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX
    const diff = swipeStartX.current - endX
    if (Math.abs(diff) >= SWIPE_THRESHOLD) {
      if (diff > 0) goNextTab()
      else goPrevTab()
    }
  }

  const { data: nextExpedition, loading: nextExpeditionLoading } = useNextExpedition(teamId)
  const { data: exerciseTypes } = useExerciseTypes()
  const { data: todaySchedule } = useTodaySchedule(teamId)

  // 오늘 일정이 있으면 그 운동 유형, 없으면 휴식하는 날
  const dayTypeId = todaySchedule?.exercise_types?.day_type_id ?? 'rest'
  const dayContent = useMemo(
    () => getDayContentByType(dayTypeId),
    [dayTypeId]
  )

  const exerciseType = useMemo(
    () => exerciseTypes.find((t) => t.day_type_id === dayTypeId),
    [exerciseTypes, dayTypeId]
  )

  const saveContext = useMemo(() => {
    if (!user?.id || !exerciseType?.id) return null
    return {
      userId: user.id,
      recordDate: new Date(),
      exerciseTypeId: exerciseType.id,
      scheduleId: todaySchedule?.id ?? null,
      teamId: teamId ?? null,
    }
  }, [user?.id, exerciseType?.id, todaySchedule?.id, teamId])

  const { data: todayRecord, refetch: refetchTodayRecord } = useTodayTrainingRecord(
    user?.id,
    saveContext?.recordDate,
    exerciseType?.id
  )

  const { data: latestRecord } = useLatestTrainingRecord(
    user?.id,
    exerciseType?.id
  )

  const placeId = todaySchedule?.place_id ?? null
  const { data: placeColors } = usePlaceDifficultyColors(placeId)
  const { data: expeditionLatestRecord } = useLatestExpeditionRecordByPlace(
    user?.id,
    placeId,
    dayTypeId === 'expedition' ? exerciseType?.id : null
  )

  const [isEditingRecord, setIsEditingRecord] = useState(false)
  const [showTimerModal, setShowTimerModal] = useState(false)
  const [showProfileEdit, setShowProfileEdit] = useState(false)

  const nickname = profile?.nickname || profile?.display_name || '사용자'
  const hasBatchim = (c) => {
    if (!c) return false
    const code = c.charCodeAt(0)
    if (code < 0xac00 || code > 0xd7a3) return true
    return (code - 0xac00) % 28 !== 0
  }
  const particle = hasBatchim(nickname.slice(-1)) ? '은' : '는'

  const { hasBadge: shareBadgeActive, sharedCount } = useShareBadge()
  const hasShareBadge = (isAdmin || isSupervisor) && shareBadgeActive
  const { hasBadge: teamJoinBadgeActive, count: teamJoinCount } = useTeamJoinBadge()
  const hasTeamJoinBadge = (isAdmin || isSupervisor) && teamJoinBadgeActive

  const handleSaveRecord = useCallback(
    async (payload, detailType) => {
      if (!saveContext) return
      try {
        await saveTrainingRecord({
          ...saveContext,
          detailType,
          payload,
        })
        await refetchTodayRecord()
        setIsEditingRecord(false)
        alert('저장되었습니다.')
      } catch (err) {
        console.error(err)
        alert('저장에 실패했습니다.')
      }
    },
    [saveContext, refetchTodayRecord]
  )

  const handleDeleteRecord = useCallback(
    async () => {
      if (!saveContext || !confirm('오늘 저장한 운동 기록을 삭제할까요?')) return
      try {
        await deleteTodayTrainingRecord(saveContext)
        await refetchTodayRecord()
        setIsEditingRecord(false)
        alert('삭제되었습니다.')
      } catch (err) {
        console.error(err)
        alert('삭제에 실패했습니다.')
      }
    },
    [saveContext, refetchTodayRecord]
  )

  return (
    <div
      className="home-screen"
      onTouchStart={handleSwipeStart}
      onTouchEnd={handleSwipeEnd}
      onMouseDown={(e) => { swipeStartX.current = e.clientX }}
      onMouseUp={(e) => {
        const diff = swipeStartX.current - e.clientX
        if (Math.abs(diff) >= SWIPE_THRESHOLD) {
          if (diff > 0) goNextTab()
          else goPrevTab()
        }
      }}
    >
      {showTimerModal ? (
        <div className="timer-fullscreen">
          <TimerView dayTypeId={dayTypeId} onClose={() => setShowTimerModal(false)} />
        </div>
      ) : (
      <main className="home-screen__main">
        <div className="home-screen__header">
          <div className="home-screen__header-title-wrap">
            <p className="home-screen__title-top">
              <span className="home-screen__nickname">{nickname}</span>
              {particle}
            </p>
            <h1 className="home-screen__title">클라이밍을 잘하고 싶다</h1>
          </div>
          <div className="home-screen__header-actions">
            <button
              type="button"
              className="home-screen__profile-edit"
              onClick={() => {
                setShowProfileEdit(true)
                if (hasTeamJoinBadge && teamJoinCount != null) markTeamJoinModalSeen(teamJoinCount)
              }}
              aria-label="프로필 편집"
            >
              ✎
              {hasTeamJoinBadge && <span className="home-screen__tab-badge" aria-hidden />}
            </button>
            <button
              type="button"
              className="home-screen__logout"
              onClick={() => logout()}
              aria-label="로그아웃"
            >
              로그아웃
            </button>
          </div>
        </div>
        {showProfileEdit && (
          <ProfileEditModal
            onClose={() => setShowProfileEdit(false)}
            onSuccess={() => { refetchProfile(); setShowProfileEdit(false) }}
          />
        )}

        <div className="home-screen__tabs" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`home-screen__tab ${activeTab === tab.id ? 'home-screen__tab--active' : ''} home-screen__tab--compact`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {tab.id === 'schedule' && hasShareBadge && (
                <span className="home-screen__tab-badge" aria-hidden />
              )}
            </button>
          ))}
        </div>

        {activeTab === 'home' && (
          <div className="home-screen__cards">
            {dayContent.cards.map((card, index) => (
              <DayContentCard
                key={index}
                card={card}
                dayTypeId={dayTypeId}
                nextExpedition={card.type === 'dday' ? nextExpedition : undefined}
                nextExpeditionLoading={card.type === 'dday' ? nextExpeditionLoading : false}
                onSave={handleSaveRecord}
                onDeleteRecord={handleDeleteRecord}
                onOpenTimer={() => setShowTimerModal(true)}
                saveContext={saveContext}
                todayRecord={todayRecord}
                latestRecord={latestRecord}
                placeColors={placeColors ?? []}
                expeditionLatestRecord={expeditionLatestRecord}
                isEditingRecord={isEditingRecord}
                onEditRecord={() => setIsEditingRecord(true)}
              />
            ))}
          </div>
        )}

        {activeTab === 'schedule' && (
          <Suspense fallback={<div className="home-screen__schedule-skeleton">일정 불러오는 중...</div>}>
            <ScheduleView hasShareBadge={hasShareBadge} sharedCount={sharedCount} onShareModalOpen={() => markShareModalSeen(sharedCount)} />
          </Suspense>
        )}

        {activeTab === 'team' && (
          <Suspense fallback={<div className="home-screen__schedule-skeleton">불러오는 중...</div>}>
            <TeamView />
          </Suspense>
        )}

        {activeTab === 'log' && <ExerciseLogView />}

        {activeTab === 'spraywall' && <SprayWallView userId={user?.id} />}
      </main>
      )}
    </div>
  )
}
