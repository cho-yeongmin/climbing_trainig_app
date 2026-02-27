/**
 * 팀 간 일정 공유 설정 (관리자용)
 * team_schedule_shares 테이블 조회/추가/삭제
 */
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// 공유 가능한 팀 목록 (내 팀 제외)
export function useTeamsForShare() {
  const { teamId } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!teamId) {
      setData([])
      setLoading(false)
      return
    }
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

  return { data, loading }
}

// 현재 팀의 공유 목록 (우리 팀이 공유한 + 우리 팀과 공유한)
export function useTeamScheduleShares() {
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

export async function createTeamScheduleShare(teamId, sharedWithTeamId) {
  const { data, error } = await supabase
    .from('team_schedule_shares')
    .insert({
      team_id: teamId,
      shared_with_team_id: sharedWithTeamId,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// 양방향 공유 (A↔B)
export async function createBidirectionalShare(teamIdA, teamIdB) {
  await createTeamScheduleShare(teamIdA, teamIdB)
  await createTeamScheduleShare(teamIdB, teamIdA)
}

export async function deleteTeamScheduleShare(id) {
  const { error } = await supabase.from('team_schedule_shares').delete().eq('id', id)
  if (error) throw error
}
