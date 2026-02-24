import { useState, useMemo } from 'react'
import {
  useSprayWallProblems,
  updateSprayWallProblemTags,
  deleteSprayWallProblem,
} from '../hooks/useSupabase'
import './SprayWallGalleryView.css'

const GALLERY_TITLES = {
  bouldering: '볼더링 갤러리',
  endurance: '지구력 갤러리',
}

export default function SprayWallGalleryView({ userId, galleryType, onBack }) {
  const { data: problems, loading, refetch } = useSprayWallProblems(userId, galleryType)
  const [modalIndex, setModalIndex] = useState(-1)
  const [tagEditId, setTagEditId] = useState(null)
  const [tagEditTags, setTagEditTags] = useState([])
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [deleteInput, setDeleteInput] = useState('')
  const [savingTags, setSavingTags] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const filteredProblems = useMemo(() => {
    return problems || []
  }, [problems])

  const handleCloseModal = () => setModalIndex(-1)
  const handlePrev = () =>
    setModalIndex((i) => (i <= 0 ? filteredProblems.length - 1 : i - 1))
  const handleNext = () =>
    setModalIndex((i) => (i >= filteredProblems.length - 1 ? 0 : i + 1))

  const handleOpenTagEdit = (problem) => {
    setTagEditId(problem.id)
    setTagEditTags([...(problem.tags || [])])
  }

  const handleAddTag = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const val = e.target.value.trim()
      if (val && !tagEditTags.includes(val)) {
        setTagEditTags((prev) => [...prev, val])
        e.target.value = ''
      }
    }
  }

  const handleRemoveTag = (tag) => {
    setTagEditTags((prev) => prev.filter((t) => t !== tag))
  }

  const handleSaveTags = async () => {
    if (!tagEditId) return
    setSavingTags(true)
    try {
      await updateSprayWallProblemTags(tagEditId, tagEditTags)
      await refetch()
      setTagEditId(null)
      setTagEditTags([])
    } catch (err) {
      console.error(err)
      alert('태그 저장에 실패했습니다.')
    } finally {
      setSavingTags(false)
    }
  }

  const handleCancelTags = () => {
    setTagEditId(null)
    setTagEditTags([])
  }

  const handleDeleteClick = (id) => {
    setDeleteConfirmId(id)
    setDeleteInput('')
  }

  const handleConfirmDelete = async () => {
    if (deleteInput !== '삭제' || !deleteConfirmId) return
    setDeleting(true)
    try {
      await deleteSprayWallProblem(deleteConfirmId)
      await refetch()
      setDeleteConfirmId(null)
      setModalIndex(-1)
    } catch (err) {
      console.error(err)
      alert('삭제에 실패했습니다.')
    } finally {
      setDeleting(false)
    }
  }

  const currentModalProblem =
    modalIndex >= 0 && modalIndex < filteredProblems.length
      ? filteredProblems[modalIndex]
      : null

  if (!userId) return null

  return (
    <div className="spray-wall-gallery">
      <div className="spray-wall-gallery__header">
        <button type="button" className="spray-wall__back" onClick={onBack}>
          ← 스프레이월
        </button>
      </div>
      <h2 className="spray-wall-gallery__title">
        {GALLERY_TITLES[galleryType] || '갤러리'}
      </h2>

      {loading ? (
        <p className="spray-wall-gallery__empty">로딩 중...</p>
      ) : filteredProblems.length === 0 ? (
        <p className="spray-wall-gallery__empty">저장된 문제가 없습니다.</p>
      ) : (
        <div className="spray-wall-gallery__grid">
          {filteredProblems.map((problem, index) => (
            <div
              key={problem.id}
              className="spray-wall-gallery__item"
              onClick={() => setModalIndex(index)}
            >
              <img
                src={problem.image_data}
                alt={problem.name}
                className="spray-wall-gallery__thumb"
              />
              <span className="spray-wall-gallery__name">{problem.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* 이미지 뷰어 모달 */}
      {currentModalProblem && (
        <div
          className="spray-wall-gallery__modal"
          onClick={handleCloseModal}
          role="dialog"
          aria-modal="true"
          aria-label="이미지 보기"
        >
          <div
            className="spray-wall-gallery__modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="spray-wall-gallery__modal-close"
              onClick={handleCloseModal}
              aria-label="닫기"
            >
              ×
            </button>
            <button
              type="button"
              className="spray-wall-gallery__modal-nav spray-wall-gallery__modal-nav--prev"
              onClick={(e) => {
                e.stopPropagation()
                handlePrev()
              }}
              aria-label="이전"
            >
              ‹
            </button>
            <button
              type="button"
              className="spray-wall-gallery__modal-nav spray-wall-gallery__modal-nav--next"
              onClick={(e) => {
                e.stopPropagation()
                handleNext()
              }}
              aria-label="다음"
            >
              ›
            </button>
            <img
              src={currentModalProblem.image_data}
              alt={currentModalProblem.name}
              className="spray-wall-gallery__modal-img"
            />
            <div className="spray-wall-gallery__modal-title">
              {currentModalProblem.name}
            </div>
            <div className="spray-wall-gallery__modal-actions">
              <button
                type="button"
                className="spray-wall-gallery__action-btn"
                onClick={() => handleOpenTagEdit(currentModalProblem)}
              >
                태그 편집
              </button>
              <button
                type="button"
                className="spray-wall-gallery__action-btn spray-wall-gallery__action-btn--danger"
                onClick={() => handleDeleteClick(currentModalProblem.id)}
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 태그 편집 모달 */}
      {tagEditId && (
        <div className="spray-wall-gallery__modal" role="dialog" aria-modal="true">
          <div className="spray-wall-gallery__tag-modal">
            <h3 className="spray-wall-gallery__tag-title">태그 편집</h3>
            <input
              type="text"
              className="spray-wall-gallery__tag-input"
              placeholder="태그 입력 후 Enter"
              onKeyDown={handleAddTag}
            />
            <div className="spray-wall-gallery__tag-list">
              {tagEditTags.map((tag) => (
                <span
                  key={tag}
                  className="spray-wall-gallery__tag-chip"
                  onClick={() => handleRemoveTag(tag)}
                >
                  {tag} ×
                </span>
              ))}
            </div>
            <div className="spray-wall-gallery__tag-buttons">
              <button
                type="button"
                className="spray-wall-gallery__save-tags"
                onClick={handleSaveTags}
                disabled={savingTags}
              >
                {savingTags ? '저장 중...' : '저장'}
              </button>
              <button
                type="button"
                className="spray-wall-gallery__cancel-tags"
                onClick={handleCancelTags}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {deleteConfirmId && (
        <div className="spray-wall-gallery__modal" role="dialog" aria-modal="true">
          <div className="spray-wall-gallery__delete-modal">
            <h3 className="spray-wall-gallery__delete-title">문제 삭제</h3>
            <p className="spray-wall-gallery__delete-msg">
              정말로 이 문제를 삭제하시겠습니까?
            </p>
            <p className="spray-wall-gallery__delete-hint">
              삭제하려면 아래에 <strong>삭제</strong>를 입력하세요.
            </p>
            <input
              type="text"
              className="spray-wall-gallery__delete-input"
              placeholder="삭제"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
            />
            <div className="spray-wall-gallery__delete-buttons">
              <button
                type="button"
                className="spray-wall-gallery__confirm-delete"
                onClick={handleConfirmDelete}
                disabled={deleteInput !== '삭제' || deleting}
              >
                {deleting ? '삭제 중...' : '삭제'}
              </button>
              <button
                type="button"
                className="spray-wall-gallery__cancel-delete"
                onClick={() => setDeleteConfirmId(null)}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
