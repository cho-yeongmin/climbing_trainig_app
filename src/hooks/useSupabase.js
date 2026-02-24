import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

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

// 일정 (월별)
export function useSchedules(year, month) {
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(() => {
    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = new Date(year, month, 0)
    const end = `${year}-${String(month).padStart(2, '0')}-${endDate.getDate()}`
    setLoading(true)
    supabase
      .from('schedules')
      .select(`
        date,
        exercise_type_id,
        place_id,
        exercise_types(id, day_type_id, name, image_url),
        places(id, name, address, image_url)
      `)
      .gte('date', start)
      .lte('date', end)
      .then(({ data: rows }) => {
        const map = {}
        ;(rows ?? []).forEach((r) => {
          const d = r.date
          map[d] = {
            date: d,
            exerciseType: r.exercise_types,
            place: r.places,
          }
        })
        setData(map)
        setLoading(false)
      })
  }, [year, month])

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

// 다가오는 원정 일정 (가장 가까운 미래의 expedition 스케줄 1건)
export function useNextExpedition() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10)
    setLoading(true)
    supabase
      .from('schedules')
      .select(`
        date,
        places(id, name, address),
        exercise_types(day_type_id)
      `)
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(50)
      .then(({ data: rows }) => {
        const next = (rows ?? []).find((r) => r.exercise_types?.day_type_id === 'expedition')
        setData(next ?? null)
        setLoading(false)
      })
  }, [])

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

function normalizeNextExpedition(row) {
  const dateStr = row.date
  const place = row.places
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  const diffMs = d - today
  const daysUntil = Math.round(diffMs / (24 * 60 * 60 * 1000))
  const weekdays = ['일', '월', '화', '수', '목', '금', '토']
  const y = d.getFullYear().toString().slice(-2)
  const m = d.getMonth() + 1
  const day = d.getDate()
  const week = weekdays[d.getDay()]
  const dateLabel = `${y}년 ${m}월 ${day}일 ${week}요일`
  return {
    date: dateStr,
    dateLabel,
    daysUntil,
    placeName: place?.name ?? '',
    placeAddress: place?.address ?? '',
  }
}

// 오늘 일정
export function useTodaySchedule() {
  const today = new Date().toISOString().slice(0, 10)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(() => {
    setLoading(true)
    supabase
      .from('schedules')
      .select(`
        id,
        date,
        exercise_type_id,
        place_id,
        exercise_types(id, day_type_id, name, image_url, config),
        places(id, name, address, image_url)
      `)
      .eq('date', today)
      .maybeSingle()
      .then(({ data: row }) => {
        setData(row)
        setLoading(false)
      })
  }, [today])

  useEffect(() => {
    refetch()
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

// 오늘의 훈련 기록 조회 (날짜 + 운동유형 기준)
export function useTodayTrainingRecord(userId, recordDate, exerciseTypeId) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const dateStr = recordDate
    ? (typeof recordDate === 'string'
      ? recordDate
      : recordDate.toISOString().slice(0, 10))
    : null

  const refetch = useCallback(() => {
    if (!userId || !dateStr || !exerciseTypeId) {
      setData(null)
      setLoading(false)
      return Promise.resolve()
    }
    setLoading(true)
    return supabase
      .from('training_records')
      .select(`
        id,
        training_record_details(detail_type, payload)
      `)
      .eq('user_id', userId)
      .eq('record_date', dateStr)
      .eq('exercise_type_id', exerciseTypeId)
      .maybeSingle()
      .then(({ data: row }) => {
        const details = row?.training_record_details ?? []
        const detail = Array.isArray(details) ? details[0] : details
        setData(detail ? { detailType: detail.detail_type, payload: detail.payload ?? {} } : null)
        setLoading(false)
      })
  }, [userId, dateStr, exerciseTypeId])

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
    ? (typeof beforeDate === 'string' ? beforeDate : beforeDate.toISOString().slice(0, 10))
    : new Date().toISOString().slice(0, 10)

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

// 훈련 기록 저장
export async function saveTrainingRecord({
  userId,
  recordDate,
  exerciseTypeId,
  scheduleId,
  detailType,
  payload,
}) {
  const dateStr = typeof recordDate === 'string'
    ? recordDate
    : recordDate.toISOString().slice(0, 10)

  const { data: record, error: recordError } = await supabase
    .from('training_records')
    .upsert(
      {
        user_id: userId,
        record_date: dateStr,
        exercise_type_id: exerciseTypeId,
        schedule_id: scheduleId || null,
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,record_date,exercise_type_id' }
    )
    .select()
    .single()

  if (recordError) throw recordError

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

// 오늘 훈련 기록 삭제
export async function deleteTodayTrainingRecord({ userId, recordDate, exerciseTypeId }) {
  const dateStr = typeof recordDate === 'string'
    ? recordDate
    : recordDate.toISOString().slice(0, 10)

  const { error } = await supabase
    .from('training_records')
    .delete()
    .eq('user_id', userId)
    .eq('record_date', dateStr)
    .eq('exercise_type_id', exerciseTypeId)

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

// 일정 추가 (관리자)
export async function createSchedule({ date, exerciseTypeId, placeId }) {
  const dateStr = `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
  const { data, error } = await supabase
    .from('schedules')
    .upsert(
      { date: dateStr, exercise_type_id: exerciseTypeId, place_id: placeId || null },
      { onConflict: 'date' }
    )
    .select()
    .single()
  if (error) throw error
  return data
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
