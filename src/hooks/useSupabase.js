import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { getTodayKST, toDateStringKST } from '../utils/date'

// 운동 종류 목록
export function useExerciseTypes() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase
      .from('exercise_types')
      .select('id, day_type_id, name, image_url, config')
      .order('day_type_id')
      .then(({ data: rows, error: err }) => {
        if (err) setError(err)
        else setData(rows ?? [])
        setLoading(false)
      })
  }, [])

  return { data, loading, error }
}

// 장소 검색
export function usePlaces(search = '') {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!search.trim()) {
      setData([])
      return
    }
    setLoading(true)
    supabase
      .from('places')
      .select('id, name, address, image_url')
      .ilike('name', `%${search.trim()}%`)
      .limit(20)
      .then(({ data: rows }) => {
        setData(rows ?? [])
        setLoading(false)
      })
  }, [search])

  return { data, loading }
}

// 사용자 최근 검색 장소 (최대 5개)
export function useRecentPlaces() {
  const { user } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(() => {
    if (!user) {
      setData([])
      setLoading(false)
      return
    }
    supabase
      .from('user_recent_places')
      .select('place_id, places(id, name, address, image_url)')
      .eq('user_id', user.id)
      .order('searched_at', { ascending: false })
      .limit(5)
      .then(({ data: rows }) => {
        const places = (rows ?? [])
          .map((r) => r.places)
          .filter(Boolean)
        setData(places)
        setLoading(false)
      })
  }, [user?.id])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, loading, refetch }
}

// 최근 검색 장소 저장
export async function saveRecentPlace(userId, placeId) {
  await supabase.from('user_recent_places').upsert(
    { user_id: userId, place_id: placeId, searched_at: new Date().toISOString() },
    { onConflict: 'user_id,place_id', ignoreDuplicates: false }
  )
}

// 조회 가능한 팀 목록 (내 팀 + 공유 동의된 팀)
export function useSharableTeams() {
  const { user, profile } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const myTeamId = profile?.team_id ?? null

  useEffect(() => {
    if (!user?.id || !myTeamId) {
      setData([])
      setLoading(false)
      return
    }

    const run = async () => {
      // 1. 내 팀 조회 (항상 teams 테이블에서 직접)
      const { data: myTeam, error: teamErr } = await supabase
        .from('teams')
        .select('id, name')
        .eq('id', myTeamId)
        .single()
      if (teamErr || !myTeam) {
        setData([])
        setLoading(false)
        return
      }

      const teams = [myTeam]

      // 2. 일정공유 팀 조회
      const { data: shares } = await supabase
        .from('team_schedule_shares')
        .select('team_id, shared_with_team_id')
        .or(`team_id.eq.${myTeamId},shared_with_team_id.eq.${myTeamId}`)
      const otherIds = [...new Set((shares ?? []).map((s) => (s.team_id === myTeamId ? s.shared_with_team_id : s.team_id)).filter((id) => id && id !== myTeamId))]

      if (otherIds.length > 0) {
        const { data: otherTeams } = await supabase
          .from('teams')
          .select('id, name')
          .in('id', otherIds)
        ;(otherTeams ?? []).forEach((t) => teams.push(t))
      }
      setData(teams)
      setLoading(false)
    }
    run().catch(() => {
      setData([])
      setLoading(false)
    })
  }, [user?.id, myTeamId])

  return { data, loading }
}

// 일정 (월별) - teamId로 팀 필터
export function useSchedules(year, month, teamId = null) {
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(() => {
    if (!teamId) {
      setData({})
      setLoading(false)
      return
    }
    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = new Date(year, month, 0)
    const end = `${year}-${String(month).padStart(2, '0')}-${endDate.getDate()}`
    setLoading(true)
    supabase
      .from('schedules')
      .select(`
        id, date,
        exercise_type_id,
        place_id,
        team_id,
        exercise_types(id, day_type_id, name, image_url),
        places(id, name, address, image_url)
      `)
      .eq('team_id', teamId)
      .gte('date', start)
      .lte('date', end)
      .then(({ data: rows }) => {
        const map = {}
        ;(rows ?? []).forEach((r) => {
          const d = r.date
          if (!map[d]) map[d] = []
          map[d].push({
            id: r.id,
            date: d,
            exerciseType: r.exercise_types,
            place: r.places,
          })
        })
        setData(map)
        setLoading(false)
      })
  }, [year, month, teamId])

  useEffect(() => {
    refetch()
  }, [refetch])

  // 일정 추가/수정/삭제 시 자동 갱신 (Realtime)
  useEffect(() => {
    const channel = supabase
      .channel('schedules-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, () => {
        refetch()
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [refetch])

  return { data, loading, refetch }
}

// 여러 팀의 일정 (내 일정 달력용 - 팀별 점 표시)
export function useSchedulesMultiTeam(year, month, teamIds = []) {
  const [data, setData] = useState({}) // { [date]: [{ schedule, teamId, teamName }, ...] }
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!teamIds?.length) {
      setData({})
      setLoading(false)
      return
    }
    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = new Date(year, month, 0)
    const end = `${year}-${String(month).padStart(2, '0')}-${endDate.getDate()}`
    setLoading(true)
    const { data: rows } = await supabase
      .from('schedules')
      .select(`
        id, date, exercise_type_id, place_id, team_id,
        exercise_types(id, day_type_id, name, image_url),
        places(id, name, address, image_url)
      `)
      .in('team_id', teamIds)
      .gte('date', start)
      .lte('date', end)
    const map = {}
    ;(rows ?? []).forEach((r) => {
      const d = r.date
      if (!map[d]) map[d] = []
      map[d].push({
        id: r.id,
        schedule: { date: r.date, exerciseType: r.exercise_types, place: r.places },
        teamId: r.team_id,
      })
    })
    setData(map)
    setLoading(false)
  }, [year, month, JSON.stringify(teamIds)])

  useEffect(() => { refetch() }, [refetch])
  return { data, loading, refetch }
}

// 내 일정 선택 (팀 일정 추가)
export function useMyScheduleSelections(userId) {
  const [ids, setIds] = useState(new Set())
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(() => {
    if (!userId) {
      setIds(new Set())
      setLoading(false)
      return
    }
    supabase
      .from('user_my_schedule_selections')
      .select('schedule_id')
      .eq('user_id', userId)
      .then(({ data: rows }) => {
        setIds(new Set((rows ?? []).map((r) => r.schedule_id)))
        setLoading(false)
      })
      .catch(() => { setIds(new Set()); setLoading(false) })
  }, [userId])

  useEffect(() => { refetch() }, [refetch])
  return { selectedIds: ids, loading, refetch }
}

// 개인 일정 (월별)
export function useMyPersonalSchedules(userId, year, month) {
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(() => {
    if (!userId) {
      setData({})
      setLoading(false)
      return
    }
    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = new Date(year, month, 0)
    const end = `${year}-${String(month).padStart(2, '0')}-${endDate.getDate()}`
    supabase
      .from('user_personal_schedules')
      .select('id, date, title, place_id, exercise_type_id, places(id, name, image_url), exercise_types(id, name, image_url)')
      .eq('user_id', userId)
      .gte('date', start)
      .lte('date', end)
      .then(({ data: rows }) => {
        const map = {}
        ;(rows ?? []).forEach((r) => {
          const d = r.date
          if (!map[d]) map[d] = []
          map[d].push({
            ...r,
            place: r.places,
            exerciseType: r.exercise_types,
            isPersonal: true,
          })
        })
        setData(map)
        setLoading(false)
      })
      .catch(() => { setData({}); setLoading(false) })
  }, [userId, year, month])

  useEffect(() => { refetch() }, [refetch])
  return { data, loading, refetch }
}

export async function addToMySchedule(userId, scheduleId) {
  const { error } = await supabase
    .from('user_my_schedule_selections')
    .insert({ user_id: userId, schedule_id: scheduleId })
  if (error) throw error
}

export async function removeFromMySchedule(userId, scheduleId) {
  const { error } = await supabase
    .from('user_my_schedule_selections')
    .delete()
    .eq('user_id', userId)
    .eq('schedule_id', scheduleId)
  if (error) throw error
}

export async function addPersonalSchedule(userId, { date, title, placeId, exerciseTypeId }) {
  const { error } = await supabase
    .from('user_personal_schedules')
    .insert({
      user_id: userId,
      date,
      title: title ?? '',
      place_id: placeId ?? null,
      exercise_type_id: exerciseTypeId ?? null,
    })
  if (error) throw error
}

export async function addPersonalScheduleItems(userId, date, items) {
  if (!items?.length) return
  const rows = items.map(({ placeId, exerciseTypeId }) => ({
    user_id: userId,
    date,
    title: '',
    place_id: placeId ?? null,
    exercise_type_id: exerciseTypeId ?? null,
  }))
  const { error } = await supabase.from('user_personal_schedules').insert(rows)
  if (error) throw error
}

export async function deletePersonalSchedule(scheduleId) {
  const { error } = await supabase
    .from('user_personal_schedules')
    .delete()
    .eq('id', scheduleId)
  if (error) throw error
}

// 다가오는 원정 일정 (가장 가까운 미래의 expedition 스케줄 1건) - teamId로 팀 필터
export function useNextExpedition(teamId = null) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(() => {
    const today = getTodayKST()
    setLoading(true)
    let q = supabase
      .from('schedules')
      .select(`
        date,
        places(id, name, address),
        exercise_types(day_type_id)
      `)
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(50)
    if (teamId) q = q.eq('team_id', teamId)
    q.then(({ data: rows }) => {
      const next = (rows ?? []).find((r) => r.exercise_types?.day_type_id === 'expedition')
      setData(next ?? null)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [teamId])

  useEffect(() => {
    refetch()
  }, [refetch])

  useEffect(() => {
    const channel = supabase
      .channel('next-expedition-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, refetch)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [refetch])

  return { data: data ? normalizeNextExpedition(data) : null, loading }
}

// 내 일정 기반 다가오는 원정 (user_my_schedule_selections + user_personal_schedules)
export function useNextExpeditionFromMySchedule(userId) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(() => {
    if (!userId) {
      setData(null)
      setLoading(false)
      return Promise.resolve()
    }
    const today = getTodayKST()
    setLoading(true)

    Promise.all([
      supabase.from('user_my_schedule_selections').select('schedule_id').eq('user_id', userId),
      supabase.from('user_personal_schedules').select('id, date, place_id, exercise_type_id, places(id, name, address), exercise_types(day_type_id)').eq('user_id', userId).gte('date', today),
    ])
      .then(async ([selRes, persRes]) => {
        const scheduleIds = (selRes.data ?? []).map((r) => r.schedule_id).filter(Boolean)
        const personalRows = persRes.data ?? []
        let teamRows = []
        if (scheduleIds.length > 0) {
          const { data: schedRows } = await supabase
            .from('schedules')
            .select('date, places(id, name, address), exercise_types(day_type_id)')
            .in('id', scheduleIds)
            .gte('date', today)
            .order('date', { ascending: true })
          teamRows = schedRows ?? []
        }
        const teamExpeditions = teamRows.filter((r) => r.exercise_types?.day_type_id === 'expedition')
        const personalExpeditions = personalRows.filter(
          (r) => r.place_id != null || r.exercise_types?.day_type_id === 'expedition'
        )
        const all = [
          ...teamExpeditions.map((r) => ({ ...r, _src: 'team' })),
          ...personalExpeditions.map((r) => ({ ...r, _src: 'personal' })),
        ].sort((a, b) => (a.date < b.date ? -1 : 1))
        const next = all[0] ?? null
        setData(next ? normalizeNextExpedition(next) : null)
        setLoading(false)
      })
      .catch(() => {
        setData(null)
        setLoading(false)
      })
  }, [userId])

  useEffect(() => {
    refetch()
  }, [refetch])

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel('next-expedition-my-schedule')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_my_schedule_selections' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_personal_schedules' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, refetch)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [userId, refetch])

  return { data, loading, refetch }
}

function normalizeNextExpedition(row) {
  const dateStr = row.date
  const place = row.places
  const todayKST = getTodayKST()
  const d = new Date(dateStr + 'T00:00:00+09:00') // KST 자정
  const today = new Date(todayKST + 'T00:00:00+09:00') // KST 자정
  const diffMs = d - today
  const daysUntil = Math.round(diffMs / (24 * 60 * 60 * 1000))
  const weekdays = ['일', '월', '화', '수', '목', '금', '토']
  const [yFull, mNum, dayNum] = dateStr.split('-').map(Number)
  const y = yFull.toString().slice(-2)
  const m = mNum
  const day = dayNum
  const week = weekdays[new Date(yFull, mNum - 1, dayNum).getDay()]
  const dateLabel = `${y}년 ${m}월 ${day}일 ${week}요일`
  return {
    date: dateStr,
    dateLabel,
    daysUntil,
    placeName: place?.name ?? '',
    placeAddress: place?.address ?? '',
  }
}

// 오늘 일정 (한국 시간 기준) - teamId로 팀 필터, 복수 반환
export function useTodaySchedule(teamId = null) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(() => {
    const today = getTodayKST()
    setLoading(true)
    let q = supabase
      .from('schedules')
      .select(`
        id,
        date,
        exercise_type_id,
        place_id,
        team_id,
        exercise_types(id, day_type_id, name, image_url, config),
        places(id, name, address, image_url)
      `)
      .eq('date', today)
    if (teamId) q = q.eq('team_id', teamId)
    q.order('created_at', { ascending: true })
      .then(({ data: rows }) => {
        const list = rows ?? []
        setData(list.length > 0 ? list : null)
        setLoading(false)
      })
  }, [teamId])

  useEffect(() => {
    refetch()
  }, [refetch])

  // 자정 경과 시 날짜 갱신 (1분마다 체크)
  useEffect(() => {
    const id = setInterval(refetch, 60000)
    return () => clearInterval(id)
  }, [refetch])

  useEffect(() => {
    const channel = supabase
      .channel('today-schedule-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, refetch)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [refetch])

  return { data, loading }
}

// 내 일정 기반 오늘 일정 (user_my_schedule_selections + user_personal_schedules)
export function useTodayScheduleFromMySchedule(userId) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(() => {
    if (!userId) {
      setData(null)
      setLoading(false)
      return Promise.resolve()
    }
    const today = getTodayKST()
    setLoading(true)

    Promise.all([
      supabase.from('user_my_schedule_selections').select('schedule_id').eq('user_id', userId),
      supabase.from('user_personal_schedules').select('id, date, place_id, exercise_type_id, exercise_types(id, day_type_id, name, image_url, config), places(id, name, address, image_url)').eq('user_id', userId).eq('date', today),
    ])
      .then(async ([selRes, persRes]) => {
        const scheduleIds = (selRes.data ?? []).map((r) => r.schedule_id).filter(Boolean)
        const personalRows = (persRes.data ?? []).map((r) => ({
          id: r.id,
          date: r.date,
          exercise_type_id: r.exercise_type_id,
          place_id: r.place_id,
          team_id: null,
          exercise_types: r.exercise_types,
          places: r.places,
          isPersonal: true,
          personalId: r.id,
        }))
        let teamRows = []
        if (scheduleIds.length > 0) {
          const { data: schedRows } = await supabase
            .from('schedules')
            .select('id, date, exercise_type_id, place_id, team_id, exercise_types(id, day_type_id, name, image_url, config), places(id, name, address, image_url)')
            .in('id', scheduleIds)
            .eq('date', today)
            .order('created_at', { ascending: true })
          teamRows = (schedRows ?? []).map((r) => ({ ...r, isPersonal: false }))
        }
        const merged = [...teamRows, ...personalRows].sort((a, b) => {
          if (a.isPersonal && !b.isPersonal) return 1
          if (!a.isPersonal && b.isPersonal) return -1
          return 0
        })
        setData(merged.length > 0 ? merged : null)
        setLoading(false)
      })
      .catch(() => {
        setData(null)
        setLoading(false)
      })
  }, [userId])

  useEffect(() => {
    refetch()
  }, [refetch])

  useEffect(() => {
    const id = setInterval(refetch, 60000)
    return () => clearInterval(id)
  }, [refetch])

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel('today-schedule-my-schedule')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_my_schedule_selections' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_personal_schedules' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, refetch)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [userId, refetch])

  return { data, loading, refetch }
}

// 오늘의 훈련 기록 조회 (날짜 + 운동유형 + 선택적 scheduleId)
// scheduleId 있으면 해당 일정의 기록, 없으면 첫 번째 매칭
export function useTodayTrainingRecord(userId, recordDate, exerciseTypeId, scheduleId = null) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const dateStr = toDateStringKST(recordDate)

  const refetch = useCallback(() => {
    if (!userId || !dateStr || !exerciseTypeId) {
      setData(null)
      setLoading(false)
      return Promise.resolve()
    }
    setLoading(true)
    let q = supabase
      .from('training_records')
      .select(`id, schedule_id, training_record_details(detail_type, payload)`)
      .eq('user_id', userId)
      .eq('record_date', dateStr)
      .eq('exercise_type_id', exerciseTypeId)
    if (scheduleId) q = q.eq('schedule_id', scheduleId)
    return q.order('created_at', { ascending: false })
      .limit(1)
      .then(({ data: rows }) => {
        const row = Array.isArray(rows) ? rows[0] : rows
        const details = row?.training_record_details ?? []
        const detail = Array.isArray(details) ? details[0] : details
        setData(
          row ? {
            id: row.id,
            detailType: detail?.detail_type,
            payload: detail?.payload ?? {},
          } : null
        )
        setLoading(false)
      })
  }, [userId, dateStr, exerciseTypeId, scheduleId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, loading, refetch }
}

// 오늘의 훈련 기록 여러 건 (날짜 기준, scheduleId별 매칭)
export function useTodayTrainingRecords(userId, recordDate) {
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(true)
  const dateStr = toDateStringKST(recordDate)

  const refetch = useCallback(() => {
    if (!userId || !dateStr) {
      setData({})
      setLoading(false)
      return Promise.resolve()
    }
    setLoading(true)
    return supabase
      .from('training_records')
      .select('id, schedule_id, personal_schedule_id, exercise_type_id, training_record_details(detail_type, payload)')
      .eq('user_id', userId)
      .eq('record_date', dateStr)
      .then(({ data: rows }) => {
        const map = {}
        ;(rows ?? []).forEach((r) => {
          const details = r.training_record_details ?? []
          const detail = Array.isArray(details) ? details[0] : details
          const key = r.schedule_id ?? (r.personal_schedule_id ? `p_${r.personal_schedule_id}` : `ex_${r.exercise_type_id}`)
          map[key] = {
            id: r.id,
            detailType: detail?.detail_type,
            payload: detail?.payload ?? {},
          }
        })
        setData(map)
        setLoading(false)
      })
  }, [userId, dateStr])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, loading, refetch }
}

// 같은 운동 유형의 가장 최근 기록 조회 (오늘 제외)
export function useLatestTrainingRecord(userId, exerciseTypeId, beforeDate = null) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const beforeDateStr = beforeDate
    ? toDateStringKST(beforeDate)
    : getTodayKST()

  useEffect(() => {
    if (!userId || !exerciseTypeId) {
      setData(null)
      setLoading(false)
      return
    }
    setLoading(true)
    supabase
      .from('training_records')
      .select(`
        id,
        record_date,
        training_record_details(detail_type, payload)
      `)
      .eq('user_id', userId)
      .eq('exercise_type_id', exerciseTypeId)
      .lt('record_date', beforeDateStr)
      .order('record_date', { ascending: false })
      .limit(1)
      .then(({ data: rows }) => {
        const row = Array.isArray(rows) ? rows[0] : rows
        const details = row?.training_record_details ?? []
        const detail = Array.isArray(details) ? details[0] : details
        setData(detail ? { detailType: detail.detail_type, payload: detail.payload ?? {}, recordDate: row.record_date } : null)
        setLoading(false)
      })
  }, [userId, exerciseTypeId, beforeDateStr])

  return { data, loading }
}

// 훈련 기록 저장 - 복수 허용 (기존 있으면 업데이트, 없으면 insert)
export async function saveTrainingRecord({
  userId,
  recordDate,
  exerciseTypeId,
  scheduleId,
  personalScheduleId,
  teamId,
  detailType,
  payload,
  recordId,
}) {
  const dateStr = toDateStringKST(recordDate)

  let record
  if (recordId) {
    const { data: existing, error: fetchErr } = await supabase
      .from('training_records')
      .select('id')
      .eq('id', recordId)
      .single()
    if (fetchErr || !existing) {
      recordId = null
    } else {
      record = existing
    }
  }
  if (!record && !recordId) {
    let q = supabase
      .from('training_records')
      .select('id')
      .eq('user_id', userId)
      .eq('record_date', dateStr)
      .eq('exercise_type_id', exerciseTypeId)
    if (scheduleId) q = q.eq('schedule_id', scheduleId)
    else if (personalScheduleId) q = q.eq('personal_schedule_id', personalScheduleId)
    else q = q.is('schedule_id', null).is('personal_schedule_id', null)
    const { data: existing } = await q.limit(1)
    recordId = existing?.[0]?.id
  }

  if (recordId) {
    await supabase
      .from('training_records')
      .update({
        completed_at: new Date().toISOString(),
      })
      .eq('id', recordId)
    record = { id: recordId }
  } else {
    const { data: inserted, error: insErr } = await supabase
      .from('training_records')
      .insert({
        user_id: userId,
        record_date: dateStr,
        exercise_type_id: exerciseTypeId,
        schedule_id: scheduleId || null,
        personal_schedule_id: personalScheduleId || null,
        team_id: teamId || null,
        completed_at: new Date().toISOString(),
      })
      .select()
      .single()
    if (insErr) throw insErr
    record = inserted
  }

  await supabase
    .from('training_record_details')
    .delete()
    .eq('training_record_id', record.id)
    .eq('detail_type', detailType)

  await supabase.from('training_record_details').insert({
    training_record_id: record.id,
    detail_type: detailType,
    payload: typeof payload === 'object' ? payload : {},
  })

  return record
}

// 오늘 훈련 기록 삭제 (recordId 우선, 없으면 userId/recordDate/exerciseTypeId로)
export async function deleteTodayTrainingRecord({ userId, recordDate, exerciseTypeId, recordId, scheduleId, personalScheduleId }) {
  if (recordId) {
    const { error } = await supabase.from('training_records').delete().eq('id', recordId)
    if (error) throw error
    return
  }
  let q = supabase.from('training_records').delete().eq('user_id', userId).eq('record_date', toDateStringKST(recordDate)).eq('exercise_type_id', exerciseTypeId)
  if (scheduleId) q = q.eq('schedule_id', scheduleId)
  else if (personalScheduleId) q = q.eq('personal_schedule_id', personalScheduleId)
  else q = q.is('schedule_id', null).is('personal_schedule_id', null)
  const { error } = await q
  if (error) throw error
}

// 운동로그: 사용자 훈련 기록을 종목별·날짜별 차트 데이터로 변환
export function useTrainingLogChartData() {
  const { user } = useAuth()
  const [data, setData] = useState({ finger: [], power_bouldering: [], endurance: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) {
      setData({ finger: [], power_bouldering: [], endurance: [] })
      setLoading(false)
      return
    }
    supabase
      .from('training_records')
      .select(`
        record_date,
        exercise_types(day_type_id),
        training_record_details(detail_type, payload)
      `)
      .eq('user_id', user.id)
      .order('record_date', { ascending: true })
      .then(({ data: rows, error }) => {
        const byType = { finger: [], power_bouldering: [], endurance: [] }
        if (!error && rows) {
          rows.forEach((r) => {
            const dayType = r.exercise_types?.day_type_id
            const details = r.training_record_details ?? []
            const detail = Array.isArray(details) ? details[0] : details
            const payload = detail?.payload ?? {}
            const value = getChartValueFromPayload(dayType, detail?.detail_type, payload)
            if (value == null) return
            if (dayType === 'finger') byType.finger.push({ date: r.record_date, value })
            else if (dayType === 'power_bouldering') byType.power_bouldering.push({ date: r.record_date, value })
            else if (dayType === 'endurance') byType.endurance.push({ date: r.record_date, value })
          })
        }
        setData(byType)
        setLoading(false)
      })
  }, [user?.id])

  return { data, loading }
}

function getChartValueFromPayload(dayType, detailType, payload) {
  if (detailType === 'training_sets' && Array.isArray(payload.completedSets)) {
    return payload.completedSets.length
  }
  if (detailType === 'training_sets_squares' && payload && typeof payload === 'object') {
    let total = 0
    Object.values(payload).forEach((arr) => {
      if (Array.isArray(arr)) total += arr.filter(Boolean).length
    })
    return total
  }
  return null
}

// 장소별 난이도 색상 (색깔 + V급) - 운동장소마다 다름
export function usePlaceDifficultyColors(placeId) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!placeId) {
      setData([])
      setLoading(false)
      return
    }
    supabase
      .from('place_difficulty_colors')
      .select('id, color_hex, grade_label, sort_order')
      .eq('place_id', placeId)
      .order('sort_order', { ascending: true })
      .then(({ data: rows }) => {
        setData(rows ?? [])
        setLoading(false)
      })
  }, [placeId])

  return { data, loading }
}

// 해당 장소에서의 가장 최근 원정 기록 (오늘 제외) - 상위 2개 난이도만 사용
export function useLatestExpeditionRecordByPlace(userId, placeId, expeditionExerciseTypeId) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const todayStr = getTodayKST()

  useEffect(() => {
    if (!userId || !placeId || !expeditionExerciseTypeId) {
      setData(null)
      setLoading(false)
      return
    }
    let cancelled = false
    supabase
      .from('schedules')
      .select('id')
      .eq('place_id', placeId)
      .then(({ data: scheds }) => {
        if (cancelled) return
        const scheduleIds = (scheds ?? []).map((s) => s.id)
        if (scheduleIds.length === 0) {
          setData(null)
          setLoading(false)
          return Promise.resolve(null)
        }
        return supabase
          .from('training_records')
          .select(`
            id,
            record_date,
            training_record_details(detail_type, payload)
          `)
          .eq('user_id', userId)
          .eq('exercise_type_id', expeditionExerciseTypeId)
          .lt('record_date', todayStr)
          .in('schedule_id', scheduleIds)
          .order('record_date', { ascending: false })
          .limit(1)
      })
      .then((res) => {
        if (cancelled || !res) return
        const rows = res.data ?? []
        const row = Array.isArray(rows) ? rows[0] : rows
        const details = row?.training_record_details ?? []
        const detail = Array.isArray(details) ? details[0] : details
        setData(
          detail?.detail_type === 'expedition_climbs' && detail?.payload
            ? { payload: detail.payload, recordDate: row?.record_date }
            : null
        )
        setLoading(false)
      })
      .catch(() => !cancelled && setLoading(false))

    return () => { cancelled = true }
  }, [userId, placeId, expeditionExerciseTypeId, todayStr])

  return { data, loading }
}

// '원정가는 날' 운동 종류 id 조회 (장소만 선택했을 때 일정 저장용)
export async function getExpeditionExerciseTypeId() {
  const { data, error } = await supabase
    .from('exercise_types')
    .select('id')
    .eq('day_type_id', 'expedition')
    .maybeSingle()
  if (error) throw error
  return data?.id ?? null
}

// 일정 추가 (관리자) - 1건 insert (복수 허용)
export async function createSchedule({ date, exerciseTypeId, placeId, teamId }) {
  if (!teamId) throw new Error('teamId is required')
  const dateStr = `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
  const { data, error } = await supabase
    .from('schedules')
    .insert({ date: dateStr, exercise_type_id: exerciseTypeId, place_id: placeId || null, team_id: teamId })
    .select()
    .single()
  if (error) throw error
  return data
}

// 일정 복수 추가 (관리자)
export async function createSchedules(teamId, date, items) {
  if (!teamId || !items?.length) return []
  const dateStr = `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
  const rows = items.map(({ exerciseTypeId, placeId }) => ({
    date: dateStr,
    exercise_type_id: exerciseTypeId,
    place_id: placeId ?? null,
    team_id: teamId,
  }))
  const { data, error } = await supabase.from('schedules').insert(rows).select()
  if (error) throw error
  return data ?? []
}

// =====================================================
// 스프레이월 (문제내기)
// =====================================================

export function useSprayWallProblems(userId, type = null) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(() => {
    if (!userId) {
      setData([])
      setLoading(false)
      return
    }
    setLoading(true)
    let q = supabase
      .from('spray_wall_problems')
      .select('id, name, type, image_data, tags, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (type && (type === 'bouldering' || type === 'endurance')) {
      q = q.eq('type', type)
    }
    q.then(({ data: rows, error }) => {
      if (error) {
        console.error('spray wall fetch error:', error)
        setData([])
      } else {
        setData((rows ?? []).map((r) => ({
          ...r,
          tags: Array.isArray(r.tags) ? r.tags : (r.tags ? JSON.parse(r.tags || '[]') : []),
        })))
      }
      setLoading(false)
    })
  }, [userId, type])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, loading, refetch }
}

export async function saveSprayWallProblem({ userId, name, type, imageData, tags = [] }) {
  const { data, error } = await supabase
    .from('spray_wall_problems')
    .insert({
      user_id: userId,
      name: name.trim(),
      type,
      image_data: imageData,
      tags: Array.isArray(tags) ? tags : [],
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateSprayWallProblemTags(problemId, tags) {
  const { data, error } = await supabase
    .from('spray_wall_problems')
    .update({
      tags: Array.isArray(tags) ? tags : [],
      updated_at: new Date().toISOString(),
    })
    .eq('id', problemId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteSprayWallProblem(problemId) {
  const { error } = await supabase
    .from('spray_wall_problems')
    .delete()
    .eq('id', problemId)
  if (error) throw error
}
