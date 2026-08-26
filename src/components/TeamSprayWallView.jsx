import { useState, useRef, useEffect } from 'react'
import { createTeamSprayWall, updateTeamSprayWall } from '../hooks/useSupabase'
import './TeamSprayWallView.css'

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function TeamSprayWallView({
  teamId,
  userId,
  canManage,
  existing,
  onBack,
  onSaved,
}) {
  const [previewUrl, setPreviewUrl] = useState(existing?.image_data ?? null)
  const [pendingDataUrl, setPendingDataUrl] = useState(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef(null)

  const hasExisting = Boolean(existing?.id)

  useEffect(() => {
    if (existing?.image_data && !pendingDataUrl) {
      setPreviewUrl(existing.image_data)
    }
  }, [existing?.image_data, pendingDataUrl])

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await readFileAsDataUrl(file)
      setPendingDataUrl(dataUrl)
      setPreviewUrl(dataUrl)
    } catch (err) {
      console.error(err)
      alert('이미지를 불러오지 못했습니다.')
    }
    e.target.value = ''
  }

  const handlePickImage = () => {
    if (!canManage) {
      alert('팀 관리자만 등록·편집할 수 있습니다.')
      return
    }
    fileInputRef.current?.click()
  }

  const handleSave = async () => {
    if (!pendingDataUrl || !teamId || !userId) return

    setSaving(true)
    try {
      if (hasExisting) {
        await updateTeamSprayWall(teamId, pendingDataUrl)
        alert('스프레이월 이미지가 수정되었습니다.')
      } else {
        await createTeamSprayWall({ teamId, userId, imageData: pendingDataUrl })
        alert('스프레이월 이미지가 등록되었습니다.')
      }
      setPendingDataUrl(null)
      onSaved?.()
    } catch (err) {
      console.error(err)
      if (err?.code === '23505') {
        alert('이미 등록된 팀 스프레이월이 있습니다. 편집 화면에서 수정해 주세요.')
      } else {
        alert(hasExisting ? '수정에 실패했습니다.' : '등록에 실패했습니다.')
      }
    } finally {
      setSaving(false)
    }
  }

  if (!teamId) {
    return (
      <div className="team-spray-wall">
        <div className="team-spray-wall__header">
          <button type="button" className="spray-wall__back" onClick={onBack}>
            ← 문제 타입 선택
          </button>
        </div>
        <p className="team-spray-wall__empty">팀에 소속되어 있어야 스프레이월을 등록할 수 있습니다.</p>
      </div>
    )
  }

  return (
    <div className="team-spray-wall">
      <div className="team-spray-wall__header">
        <button type="button" className="spray-wall__back" onClick={onBack}>
          ← 문제 타입 선택
        </button>
      </div>

      <h2 className="team-spray-wall__title">이번달의 스프레이월</h2>
      <p className="team-spray-wall__desc">
        {canManage
          ? hasExisting
            ? '팀원이 문제를 만들 때 사용할 스프레이월 사진입니다. 편집으로 사진을 교체할 수 있습니다.'
            : '팀원이 문제를 만들 때 기본으로 사용할 스프레이월 사진을 등록하세요. 팀당 1장만 등록할 수 있습니다.'
          : hasExisting
            ? '팀에서 사용 중인 스프레이월 사진입니다. 문제 생성 시 자동으로 적용됩니다.'
            : '아직 등록된 스프레이월이 없습니다. 팀 관리자에게 등록을 요청해 주세요.'}
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="team-spray-wall__file"
        onChange={handleFileChange}
      />

      {previewUrl ? (
        <div className="team-spray-wall__preview-wrap">
          <img src={previewUrl} alt="팀 스프레이월" className="team-spray-wall__preview" />
        </div>
      ) : (
        canManage && (
          <button
            type="button"
            className="team-spray-wall__upload-btn"
            onClick={handlePickImage}
          >
            사진 업로드
          </button>
        )
      )}

      <div className="team-spray-wall__actions">
        {canManage && previewUrl && hasExisting && !pendingDataUrl && (
          <button
            type="button"
            className="team-spray-wall__btn team-spray-wall__btn--secondary"
            onClick={handlePickImage}
          >
            사진 편집
          </button>
        )}
        {canManage && pendingDataUrl && (
          <>
            <button
              type="button"
              className="team-spray-wall__btn team-spray-wall__btn--secondary"
              onClick={handlePickImage}
            >
              다시 선택
            </button>
            <button
              type="button"
              className="team-spray-wall__btn team-spray-wall__btn--primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? '저장 중...' : hasExisting ? '수정 저장' : '등록'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
