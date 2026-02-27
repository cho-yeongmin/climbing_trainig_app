/**
 * 팀원 프로필 보기 (읽기 전용)
 */
import { useExpeditionCount, useExerciseCount } from '../hooks/useProfile'
import './ProfileViewModal.css'

export default function ProfileViewModal({ member, onClose }) {
  if (!member) return null

  const { count: expeditionCount, loading: expeditionLoading } = useExpeditionCount(member.id)
  const { count: exerciseCount, loading: exerciseLoading } = useExerciseCount(member.id)
  const nickname = member.nickname || member.display_name || '사용자'
  const roleLabel = member.role === 'supervisor' ? '슈퍼바이저' : member.role === 'admin' ? '관리자' : '훈련생'

  return (
    <div className="profile-view-modal" role="dialog" aria-modal="true" aria-labelledby="profile-view-title">
      <div className="profile-view-modal__backdrop" onClick={onClose} aria-hidden />
      <div className="profile-view-modal__panel">
        <div className="profile-view-modal__header">
          <h2 id="profile-view-title" className="profile-view-modal__title">프로필</h2>
          <button type="button" className="profile-view-modal__close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        <section className="profile-view-modal__section">
          <label className="profile-view-modal__label">닉네임</label>
          <p className="profile-view-modal__value">{nickname}</p>
        </section>

        <section className="profile-view-modal__section">
          <label className="profile-view-modal__label">역할</label>
          <p className="profile-view-modal__value">{roleLabel}</p>
        </section>

        <section className="profile-view-modal__section">
          <label className="profile-view-modal__label">뽐내기 정보</label>
          <p className="profile-view-modal__value profile-view-modal__value--multiline">
            {member.boast_info || '-'}
          </p>
        </section>

        <section className="profile-view-modal__section">
          <label className="profile-view-modal__label">참여 원정 횟수</label>
          <p className="profile-view-modal__value">{expeditionLoading ? '...' : `${expeditionCount}회`}</p>
        </section>

        <section className="profile-view-modal__section">
          <label className="profile-view-modal__label">참여 운동 횟수</label>
          <p className="profile-view-modal__value">{exerciseLoading ? '...' : `${exerciseCount}회`}</p>
        </section>

        <button type="button" className="profile-view-modal__close-btn" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  )
}
