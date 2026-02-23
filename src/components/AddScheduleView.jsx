import { useState, useEffect } from 'react'
import { useExerciseTypes, createSchedule, getExpeditionExerciseTypeId } from '../hooks/useSupabase'
import LocationSelectView from './LocationSelectView'
import './AddScheduleView.css'

/**
 * 관리자용 일정 추가 페이지 (Figma: 일정추가하기 클릭 시 표시)
 * - 장소 및 등반기록: 장소 선택 → LocationSelectView (검색/최근검색 5곳)
 * - 훈련기록: DB exercise_types에서 7가지 훈련 유형 선택
 */
export default function AddScheduleView({ selectedDate, onClose, onSuccess }) {
  const { data: exerciseTypes } = useExerciseTypes()
  const [selectedTraining, setSelectedTraining] = useState(null)
  const [showTrainingPicker, setShowTrainingPicker] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState(null)
  const [showLocationSelect, setShowLocationSelect] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleTrainingSelect = (type) => {
    setSelectedTraining(type)
    setSelectedPlace(null) // 운동 선택 시 장소 해제 (하나만 선택)
    setShowTrainingPicker(false)
  }

  const getExpeditionType = () =>
    exerciseTypes.find((t) => String(t.day_type_id || '').toLowerCase() === 'expedition')

  const handlePlaceSelect = (place) => {
    setSelectedPlace(place)
    setSelectedTraining(getExpeditionType() ?? null) // 장소 선택 시 '원정가는 날'로 설정
  }

  // 장소만 선택된 상태에서 exerciseTypes가 로드되면 '원정가는 날' 자동 설정
  useEffect(() => {
    if (selectedPlace && !selectedTraining && exerciseTypes.length > 0) {
      const expedition = getExpeditionType()
      if (expedition) setSelectedTraining(expedition)
    }
  }, [selectedPlace, selectedTraining, exerciseTypes])

  const handleSubmit = async () => {
    if (!selectedDate) {
      setError('달력에서 날짜를 선택해주세요.')
      return
    }
    if (!selectedPlace && !selectedTraining) {
      setError('장소 또는 운동 중 하나를 선택해주세요.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      let exerciseTypeId = selectedTraining?.id
      // 장소만 선택한 경우: DB에서 '원정가는 날' id 직접 조회
      if (!exerciseTypeId && selectedPlace) {
        const fromList = exerciseTypes.find((t) => (t.day_type_id || '').toString() === 'expedition')
        exerciseTypeId = fromList?.id ?? null
        if (!exerciseTypeId) {
          exerciseTypeId = await getExpeditionExerciseTypeId()
        }
      }
      if (!exerciseTypeId) {
        setError(
          selectedPlace
            ? '원정(원정가는 날) 정보를 불러올 수 없습니다. 페이지를 새로고침 후 다시 시도해주세요.'
            : '운동을 선택해주세요.'
        )
        setSubmitting(false)
        return
      }
      await createSchedule({
        date: selectedDate,
        exerciseTypeId,
        placeId: selectedPlace?.id ?? null,
      })
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
          클라이밍 잘하고 싶다
        </h1>

        {/* 장소 및 등반기록 카드 */}
        <section className="add-schedule__card">
          <h2 className="add-schedule__card-title">장소 및 등반기록</h2>
          <button
            type="button"
            className="add-schedule__select-btn add-schedule__select-btn--place"
            onClick={() => setShowLocationSelect(true)}
            aria-label={selectedPlace ? `${selectedPlace.name} 변경` : '장소를 선택해주세요'}
          >
            {selectedPlace?.image_url ? (
              <img
                src={selectedPlace.image_url}
                alt=""
                className="add-schedule__place-thumb"
              />
            ) : (
              <span className="add-schedule__select-btn-icon">
                {selectedPlace ? '✓' : '+'}
              </span>
            )}
            <span className="add-schedule__select-btn-text">
              {selectedPlace ? selectedPlace.name : '장소를 선택해주세요.'}
            </span>
          </button>
        </section>

        {/* 훈련기록 카드 */}
        <section className="add-schedule__card add-schedule__card--training">
          <h2 className="add-schedule__card-title">훈련기록</h2>
          <div className="add-schedule__training-wrap">
            <button
              type="button"
              className="add-schedule__select-btn"
              onClick={() => setShowTrainingPicker((v) => !v)}
              aria-expanded={showTrainingPicker}
              aria-haspopup="listbox"
              aria-label={selectedTraining ? selectedTraining.name : '훈련을 선택해주세요'}
            >
              <span className="add-schedule__select-btn-icon">
                {selectedTraining ? '✓' : '+'}
              </span>
              {selectedTraining ? selectedTraining.name : '훈련을 선택해주세요.'}
            </button>
            {showTrainingPicker && (
              <ul
                className="add-schedule__training-list"
                role="listbox"
                aria-label="훈련 유형 선택"
              >
                {exerciseTypes.map((type) => (
                  <li key={type.id} role="option" aria-selected={selectedTraining?.id === type.id}>
                    <button
                      type="button"
                      className={`add-schedule__training-item ${selectedTraining?.id === type.id ? 'add-schedule__training-item--selected' : ''}`}
                      onClick={() => handleTrainingSelect(type)}
                    >
                      {type.name}
                    </button>
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
