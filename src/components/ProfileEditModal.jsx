import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  updateProfile,
  useExpeditionCount,
  useExerciseCount,
  useMyTeamJoinRequests,
  useReceivedTeamJoinRequests,
  sendTeamJoinRequest,
  acceptTeamJoinRequest,
  rejectTeamJoinRequest,
  cancelTeamJoinRequest,
} from '../hooks/useProfile'
import './ProfileEditModal.css'

export default function ProfileEditModal({ onClose, onSuccess }) {
  const { user, profile, teamId, isAdmin, isSupervisor } = useAuth()
  const [nickname, setNickname] = useState(profile?.nickname || profile?.display_name || '')
  const [boastInfo, setBoastInfo] = useState(profile?.boast_info || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false)
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [sendingJoin, setSendingJoin] = useState(false)
  const [actioning, setActioning] = useState(null)
  const [cancellingId, setCancellingId] = useState(null)
  const dropdownRef = useRef(null)

  const { count: expeditionCount, loading: expeditionLoading } = useExpeditionCount(user?.id)
  const { count: exerciseCount, loading: exerciseLoading } = useExerciseCount(user?.id)
  const { data: myJoinRequests, refetch: refetchMy } = useMyTeamJoinRequests()
  const { data: receivedJoinRequests, refetch: refetchReceived } = useReceivedTeamJoinRequests()

  const canChangeTeam = !isAdmin && !isSupervisor
  const canManageJoinRequests = isAdmin || isSupervisor

  const [teams, setTeams] = useState([])
  useEffect(() => {
    supabase.from('teams').select('id, name').order('name').then(({ data }) => {
      setTeams(data ?? [])
    })
  }, [])

  useEffect(() => {
    setNickname(profile?.nickname || profile?.display_name || '')
    setBoastInfo(profile?.boast_info || '')
  }, [profile])

  useEffect(() => {
    const fn = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setTeamDropdownOpen(false)
      }
    }
    if (teamDropdownOpen) {
      document.addEventListener('mousedown', fn)
      return () => document.removeEventListener('mousedown', fn)
    }
  }, [teamDropdownOpen])

  const otherTeams = teams.filter((t) => t.id !== teamId)
  const hasPending = (team) => myJoinRequests.some((r) => r.to_team_id === team.id && r.status === 'pending')

  const handleSave = async () => {
    setError('')
    setSubmitting(true)
    try {
      await updateProfile(user.id, { nickname: nickname.trim() || null, boast_info: boastInfo.trim() || null })
      onSuccess?.()
      alert('저장되었습니다.')
    } catch (err) {
      setError(err.message ?? '저장에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleTeamJoin = async () => {
    if (!selectedTeamId || !user?.id || !teamId) return
    setSendingJoin(true)
    try {
      await sendTeamJoinRequest(user.id, teamId, selectedTeamId)
      await refetchMy()
      setSelectedTeamId('')
      alert('팀 참가 신청을 보냈습니다. 팀 관리자의 승인을 기다려 주세요.')
    } catch (err) {
      await refetchMy()
      alert(err.message ?? '신청에 실패했습니다.')
    } finally {
      setSendingJoin(false)
    }
  }

  const handleAcceptJoin = async (requestId) => {
    setActioning(requestId)
    try {
      await acceptTeamJoinRequest(requestId)
      refetchReceived()
      alert('승인되었습니다. 프로필이 갱신됩니다.')
      onSuccess?.()
    } catch (err) {
      alert(err.message ?? '승인에 실패했습니다.')
    } finally {
      setActioning(null)
    }
  }

  const handleRejectJoin = async (requestId) => {
    setActioning(requestId)
    try {
      await rejectTeamJoinRequest(requestId)
      refetchReceived()
      alert('거절되었습니다.')
    } catch (err) {
      alert(err.message ?? '거절에 실패했습니다.')
    } finally {
      setActioning(null)
    }
  }

  const handleCancelJoin = async (requestId) => {
    setCancellingId(requestId)
    try {
      await cancelTeamJoinRequest(requestId)
      await refetchMy()
      alert('신청이 취소되었습니다.')
    } catch (err) {
      alert(err.message ?? '취소에 실패했습니다.')
    } finally {
      setCancellingId(null)
    }
  }

  // RPC가 user_nickname을 포함해 반환하므로 별도 조회 불필요

  return (
    <div className="profile-edit-modal" role="dialog" aria-modal="true" aria-labelledby="profile-edit-title">
      <div className="profile-edit-modal__backdrop" onClick={onClose} aria-hidden />
      <div className="profile-edit-modal__panel">
        <div className="profile-edit-modal__header">
          <h2 id="profile-edit-title" className="profile-edit-modal__title">프로필 편집</h2>
          <button type="button" className="profile-edit-modal__close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        <section className="profile-edit-modal__section">
          <label className="profile-edit-modal__label">닉네임</label>
          <input
            type="text"
            className="profile-edit-modal__input"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="닉네임을 입력하세요"
          />
        </section>

        <section className="profile-edit-modal__section">
          <label className="profile-edit-modal__label">뽐내기 정보</label>
          <textarea
            className="profile-edit-modal__textarea"
            value={boastInfo}
            onChange={(e) => setBoastInfo(e.target.value)}
            placeholder="과거 난이도 몇까지 풀었는지 등 자유롭게 적어보세요."
            rows={4}
          />
        </section>

        <section className="profile-edit-modal__section profile-edit-modal__section--readonly">
          <label className="profile-edit-modal__label">참여 원정 횟수</label>
          <p className="profile-edit-modal__value">{expeditionLoading ? '...' : `${expeditionCount}회`}</p>
        </section>

        <section className="profile-edit-modal__section profile-edit-modal__section--readonly">
          <label className="profile-edit-modal__label">참여 운동 횟수</label>
          <p className="profile-edit-modal__value">{exerciseLoading ? '...' : `${exerciseCount}회`}</p>
        </section>

        {canChangeTeam && (
          <>
          <section className="profile-edit-modal__section">
            <label className="profile-edit-modal__label">팀 바꾸기</label>
            <div className="profile-edit-modal__team-row" ref={dropdownRef}>
              <div className="profile-edit-modal__dropdown">
                <button
                  type="button"
                  className="profile-edit-modal__dropdown-btn"
                  onClick={() => setTeamDropdownOpen((v) => !v)}
                >
                  {selectedTeamId ? teams.find((t) => t.id === selectedTeamId)?.name ?? '팀 선택' : '팀 선택'}
                  <span>{teamDropdownOpen ? '▲' : '▼'}</span>
                </button>
                {teamDropdownOpen && (
                  <ul className="profile-edit-modal__dropdown-list">
                    {otherTeams.map((t) => {
                      const pending = hasPending(t)
                      return (
                        <li key={t.id}>
                          <button
                            type="button"
                            className={pending ? 'profile-edit-modal__team-pending' : undefined}
                            disabled={pending}
                            onClick={() => {
                              if (!pending) {
                                setSelectedTeamId(t.id)
                                setTeamDropdownOpen(false)
                              }
                            }}
                          >
                            {t.name}
                            {pending && ' (신청중)'}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
              <button
                type="button"
                className="profile-edit-modal__btn profile-edit-modal__btn--primary"
                onClick={handleTeamJoin}
                disabled={!selectedTeamId || sendingJoin || hasPending({ id: selectedTeamId })}
              >
                {sendingJoin ? '신청 중...' : '신청'}
              </button>
            </div>
          </section>
          <section className="profile-edit-modal__section">
            <label className="profile-edit-modal__label">팀 신청 상황</label>
            {myJoinRequests.length === 0 ? (
              <p className="profile-edit-modal__empty">신청한 팀이 없습니다.</p>
            ) : (
              <ul className="profile-edit-modal__status-list">
                {myJoinRequests.map((r) => {
                  const teamName = teams.find((t) => t.id === r.to_team_id)?.name ?? '팀'
                  const statusText = r.status === 'pending' ? '승인 대기' : r.status === 'accepted' ? '승인됨' : '거절됨'
                  return (
                    <li key={r.id} className={`profile-edit-modal__status-item profile-edit-modal__status-item--${r.status}`}>
                      <span className="profile-edit-modal__status-team">{teamName}</span>
                      <div className="profile-edit-modal__status-row">
                        <span className="profile-edit-modal__status-badge">{statusText}</span>
                        {r.status === 'pending' && (
                          <button
                            type="button"
                            className="profile-edit-modal__btn profile-edit-modal__btn--cancel"
                            onClick={() => handleCancelJoin(r.id)}
                            disabled={cancellingId === r.id}
                          >
                            {cancellingId === r.id ? '취소 중...' : '신청 취소'}
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
          </>
        )}

        {canManageJoinRequests && (
          <section className="profile-edit-modal__section">
            <label className="profile-edit-modal__label">팀 참가 신청 관리</label>
            {receivedJoinRequests.length === 0 ? (
              <p className="profile-edit-modal__empty">들어온 신청이 없습니다.</p>
            ) : (
              <ul className="profile-edit-modal__request-list">
                {receivedJoinRequests.map((r) => (
                  <li key={r.id} className="profile-edit-modal__request-item">
                    <span>{r.user_nickname ?? r.user_id}</span>
                    <div className="profile-edit-modal__request-actions">
                      <button
                        type="button"
                        className="profile-edit-modal__btn profile-edit-modal__btn--accept"
                        onClick={() => handleAcceptJoin(r.id)}
                        disabled={actioning === r.id}
                      >
                        {actioning === r.id ? '처리 중...' : '승인'}
                      </button>
                      <button
                        type="button"
                        className="profile-edit-modal__btn profile-edit-modal__btn--reject"
                        onClick={() => handleRejectJoin(r.id)}
                        disabled={actioning === r.id}
                      >
                        거절
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {error && <p className="profile-edit-modal__error">{error}</p>}

        <button
          type="button"
          className="profile-edit-modal__submit"
          onClick={handleSave}
          disabled={submitting}
        >
          {submitting ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  )
}
