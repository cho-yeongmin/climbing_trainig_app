import { useState, useMemo, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  useReceivedShareRequests,
  useSentShareRequests,
  useSharedTeams,
  useAllTeamsForRequest,
  sendShareRequest,
  acceptShareRequest,
  rejectShareRequest,
  removeTeamShare,
  markShareModalSeen,
} from '../hooks/useShareRequests'
import './ShareRequestView.css'

const STATUS_LABEL = { pending: '대기 중', accepted: '승인됨', rejected: '거절됨' }

export default function ShareRequestView() {
  const { teamId, isAdmin, isSupervisor } = useAuth()
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)
  const [sending, setSending] = useState(false)
  const [actioning, setActioning] = useState(null)

  const { data: allTeams, refetch: refetchTeams } = useAllTeamsForRequest()
  const { data: received, loading: receivedLoading, refetch: refetchReceived } = useReceivedShareRequests()
  const { data: sent, loading: sentLoading, refetch: refetchSent } = useSentShareRequests()
  const { data: shared, loading: sharedLoading, refetch: refetchShared } = useSharedTeams()

  const canManage = isAdmin || isSupervisor

  const sharedIds = useMemo(() => new Set(shared.map((t) => t.id)), [shared])
  const sentToIds = useMemo(() => new Set(sent.filter((s) => s.status === 'pending').map((s) => s.to_team_id)), [sent])
  const receivedFromIds = useMemo(() => new Set(received.map((r) => r.from_team_id)), [received])

  const requestableTeams = useMemo(
    () =>
      allTeams.filter(
        (t) => !sharedIds.has(t.id) && !sentToIds.has(t.id) && !receivedFromIds.has(t.id)
      ),
    [allTeams, sharedIds, sentToIds, receivedFromIds]
  )

  const [teamMap, setTeamMap] = useState({})
  const allTeamIds = useMemo(() => {
    const ids = new Set()
    allTeams.forEach((t) => ids.add(t.id))
    shared.forEach((t) => ids.add(t.id))
    received.forEach((r) => ids.add(r.from_team_id))
    sent.forEach((s) => ids.add(s.to_team_id))
    return [...ids]
  }, [allTeams, shared, received, sent])

  useEffect(() => {
    if (allTeamIds.length === 0) return
    const m = {}
    allTeams.forEach((t) => { m[t.id] = t.name })
    shared.forEach((t) => { m[t.id] = t.name })
    const missing = allTeamIds.filter((id) => !m[id])
    if (missing.length === 0) {
      setTeamMap(m)
      return
    }
    supabase
      .from('teams')
      .select('id, name')
      .in('id', missing)
      .then(({ data: rows }) => {
        rows?.forEach((r) => { m[r.id] = r.name })
        setTeamMap(m)
      })
  }, [allTeamIds, allTeams, shared])

  // 모달 열릴 때(이 뷰 마운트 시) 공유 목록 상태를 '확인함'으로 기록 → 뱃지 해제
  useEffect(() => {
    if (shared) {
      markShareModalSeen(shared.length)
    }
  }, [shared])

  useEffect(() => {
    const fn = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', fn)
      document.addEventListener('touchstart', fn)
      return () => {
        document.removeEventListener('mousedown', fn)
        document.removeEventListener('touchstart', fn)
      }
    }
  }, [dropdownOpen])

  const handleSend = async () => {
    if (!selectedTeamId || !teamId) return
    setSending(true)
    try {
      await sendShareRequest(teamId, selectedTeamId)
      setSelectedTeamId('')
      refetchSent()
      refetchTeams()
      alert('공유 요청을 보냈습니다.')
    } catch (err) {
      alert(err.message ?? '요청 전송에 실패했습니다.')
    } finally {
      setSending(false)
    }
  }

  const handleAccept = async (requestId) => {
    setActioning(requestId)
    try {
      await acceptShareRequest(requestId)
      refetchReceived()
      refetchShared()
      refetchTeams()
      alert('공유가 시작되었습니다. 일정확인 탭에서 해당 팀 일정을 조회할 수 있습니다.')
    } catch (err) {
      alert(err.message ?? '승인에 실패했습니다.')
    } finally {
      setActioning(null)
    }
  }

  const handleReject = async (requestId) => {
    setActioning(requestId)
    try {
      await rejectShareRequest(requestId)
      refetchReceived()
      refetchTeams()
      alert('요청을 거절했습니다.')
    } catch (err) {
      alert(err.message ?? '거절에 실패했습니다.')
    } finally {
      setActioning(null)
    }
  }

  const handleRemoveShare = async (otherTeamId) => {
    if (!confirm('정말 공유를 해제할까요?')) return
    setActioning(otherTeamId)
    try {
      await removeTeamShare(teamId, otherTeamId)
      refetchShared()
      refetchTeams()
      alert('공유가 해제되었습니다.')
    } catch (err) {
      alert(err.message ?? '해제에 실패했습니다.')
    } finally {
      setActioning(null)
    }
  }

  if (!teamId) {
    return (
      <div className="share-request-view">
        <p className="share-request-view__empty">팀에 소속되어 있지 않습니다.</p>
      </div>
    )
  }

  if (!canManage) {
    return (
      <div className="share-request-view">
        <p className="share-request-view__empty">팀 관리자만 일정 공유를 설정할 수 있습니다.</p>
      </div>
    )
  }

  return (
    <div className="share-request-view">
      <section className="share-request-view__section">
        <h2 className="share-request-view__title">공유 요청 보내기</h2>
        <p className="share-request-view__desc">다른 팀과 일정을 서로 조회하려면 요청을 보내주세요.</p>
        <div className="share-request-view__send-row">
          <div className="share-request-view__dropdown-wrap" ref={dropdownRef}>
            <button
              type="button"
              className="share-request-view__select-btn"
              onClick={() => setDropdownOpen((v) => !v)}
              aria-label="요청할 팀 선택"
              aria-expanded={dropdownOpen}
              aria-haspopup="listbox"
            >
              {selectedTeamId ? (requestableTeams.find((t) => t.id === selectedTeamId)?.name ?? teamMap[selectedTeamId] ?? '팀 선택') : '팀 선택'}
              <span className="share-request-view__select-arrow">{dropdownOpen ? '▲' : '▼'}</span>
            </button>
            {dropdownOpen && (
              <ul
                className="share-request-view__dropdown-list"
                role="listbox"
                aria-label="요청할 팀 목록"
              >
                {requestableTeams.map((t) => (
                  <li key={t.id} role="option">
                    <button
                      type="button"
                      className={`share-request-view__dropdown-item ${selectedTeamId === t.id ? 'share-request-view__dropdown-item--selected' : ''}`}
                      onClick={() => {
                        setSelectedTeamId(t.id)
                        setDropdownOpen(false)
                      }}
                    >
                      {t.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="button"
            className="share-request-view__btn share-request-view__btn--primary"
            onClick={handleSend}
            disabled={!selectedTeamId || sending}
          >
            {sending ? '전송 중...' : '요청 보내기'}
          </button>
        </div>
        {requestableTeams.length === 0 && allTeams.length > 0 && (
          <p className="share-request-view__hint">요청 가능한 팀이 없습니다. (이미 공유 중이거나 요청됨)</p>
        )}
      </section>

      <section className="share-request-view__section">
        <h2 className="share-request-view__title">받은 요청</h2>
        <p className="share-request-view__desc">다른 팀이 보낸 공유 요청입니다. 승인하면 서로 일정을 조회할 수 있습니다.</p>
        {receivedLoading ? (
          <p className="share-request-view__loading">불러오는 중...</p>
        ) : received.length === 0 ? (
          <p className="share-request-view__empty-row">받은 요청이 없습니다.</p>
        ) : (
          <ul className="share-request-view__list">
            {received.map((r) => (
              <li key={r.id} className="share-request-view__item">
                <span className="share-request-view__item-name">{teamMap[r.from_team_id] ?? r.from_team_id}</span>
                <div className="share-request-view__item-actions">
                  <button
                    type="button"
                    className="share-request-view__btn share-request-view__btn--accept"
                    onClick={() => handleAccept(r.id)}
                    disabled={actioning === r.id}
                  >
                    {actioning === r.id ? '처리 중...' : '승인'}
                  </button>
                  <button
                    type="button"
                    className="share-request-view__btn share-request-view__btn--reject"
                    onClick={() => handleReject(r.id)}
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

      <section className="share-request-view__section">
        <h2 className="share-request-view__title">보낸 요청</h2>
        <p className="share-request-view__desc">승인되면 공유중인 팀에 표시됩니다.</p>
        {sentLoading ? (
          <p className="share-request-view__loading">불러오는 중...</p>
        ) : sent.filter((r) => r.status !== 'accepted').length === 0 ? (
          <p className="share-request-view__empty-row">보낸 요청이 없습니다.</p>
        ) : (
          <ul className="share-request-view__list">
            {sent.filter((r) => r.status !== 'accepted').map((r) => (
              <li key={r.id} className="share-request-view__item share-request-view__item--sent">
                <span className="share-request-view__item-name">{teamMap[r.to_team_id] ?? r.to_team_id}</span>
                <span className={`share-request-view__status share-request-view__status--${r.status}`}>
                  {STATUS_LABEL[r.status] ?? r.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="share-request-view__section">
        <h2 className="share-request-view__title">공유 중인 팀</h2>
        <p className="share-request-view__desc">일정확인 탭에서 이 팀들의 일정을 조회할 수 있습니다.</p>
        {sharedLoading ? (
          <p className="share-request-view__loading">불러오는 중...</p>
        ) : shared.length === 0 ? (
          <p className="share-request-view__empty-row">공유 중인 팀이 없습니다.</p>
        ) : (
          <ul className="share-request-view__list">
            {shared.map((t) => (
              <li key={t.id} className="share-request-view__item">
                <span className="share-request-view__item-name">{t.name}</span>
                <button
                  type="button"
                  className="share-request-view__btn share-request-view__btn--danger"
                  onClick={() => handleRemoveShare(t.id)}
                  disabled={actioning === t.id}
                >
                  {actioning === t.id ? '해제 중...' : '공유 해제'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
