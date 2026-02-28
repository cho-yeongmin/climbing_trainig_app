import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useShareBadge, markShareModalSeen } from '../hooks/useShareRequests'
import { useTeamJoinBadge, markTeamJoinModalSeen } from '../hooks/useProfile'
import { useNextExpeditionFromMySchedule, useExerciseTypes, useTodayScheduleFromMySchedule, useTodayTrainingRecord, useTodayTrainingRecords, useLatestTrainingRecord, usePlaceDifficultyColors, useLatestExpeditionRecordByPlace, saveTrainingRecord, deleteTodayTrainingRecord } from '../hooks/useSupabase'
import { lockLandscape, unlockOrientation, canLockOrientation } from '../utils/orientationLock'
import { setForceLandscape, getForceLandscape } from '../utils/orientation'
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

export default function HomeScreen() {
  const { logout, user, profile, teamId, isAdmin, isSupervisor, refetchProfile } = useAuth()
  const [activeTab, setActiveTab] = useState('home')

  const { data: nextExpedition, loading: nextExpeditionLoading, refetch: refetchNextExpedition } = useNextExpeditionFromMySchedule(user?.id)
  const { data: exerciseTypes } = useExerciseTypes()
  const { data: todayScheduleData, refetch: refetchTodaySchedule } = useTodayScheduleFromMySchedule(user?.id)

  useEffect(() => {
    if (activeTab === 'home' && user?.id) {
      refetchNextExpedition()
      refetchTodaySchedule()
    }
  }, [activeTab, user?.id, refetchNextExpedition, refetchTodaySchedule])

  const todaySchedules = useMemo(
    () => (Array.isArray(todayScheduleData) ? todayScheduleData : todayScheduleData ? [todayScheduleData] : []),
    [todayScheduleData]
  )

  const firstSchedule = todaySchedules[0] ?? null
  const dayTypeId = firstSchedule?.exercise_types?.day_type_id ?? 'rest'
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
      scheduleId: firstSchedule?.id ?? null,
      teamId: teamId ?? null,
    }
  }, [user?.id, exerciseType?.id, firstSchedule?.id, teamId])

  const { data: todayRecord, refetch: refetchTodayRecord } = useTodayTrainingRecord(
    user?.id,
    saveContext?.recordDate,
    exerciseType?.id,
    firstSchedule?.id
  )
  const { data: todayRecordsMap, refetch: refetchTodayRecords } = useTodayTrainingRecords(user?.id, new Date())

  const { data: latestRecord } = useLatestTrainingRecord(
    user?.id,
    exerciseType?.id
  )

  const placeId = firstSchedule?.place_id ?? null
  const { data: placeColors } = usePlaceDifficultyColors(placeId)
  const { data: expeditionLatestRecord } = useLatestExpeditionRecordByPlace(
    user?.id,
    placeId,
    dayTypeId === 'expedition' ? exerciseType?.id : null
  )

  const scheduleBlocks = useMemo(() => {
    return todaySchedules.map((sched) => {
      const schedDayTypeId = sched?.exercise_types?.day_type_id ?? 'rest'
      const schedExerciseType = exerciseTypes?.find((t) => t.day_type_id === schedDayTypeId)
      const isPersonal = sched?.isPersonal === true
      const schedSaveContext =
        user?.id && schedExerciseType?.id
          ? {
              userId: user.id,
              recordDate: new Date(),
              exerciseTypeId: schedExerciseType.id,
              scheduleId: isPersonal ? null : (sched?.id ?? null),
              personalScheduleId: isPersonal ? (sched?.personalId ?? sched?.id) : null,
              teamId: sched?.team_id ?? teamId ?? null,
            }
          : null
      return {
        schedule: sched,
        dayTypeId: schedDayTypeId,
        dayContent: getDayContentByType(schedDayTypeId),
        exerciseType: schedExerciseType,
        saveContext: schedSaveContext,
      }
    })
  }, [todaySchedules, exerciseTypes, user?.id, teamId])

  const [isEditingRecord, setIsEditingRecord] = useState(false)
  const [editingRecordScheduleId, setEditingRecordScheduleId] = useState(null)
  const [showTimerModal, setShowTimerModal] = useState(false)
  const [showProfileEdit, setShowProfileEdit] = useState(false)
  const [orientationLocked, setOrientationLocked] = useState(false)
  const [forceLandscape, setForceLandscapeState] = useState(() => getForceLandscape())

  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        unlockOrientation()
        setOrientationLocked(false)
      }
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

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
    async (payload, detailType, ctx = saveContext) => {
      if (!ctx) return
      try {
        await saveTrainingRecord({ ...ctx, detailType, payload })
        await refetchTodayRecord()
        await refetchTodayRecords()
        setIsEditingRecord(false)
        setEditingRecordScheduleId(null)
        alert('저장되었습니다.')
      } catch (err) {
        console.error(err)
        alert('저장에 실패했습니다.')
      }
    },
    [saveContext, refetchTodayRecord, refetchTodayRecords]
  )

  const handleDeleteRecord = useCallback(
    async (ctx = saveContext) => {
      if (!ctx || !confirm('오늘 저장한 운동 기록을 삭제할까요?')) return
      try {
        const mapKey = ctx.scheduleId ?? (ctx.personalScheduleId ? `p_${ctx.personalScheduleId}` : `ex_${ctx.exerciseTypeId}`)
        const record = todayRecordsMap?.[mapKey]
        await deleteTodayTrainingRecord({ ...ctx, recordId: record?.id })
        await refetchTodayRecord()
        await refetchTodayRecords()
        setIsEditingRecord(false)
        setEditingRecordScheduleId(null)
        alert('삭제되었습니다.')
      } catch (err) {
        console.error(err)
        alert('삭제에 실패했습니다.')
      }
    },
    [saveContext, todayRecordsMap, refetchTodayRecord, refetchTodayRecords]
  )

  return (
    <div className="home-screen">
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
            {scheduleBlocks.length > 0 ? (
              scheduleBlocks.map((block, blockIdx) => {
                const blockKey = block.schedule?.isPersonal ? `p_${block.schedule.personalId ?? block.schedule.id}` : block.schedule?.id ?? `ex_${block.exerciseType?.id}`
                const blockRecord = todayRecordsMap?.[blockKey]
                const blockEditKey = block.schedule?.id ?? blockIdx
                return (
                  <div key={blockKey} className="home-screen__schedule-block">
                    {(block.dayContent.cards.filter((card) => blockIdx === 0 || card.type !== 'dday')).map((card, index) => (
                      <DayContentCard
                        key={index}
                        card={card}
                        dayTypeId={block.dayTypeId}
                        nextExpedition={card.type === 'dday' ? nextExpedition : undefined}
                        nextExpeditionLoading={card.type === 'dday' ? nextExpeditionLoading : false}
                        onSave={(p, t) => handleSaveRecord(p, t, block.saveContext)}
                        onDeleteRecord={() => handleDeleteRecord(block.saveContext)}
                        onOpenTimer={() => setShowTimerModal(true)}
                        saveContext={block.saveContext}
                        todayRecord={blockRecord ? { detailType: blockRecord.detailType, payload: blockRecord.payload } : null}
                        latestRecord={latestRecord}
                        placeId={block.schedule?.place_id ?? null}
                        placeColors={placeColors ?? []}
                        expeditionLatestRecord={block.dayTypeId === 'expedition' ? expeditionLatestRecord : undefined}
                        isEditingRecord={editingRecordScheduleId === blockEditKey}
                        onEditRecord={() => setEditingRecordScheduleId(blockEditKey)}
                      />
                    ))}
                  </div>
                )
              })
            ) : (
              dayContent.cards.map((card, index) => (
                <DayContentCard
                  key={index}
                  card={card}
                  dayTypeId={dayTypeId}
                  nextExpedition={card.type === 'dday' ? nextExpedition : undefined}
                  nextExpeditionLoading={card.type === 'dday' ? nextExpeditionLoading : false}
                  onSave={handleSaveRecord}
                  onDeleteRecord={() => handleDeleteRecord()}
                  onOpenTimer={() => setShowTimerModal(true)}
                  saveContext={saveContext}
                  todayRecord={todayRecord}
                  latestRecord={latestRecord}
                  placeId={firstSchedule?.place_id ?? null}
                  placeColors={placeColors ?? []}
                  expeditionLatestRecord={expeditionLatestRecord}
                  isEditingRecord={isEditingRecord}
                  onEditRecord={() => setIsEditingRecord(true)}
                />
              ))
            )}
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

        <button
          type="button"
          className="home-screen__landscape-btn"
          onClick={async () => {
            const isOn = orientationLocked || forceLandscape
            if (isOn) {
              if (orientationLocked) {
                await unlockOrientation()
                setOrientationLocked(false)
              } else {
                setForceLandscape(false)
                setForceLandscapeState(false)
              }
              return
            }
            if (canLockOrientation()) {
              const ok = await lockLandscape()
              if (ok) setOrientationLocked(true)
              else {
                setForceLandscape(true)
                setForceLandscapeState(true)
              }
            } else {
              setForceLandscape(true)
              setForceLandscapeState(true)
            }
          }}
          aria-pressed={orientationLocked || forceLandscape}
          aria-label="가로 모드 전환"
        >
          {orientationLocked || forceLandscape ? '가로 모드 끄기' : '가로 모드'}
        </button>
      </main>
      )}
    </div>
  )
}
