import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSharableTeams } from '../hooks/useSupabase'
import { useTeamMembers } from '../hooks/useProfile'
import ProfileViewModal from './ProfileViewModal'
import './TeamView.css'

export default function TeamView() {
  const { teamId } = useAuth()
  const { data: sharableTeams, loading: teamsLoading } = useSharableTeams()
  const [selectedTeamId, setSelectedTeamId] = useState(null)
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)
  const dropdownRef = useRef(null)

  const displayTeamId = selectedTeamId ?? teamId ?? sharableTeams?.[0]?.id
  const { data: members, loading: membersLoading } = useTeamMembers(displayTeamId)

  useEffect(() => {
    if (!selectedTeamId && sharableTeams?.length) {
      setSelectedTeamId(sharableTeams[0].id)
    }
  }, [sharableTeams, selectedTeamId])

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

  const roleLabel = (role) => (role === 'supervisor' ? '슈퍼바이저' : role === 'admin' ? '관리자' : '훈련생')

  return (
    <div className="team-view">
      <div className="team-view__combo-wrap" ref={dropdownRef}>
        <label className="team-view__label">팀 선택</label>
        <div className="team-view__dropdown">
          <button
            type="button"
            className="team-view__dropdown-btn"
            onClick={() => setTeamDropdownOpen((v) => !v)}
          >
            {displayTeamId ? sharableTeams?.find((t) => t.id === displayTeamId)?.name ?? '팀 선택' : '팀 선택'}
            <span>{teamDropdownOpen ? '▲' : '▼'}</span>
          </button>
          {teamDropdownOpen && sharableTeams && (
            <ul className="team-view__dropdown-list">
              {sharableTeams.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTeamId(t.id)
                      setTeamDropdownOpen(false)
                    }}
                  >
                    {t.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="team-view__members">
        <h2 className="team-view__members-title">팀원 명단</h2>
        {membersLoading || teamsLoading ? (
          <p className="team-view__empty">불러오는 중...</p>
        ) : !displayTeamId ? (
          <p className="team-view__empty">팀을 선택해 주세요.</p>
        ) : members.length === 0 ? (
          <p className="team-view__empty">팀원이 없습니다.</p>
        ) : (
          <ul className="team-view__list">
            {members.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className="team-view__member-btn"
                  onClick={() => setSelectedMember(m)}
                >
                  <span className="team-view__member-name">
                    {m.nickname || m.display_name || '사용자'}
                  </span>
                  <span className="team-view__member-role">{roleLabel(m.role)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedMember && (
        <ProfileViewModal
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
        />
      )}
    </div>
  )
}
