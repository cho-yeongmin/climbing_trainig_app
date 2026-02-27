import { useState } from 'react'
import { useExerciseTypes, createSchedules, getExpeditionExerciseTypeId } from '../hooks/useSupabase'
import LocationSelectView from './LocationSelectView'
import './AddScheduleView.css'

/**
 * 관리자용 일정 추가 - 장소/훈련 복수 선택
 */
export default function AddScheduleView({ selectedDate, teamId, onClose, onSuccess }) {
  const { data: exerciseTypes } = useExerciseTypes()
  const [selectedPlaces, setSelectedPlaces] = useState([])
  const [selectedTrainings, setSelectedTrainings] = useState([])
  const [showTrainingPicker, setShowTrainingPicker] = useState(false)
  const [showLocationSelect, setShowLocationSelect] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

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
    if (!selectedDate) {
      setError('달력에서 날짜를 선택해주세요.')
      return
    }
    if (!teamId) {
      setError('팀 정보를 불러올 수 없습니다.')
      return
    }
    if (selectedPlaces.length === 0 && selectedTrainings.length === 0) {
      setError('장소 또는 훈련을 1개 이상 선택해주세요.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const expedition = getExpeditionType()
      let expeditionId = expedition?.id
      if (!expeditionId && selectedPlaces.length > 0) {
        expeditionId = await getExpeditionExerciseTypeId()
      }
      if (selectedPlaces.length > 0 && !expeditionId) {
        setError('원정(원정가는 날) 정보를 불러올 수 없습니다.')
        setSubmitting(false)
        return
      }
      const items = []
      selectedPlaces.forEach((p) => {
        items.push({ placeId: p.id, exerciseTypeId: expeditionId })
      })
      selectedTrainings.forEach((t) => {
        items.push({ placeId: null, exerciseTypeId: t.id })
      })
      await createSchedules(teamId, selectedDate, items)
      onSuccess?.()
      onClose()
    } catch (err) {
      setError(err.message ?? '일정 저장에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="add-schedule" role="dialog" aria-modal="true" aria-labelledby="add-schedule-title">
      <div className="add-schedule__backdrop" onClick={onClose} aria-hidden />
      <div className="add-schedule__panel">
        <h1 id="add-schedule-title" className="add-schedule__title">
          클라이밍을 잘하고 싶다
        </h1>

        {/* 장소 및 등반기록 카드 - 복수 선택 */}
        <section className="add-schedule__card">
          <h2 className="add-schedule__card-title">장소 및 등반기록 (복수 선택 가능)</h2>
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

        {/* 훈련기록 카드 - 복수 선택 */}
        <section className="add-schedule__card add-schedule__card--training">
          <h2 className="add-schedule__card-title">훈련기록 (복수 선택 가능)</h2>
          <div className="add-schedule__training-wrap">
            <button
              type="button"
              className="add-schedule__select-btn"
              onClick={() => setShowTrainingPicker((v) => !v)}
              aria-expanded={showTrainingPicker}
              aria-haspopup="listbox"
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
          </div>
        </section>

        {error && <p className="add-schedule__error">{error}</p>}

        <button
          type="button"
          className="add-schedule__submit"
          onClick={handleSubmit}
          disabled={submitting}
          aria-label="작성완료"
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
