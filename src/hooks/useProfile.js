/**
 * 프로필 편집, 팀 참가 신청
 */
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export async function updateProfile(userId, { nickname, boast_info }) {
  const payload = {}
  if (nickname !== undefined) payload.nickname = nickname
  if (boast_info !== undefined) payload.boast_info = boast_info
  payload.updated_at = new Date().toISOString()

  const { error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', userId)
  if (error) throw error
}

// 참여 원정 횟수: training_records where exercise_types.day_type_id = 'expedition'
export function useExpeditionCount(userId) {
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setCount(0)
      setLoading(false)
      return
    }
    supabase
      .from('training_records')
      .select('id, exercise_types(day_type_id)')
      .eq('user_id', userId)
      .then(({ data: rows }) => {
        const n = (rows ?? []).filter((r) => r.exercise_types?.day_type_id === 'expedition').length
        setCount(n)
        setLoading(false)
      })
      .catch(() => {
        setCount(0)
        setLoading(false)
      })
  }, [userId])

  return { count, loading }
}

// 참여 운동 횟수: training_records where exercise_types.day_type_id != 'expedition'
export function useExerciseCount(userId) {
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setCount(0)
      setLoading(false)
      return
    }
    supabase
      .from('training_records')
      .select('id, exercise_types(day_type_id)')
      .eq('user_id', userId)
      .then(({ data: rows }) => {
        const n = (rows ?? []).filter((r) => {
          const dt = r.exercise_types?.day_type_id
          return dt && dt !== 'expedition'
        }).length
        setCount(n)
        setLoading(false)
      })
      .catch(() => {
        setCount(0)
        setLoading(false)
      })
  }, [userId])

  return { count, loading }
}

// 훈련생: 내가 보낸 팀 참가 신청
export function useMyTeamJoinRequests() {
  const { user } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(() => {
    if (!user?.id) {
      setData([])
      setLoading(false)
      return
    }
    supabase
      .from('team_join_requests')
      .select('id, to_team_id, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(3)
      .then(({ data: rows }) => {
        setData(rows ?? [])
        setLoading(false)
      })
      .catch(() => {
        setData([])
        setLoading(false)
      })
  }, [user?.id])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, loading, refetch }
}

// 팀 관리자: 내 팀(to_team_id)으로 들어온 참가 신청
export function useReceivedTeamJoinRequests() {
  const { teamId, isAdmin, isSupervisor } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(() => {
    if (!teamId || (!isAdmin && !isSupervisor)) {
      setData([])
      setLoading(false)
      return
    }
    const run = async () => {
      const { data: rpcRows, error: rpcErr } = await supabase.rpc('get_team_join_requests_with_names', { p_team_id: teamId })
      if (!rpcErr && rpcRows != null) {
        setData(rpcRows)
        setLoading(false)
        return
      }
      // RPC 미적용 시 team_join_requests 직접 조회
      const { data: rows2, error: err2 } = await supabase
        .from('team_join_requests')
        .select('id, user_id, from_team_id, to_team_id, status, created_at')
        .eq('to_team_id', teamId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      if (err2) throw err2
      setData((rows2 ?? []).map((r) => ({ ...r, user_nickname: '사용자' })))
      setLoading(false)
    }
    run().catch(() => {
      setData([])
      setLoading(false)
    })
  }, [teamId, isAdmin, isSupervisor])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, loading, refetch }
}

export async function sendTeamJoinRequest(userId, fromTeamId, toTeamId) {
  const { error } = await supabase.rpc('send_team_join_request', {
    p_user_id: userId,
    p_from_team_id: fromTeamId,
    p_to_team_id: toTeamId,
  })
  if (error) {
    const msg = error.message ?? ''
    if (/이미 신청한 팀|이미 승인된 팀|이미 다른 팀에 신청|같은 팀/.test(msg)) {
      throw new Error(msg)
    }
    throw new Error(msg || '신청에 실패했습니다.')
  }
}

export async function acceptTeamJoinRequest(requestId) {
  const { error } = await supabase.rpc('accept_team_join_request', { request_id: requestId })
  if (error) throw error
}

export async function rejectTeamJoinRequest(requestId) {
  const { error } = await supabase.rpc('reject_team_join_request', { request_id: requestId })
  if (error) throw error
}

export async function cancelTeamJoinRequest(requestId) {
  const { error } = await supabase.rpc('cancel_team_join_request', { p_request_id: requestId })
  if (error) throw error
}
