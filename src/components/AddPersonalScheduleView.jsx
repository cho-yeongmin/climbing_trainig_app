import { useState } from 'react'
import { useExerciseTypes, addPersonalScheduleItems } from '../hooks/useSupabase'
import LocationSelectView from './LocationSelectView'
import './AddScheduleView.css'

/**
 * 개인 일정 추가 - 장소/훈련 복수 선택 (제목 없음)
 */
export default function AddPersonalScheduleView({ selectedDate, userId, onClose, onSuccess }) {
  const { data: exerciseTypes } = useExerciseTypes()
  const [selectedPlaces, setSelectedPlaces] = useState([])
  const [selectedTrainings, setSelectedTrainings] = useState([])
  const [showLocationSelect, setShowLocationSelect] = useState(false)
  const [showTrainingPicker, setShowTrainingPicker] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const dateStr = selectedDate
    ? `${selectedDate.year}-${String(selectedDate.month).padStart(2, '0')}-${String(selectedDate.day).padStart(2, '0')}`
    : ''

  const getExpeditionType = () =>
    (exerciseTypes ?? []).find((t) => String(t.day_type_id || '').toLowerCase() === 'expedition')

  const handlePlaceSelect = (place) => {
    if (selectedPlaces.some((p) => p.id === place.id)) return
    setSelectedPlaces((prev) => [...prev, place])
    setShowLocationSelect(false)
  }

  const handleRemovePlace = (id) => {
    setSelectedPlaces((prev) => prev.filter((p) => p.id !== id))
  }

  const handleTrainingSelect = (type) => {
    if (selectedTrainings.some((t) => t.id === type.id)) return
    setSelectedTrainings((prev) => [...prev, type])
    setShowTrainingPicker(false)
  }

  const handleRemoveTraining = (id) => {
    setSelectedTrainings((prev) => prev.filter((t) => t.id !== id))
  }

  const handleSubmit = async () => {
    if (!userId) {
      setError('로그인 후 이용해주세요.')
      return
    }
    if (!dateStr) {
      setError('날짜를 선택해주세요.')
      return
    }
    const expedition = getExpeditionType()
    const items = []
    selectedPlaces.forEach((p) => {
      items.push({ placeId: p.id, exerciseTypeId: expedition?.id ?? null })
    })
    selectedTrainings.forEach((t) => {
      items.push({ placeId: null, exerciseTypeId: t.id })
    })
    if (items.length === 0) {
      setError('장소 또는 훈련을 1개 이상 선택해주세요.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await addPersonalScheduleItems(userId, dateStr, items)
      onSuccess?.()
      onClose()
    } catch (err) {
      setError(err.message ?? '일정 저장에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="add-schedule" role="dialog" aria-modal="true" aria-labelledby="add-personal-schedule-title">
      <div className="add-schedule__backdrop" onClick={onClose} aria-hidden />
      <div className="add-schedule__panel">
        <h1 id="add-personal-schedule-title" className="add-schedule__title">
          개인 일정 추가
        </h1>

        <section className="add-schedule__card">
          <h2 className="add-schedule__card-title">장소 (복수 선택 가능)</h2>
          <button
            type="button"
            className="add-schedule__select-btn add-schedule__select-btn--place"
            onClick={() => setShowLocationSelect(true)}
            aria-label="장소 추가"
          >
            <span className="add-schedule__select-btn-icon">+</span>
            <span className="add-schedule__select-btn-text">장소 추가</span>
          </button>
          {selectedPlaces.length > 0 && (
            <ul className="add-schedule__chips">
              {selectedPlaces.map((p) => (
                <li key={p.id} className="add-schedule__chip">
                  <span>{p.name}</span>
                  <button type="button" onClick={() => handleRemovePlace(p.id)} aria-label="제거">×</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="add-schedule__card add-schedule__card--training">
          <h2 className="add-schedule__card-title">훈련 유형 (복수 선택 가능)</h2>
          <button
            type="button"
            className="add-schedule__select-btn"
            onClick={() => setShowTrainingPicker((v) => !v)}
            aria-expanded={showTrainingPicker}
          >
            <span className="add-schedule__select-btn-icon">+</span>
            훈련 유형 추가
          </button>
          {showTrainingPicker && (
            <ul className="add-schedule__training-list" role="listbox">
              {(exerciseTypes ?? []).map((type) => (
                <li key={type.id} role="option">
                  <button
                    type="button"
                    className={`add-schedule__training-item ${selectedTrainings.some((t) => t.id === type.id) ? 'add-schedule__training-item--selected' : ''}`}
                    onClick={() => handleTrainingSelect(type)}
                  >
                    {type.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {selectedTrainings.length > 0 && (
            <ul className="add-schedule__chips">
              {selectedTrainings.map((t) => (
                <li key={t.id} className="add-schedule__chip">
                  <span>{t.name}</span>
                  <button type="button" onClick={() => handleRemoveTraining(t.id)} aria-label="제거">×</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {error && <p className="add-schedule__error">{error}</p>}

        <button
          type="button"
          className="add-schedule__submit"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? '저장 중...' : '작성완료'}
        </button>
      </div>

      {showLocationSelect && (
        <LocationSelectView
          onClose={() => setShowLocationSelect(false)}
          onSelect={handlePlaceSelect}
        />
      )}
    </div>
  )
}
