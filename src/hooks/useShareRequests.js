/**
 * 팀 일정 공유 요청 (신청 → 동의)
 */
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// 요청 가능한 팀 (내 팀 제외) - 이미 공유/요청된 팀은 UI에서 숨김
export function useAllTeamsForRequest() {
  const { teamId } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(() => {
    if (!teamId) {
      setData([])
      setLoading(false)
      return
    }
    setLoading(true)
    supabase
      .from('teams')
      .select('id, name')
      .neq('id', teamId)
      .order('name')
      .then(({ data: rows }) => {
        setData(rows ?? [])
        setLoading(false)
      })
      .catch(() => {
        setData([])
        setLoading(false)
      })
  }, [teamId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, loading, refetch }
}

// 받은 요청 (우리 팀이 to_team인 pending 요청)
export function useReceivedShareRequests() {
  const { teamId } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(() => {
    if (!teamId) {
      setData([])
      setLoading(false)
      return
    }
    setLoading(true)
    supabase
      .from('team_share_requests')
      .select('id, from_team_id, to_team_id, status, created_at')
      .eq('to_team_id', teamId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .then(({ data: rows }) => {
        setData(rows ?? [])
        setLoading(false)
      })
      .catch(() => {
        setData([])
        setLoading(false)
      })
  }, [teamId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, loading, refetch }
}

// 보낸 요청 (우리 팀이 from_team인 요청)
export function useSentShareRequests() {
  const { teamId } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(() => {
    if (!teamId) {
      setData([])
      setLoading(false)
      return
    }
    setLoading(true)
    supabase
      .from('team_share_requests')
      .select('id, from_team_id, to_team_id, status, created_at')
      .eq('from_team_id', teamId)
      .order('created_at', { ascending: false })
      .then(({ data: rows }) => {
        setData(rows ?? [])
        setLoading(false)
      })
      .catch(() => {
        setData([])
        setLoading(false)
      })
  }, [teamId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, loading, refetch }
}

// 공유 중인 팀
export function useSharedTeams() {
  const { teamId } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(() => {
    if (!teamId) {
      setData([])
      setLoading(false)
      return
    }
    setLoading(true)
    supabase
      .from('team_schedule_shares')
      .select('id, team_id, shared_with_team_id')
      .or(`team_id.eq.${teamId},shared_with_team_id.eq.${teamId}`)
      .then(({ data: rows }) => {
        const otherTeamIds = new Set()
        ;(rows ?? []).forEach((r) => {
          const other = r.team_id === teamId ? r.shared_with_team_id : r.team_id
          otherTeamIds.add(other)
        })
        if (otherTeamIds.size === 0) {
          setData([])
          setLoading(false)
          return
        }
        supabase
          .from('teams')
          .select('id, name')
          .in('id', [...otherTeamIds])
          .then(({ data: teams }) => {
            setData(teams ?? [])
            setLoading(false)
          })
          .catch(() => {
            setData([])
            setLoading(false)
          })
      })
      .catch(() => {
        setData([])
        setLoading(false)
      })
  }, [teamId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, loading, refetch }
}

// 일정공유 뱃지 (받은 요청 pending 있음 / 공유 승인·해제로 변경됨)
const STORAGE_KEY = 'shareModalLastSeenSharedCount'

export function useShareBadge() {
  const { data: received } = useReceivedShareRequests()
  const { data: shared } = useSharedTeams()
  const lastSeen = parseInt(localStorage.getItem(STORAGE_KEY) ?? '-1', 10)
  const hasPendingReceived = (received?.length ?? 0) > 0
  const sharedCount = shared?.length ?? 0
  const hasShareChanges = lastSeen >= 0 && sharedCount !== lastSeen
  return { hasBadge: hasPendingReceived || hasShareChanges, sharedCount }
}

export function markShareModalSeen(sharedCount) {
  localStorage.setItem(STORAGE_KEY, String(sharedCount ?? 0))
}

// 공유 요청 보내기 (이전에 승인/거절/해제된 팀이라도 다시 요청 가능 - RPC로 insert or update)
export async function sendShareRequest(fromTeamId, toTeamId) {
  const { data, error } = await supabase.rpc('send_share_request', {
    p_from_team_id: fromTeamId,
    p_to_team_id: toTeamId,
  })
  if (error) throw error
  return data
}

// 공유 요청 승인 (RPC로 DB에서 양방향 공유 생성 + 요청 상태 갱신)
export async function acceptShareRequest(requestId) {
  const { error } = await supabase.rpc('accept_share_request', { request_id: requestId })
  if (error) throw error
}

// 공유 요청 거절
export async function rejectShareRequest(requestId) {
  const { error } = await supabase
    .from('team_share_requests')
    .update({ status: 'rejected', updated_at: new Date().toISOString() })
    .eq('id', requestId)
  if (error) throw error
}

// 공유 해제 (RPC - 양쪽 팀 중 한쪽이라도 요청하면 양방향 해제)
export async function removeTeamShare(teamIdA, teamIdB) {
  const { error } = await supabase.rpc('remove_team_share', {
    team_id_a: teamIdA,
    team_id_b: teamIdB,
  })
  if (error) throw error
}
