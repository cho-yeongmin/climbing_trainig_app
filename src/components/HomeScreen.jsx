import { useState, useMemo, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNextExpedition, useExerciseTypes, useTodaySchedule, useTodayTrainingRecord, useLatestTrainingRecord, saveTrainingRecord, deleteTodayTrainingRecord } from '../hooks/useSupabase'
import { getDayContentByType } from '../data/dayContent'
import DayContentCard from './DayContentCard'
import ScheduleView from './ScheduleView'
import ExerciseLogView from './ExerciseLogView'
import SprayWallView from './SprayWallView'
import './HomeScreen.css'

const TABS = [
  { id: 'home', label: '홈' },
  { id: 'schedule', label: '일정확인' },
  { id: 'log', label: '운동로그' },
  { id: 'spraywall', label: '스프레이월' },
]

const SWIPE_THRESHOLD = 50

export default function HomeScreen() {
  const { logout, user } = useAuth()
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

  const { data: nextExpedition, loading: nextExpeditionLoading } = useNextExpedition()
  const { data: exerciseTypes } = useExerciseTypes()
  const { data: todaySchedule } = useTodaySchedule()

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
    }
  }, [user?.id, exerciseType?.id, todaySchedule?.id])

  const { data: todayRecord, refetch: refetchTodayRecord } = useTodayTrainingRecord(
    user?.id,
    saveContext?.recordDate,
    exerciseType?.id
  )

  const { data: latestRecord } = useLatestTrainingRecord(
    user?.id,
    exerciseType?.id
  )

  const [isEditingRecord, setIsEditingRecord] = useState(false)

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
    <div className="home-screen">
      <main
        className="home-screen__main"
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
        <div className="home-screen__header">
          <h1 className="home-screen__title">클라이밍 잘하고 싶다</h1>
          <button
            type="button"
            className="home-screen__logout"
            onClick={() => logout()}
            aria-label="로그아웃"
          >
            로그아웃
          </button>
        </div>

        <div className="home-screen__tabs" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`home-screen__tab ${activeTab === tab.id ? 'home-screen__tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'home' && (
          <div className="home-screen__cards">
            {dayContent.cards.map((card, index) => (
              <DayContentCard
                key={index}
                card={card}
                nextExpedition={card.type === 'dday' ? nextExpedition : undefined}
                nextExpeditionLoading={card.type === 'dday' ? nextExpeditionLoading : false}
                onSave={handleSaveRecord}
                onDeleteRecord={handleDeleteRecord}
                saveContext={saveContext}
                todayRecord={todayRecord}
                latestRecord={latestRecord}
                isEditingRecord={isEditingRecord}
                onEditRecord={() => setIsEditingRecord(true)}
              />
            ))}
          </div>
        )}

        {activeTab === 'schedule' && <ScheduleView />}

        {activeTab === 'log' && <ExerciseLogView />}

        {activeTab === 'spraywall' && <SprayWallView userId={user?.id} />}
      </main>
    </div>
  )
}
