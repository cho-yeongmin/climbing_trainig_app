import { useState, useCallback } from 'react'
import { CARD_TYPES } from '../data/dayTypes'
import './DayContentCard.css'

/**
 * 1 set ~ n set 버튼: 각 세트를 해냈는지 표시. 누른 버튼만 파란색 유지, 기본 선택 없음.
 * isSaved: 저장된 상태면 읽기 전용 + 수정 버튼
 */
function TrainingSetsBlock({ card, onSave, onEdit, onDelete, isSaved, savedPayload }) {
  const count = card.setCount ?? 5
  const initialSets = Array.isArray(savedPayload?.completedSets) ? new Set(savedPayload.completedSets) : new Set()
  const [completedSets, setCompletedSets] = useState(() => initialSets)

  const toggleSet = (n) => {
    setCompletedSets((prev) => {
      const next = new Set(prev)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })
  }

  if (isSaved) {
    const savedSet = new Set(savedPayload?.completedSets ?? [])
    return (
      <article className="day-card day-card--training-sets">
        <p className="day-card__text">
          {card.message?.split(card.highlight).map((part, i, arr) => (
            <span key={i}>
              {part}
              {i < arr.length - 1 && (
                <strong className="day-card__highlight">{card.highlight}</strong>
              )}
            </span>
          ))}
        </p>
        <div className="day-card__sets day-card__sets--readonly" role="group" aria-label="세트 완료 표시">
          {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
            <span
              key={n}
              className={`day-card__set-btn day-card__set-btn--readonly ${savedSet.has(n) ? 'day-card__set-btn--active' : ''}`}
            >
              {n} set
            </span>
          ))}
        </div>
        <div className="day-card__save-wrap day-card__save-wrap--actions">
          <button type="button" className="day-card__edit-btn" onClick={onEdit}>
            수정
          </button>
          <button type="button" className="day-card__delete-btn" onClick={onDelete}>
            삭제
          </button>
        </div>
      </article>
    )
  }

  return (
    <article className="day-card day-card--training-sets">
      <p className="day-card__text">
        {card.message?.split(card.highlight).map((part, i, arr) => (
          <span key={i}>
            {part}
            {i < arr.length - 1 && (
              <strong className="day-card__highlight">{card.highlight}</strong>
            )}
          </span>
        ))}
      </p>
      <div className="day-card__sets" role="group" aria-label="세트 완료 표시">
        {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            className={`day-card__set-btn ${completedSets.has(n) ? 'day-card__set-btn--active' : ''}`}
            onClick={() => toggleSet(n)}
            aria-pressed={completedSets.has(n)}
          >
            {n} set
          </button>
        ))}
      </div>
      <div className="day-card__save-wrap">
        <button
          type="button"
          className="day-card__save-btn"
          onClick={() => onSave?.({ completedSets: Array.from(completedSets).sort((a, b) => a - b) }, 'training_sets')}
        >
          저장하기
        </button>
      </div>
    </article>
  )
}

/**
 * 파워볼더링: 1set~4set 각각 옆에 사각형 N개. 사각형 클릭 시 완료 표시(파란색) 토글.
 * isSaved: 저장된 상태면 읽기 전용 + 수정 버튼
 */
function TrainingSetsSquaresBlock({ card, onSave, onEdit, onDelete, isSaved, savedPayload }) {
  const setCount = card.setCount ?? 4
  const squaresPerSet = card.squaresPerSet ?? 4

  const getInitialCompleted = () => {
    if (savedPayload && typeof savedPayload === 'object' && !Array.isArray(savedPayload)) {
      const init = {}
      for (let s = 1; s <= setCount; s++) {
        const arr = savedPayload[s]
        init[s] = Array.isArray(arr) ? arr.map(Boolean) : Array(squaresPerSet).fill(false)
      }
      return init
    }
    const init = {}
    for (let s = 1; s <= setCount; s++) init[s] = Array(squaresPerSet).fill(false)
    return init
  }
  const [completed, setCompleted] = useState(getInitialCompleted)

  const toggle = (setNum, squareIdx) => {
    setCompleted((prev) => {
      const next = { ...prev }
      next[setNum] = [...(next[setNum] ?? [])]
      next[setNum][squareIdx] = !next[setNum][squareIdx]
      return next
    })
  }

  if (isSaved) {
    const records = savedPayload && typeof savedPayload === 'object' ? savedPayload : {}
    return (
      <article className="day-card day-card--training-sets-squares">
        <p className="day-card__text">
          {card.message?.split(card.highlight).map((part, i, arr) => (
            <span key={i}>
              {part}
              {i < arr.length - 1 && (
                <strong className="day-card__highlight">{card.highlight}</strong>
              )}
            </span>
          ))}
        </p>
        <div className="day-card__set-rows" role="group" aria-label="세트별 완료 표시">
          {Array.from({ length: setCount }, (_, i) => i + 1).map((setNum) => (
            <div key={setNum} className="day-card__set-row">
              <span className="day-card__set-label">{setNum}set</span>
              <div className="day-card__squares day-card__squares--readonly">
                {Array.from({ length: squaresPerSet }, (_, j) => (
                  <span
                    key={j}
                    className={`day-card__square day-card__square--readonly ${records[setNum]?.[j] ? 'day-card__square--active' : ''}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="day-card__save-wrap day-card__save-wrap--actions">
          <button type="button" className="day-card__edit-btn" onClick={onEdit}>
            수정
          </button>
          <button type="button" className="day-card__delete-btn" onClick={onDelete}>
            삭제
          </button>
        </div>
      </article>
    )
  }

  return (
    <article className="day-card day-card--training-sets-squares">
      <p className="day-card__text">
        {card.message?.split(card.highlight).map((part, i, arr) => (
          <span key={i}>
            {part}
            {i < arr.length - 1 && (
              <strong className="day-card__highlight">{card.highlight}</strong>
            )}
          </span>
        ))}
      </p>
      <div className="day-card__set-rows" role="group" aria-label="세트별 완료 표시">
        {Array.from({ length: setCount }, (_, i) => i + 1).map((setNum) => (
          <div key={setNum} className="day-card__set-row">
            <span className="day-card__set-label">{setNum}set</span>
            <div className="day-card__squares">
              {Array.from({ length: squaresPerSet }, (_, j) => (
                <button
                  key={j}
                  type="button"
                  className={`day-card__square ${completed[setNum]?.[j] ? 'day-card__square--active' : ''}`}
                  onClick={() => toggle(setNum, j)}
                  aria-pressed={completed[setNum]?.[j]}
                  aria-label={`${setNum}set ${j + 1}번 완료`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="day-card__save-wrap">
        <button
          type="button"
          className="day-card__save-btn"
          onClick={() => onSave?.(completed, 'training_sets_squares')}
        >
          저장하기
        </button>
      </div>
    </article>
  )
}

/**
 * 지난기록: 같은 운동 유형의 가장 최근 기록(세트별 사각형) 표시
 * 기록이 없으면 "지난 운동 기록이 없습니다." 표시
 */
function PreviousRecordsBlock({ card, latestRecord }) {
  const setCount = card.setCount ?? 4
  const squaresPerSet = card.squaresPerSet ?? 4
  const records = (latestRecord?.detailType === 'training_sets_squares' && latestRecord?.payload)
    ? latestRecord.payload
    : null

  return (
    <article className="day-card day-card--previous-records">
      {card.title && <h3 className="day-card__list-title">{card.title}</h3>}
      {records ? (
        <div className="day-card__set-rows">
          {Array.from({ length: setCount }, (_, i) => i + 1).map((setNum) => (
            <div key={setNum} className="day-card__set-row">
              <span className="day-card__set-label">{setNum}set</span>
              <div className="day-card__squares day-card__squares--readonly">
                {Array.from({ length: squaresPerSet }, (_, j) => (
                  <span
                    key={j}
                    className={`day-card__square day-card__square--readonly ${records[setNum]?.[j] ? 'day-card__square--active' : ''}`}
                    aria-hidden
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="day-card__no-records">지난 운동 기록이 없습니다.</p>
      )}
    </article>
  )
}

/**
 * 휴식/유산소: 메시지 + 항목별 왼쪽 사각형 완료 표시. 사각형 클릭 시 파란색 토글.
 * isSaved: 저장된 상태면 읽기 전용 + 수정 버튼
 */
function ChecklistBlock({ card, onSave, onEdit, onDelete, isSaved, savedPayload }) {
  const items = card.items ?? []
  const savedCompleted = Array.isArray(savedPayload?.completed) ? savedPayload.completed : []
  const [completed, setCompleted] = useState(() =>
    savedCompleted.length >= items.length ? savedCompleted : items.map(() => false)
  )

  const toggle = (index) => {
    setCompleted((prev) => {
      const next = [...prev]
      next[index] = !next[index]
      return next
    })
  }

  if (isSaved) {
    const displayCompleted = savedCompleted.length >= items.length ? savedCompleted : items.map(() => false)
    return (
      <article className="day-card day-card--checklist">
        <p className="day-card__text">
          {card.message?.split(card.highlight).map((part, i, arr) => (
            <span key={i}>
              {part}
              {i < arr.length - 1 && (
                <strong className="day-card__highlight">{card.highlight}</strong>
              )}
            </span>
          ))}
        </p>
        <div className="day-card__checklist-rows day-card__checklist-rows--readonly" role="group" aria-label="항목 완료 표시">
          {items.map((label, index) => (
            <div key={index} className="day-card__checklist-row">
              <span
                className={`day-card__checklist-square day-card__checklist-square--readonly ${displayCompleted[index] ? 'day-card__checklist-square--active' : ''}`}
              />
              <span className="day-card__checklist-label">{label}</span>
            </div>
          ))}
        </div>
        <div className="day-card__save-wrap day-card__save-wrap--actions">
          <button type="button" className="day-card__edit-btn" onClick={onEdit}>
            수정
          </button>
          <button type="button" className="day-card__delete-btn" onClick={onDelete}>
            삭제
          </button>
        </div>
      </article>
    )
  }

  return (
    <article className="day-card day-card--checklist">
      <p className="day-card__text">
        {card.message?.split(card.highlight).map((part, i, arr) => (
          <span key={i}>
            {part}
            {i < arr.length - 1 && (
              <strong className="day-card__highlight">{card.highlight}</strong>
            )}
          </span>
        ))}
      </p>
      <div className="day-card__checklist-rows" role="group" aria-label="항목 완료 표시">
        {items.map((label, index) => (
          <div key={index} className="day-card__checklist-row">
            <button
              type="button"
              className={`day-card__checklist-square ${completed[index] ? 'day-card__checklist-square--active' : ''}`}
              onClick={() => toggle(index)}
              aria-pressed={completed[index]}
              aria-label={`${label} 완료`}
            />
            <span className="day-card__checklist-label">{label}</span>
          </div>
        ))}
      </div>
      <div className="day-card__save-wrap">
        <button
          type="button"
          className="day-card__save-btn"
          onClick={() => onSave?.({ completed }, 'checklist')}
        >
          저장하기
        </button>
      </div>
    </article>
  )
}

/**
 * 휴식/보강운동: 덤벨숄더프레스·푸쉬업·모빌리티 스트레칭 완료 사각형 + (항목별) 1~4세트 중량·횟수 입력
 * isSaved: 저장된 상태면 읽기 전용 + 수정 버튼
 */
function RestStrengthBlock({ card, onSave, onEdit, onDelete, isSaved, savedPayload }) {
  const items = card.items ?? []
  const savedItems = Array.isArray(savedPayload?.items) ? savedPayload.items : []

  const getInitialSetData = (item, savedItem) => {
    if (savedItem?.sets && Array.isArray(savedItem.sets)) return savedItem.sets
    if (!item.setCount) return null
    const w = item.defaultWeight ?? '3'
    const r = item.defaultReps ?? '10'
    return Array.from({ length: item.setCount }, () => ({ weight: w, reps: r }))
  }
  const getInitialCompleted = () => {
    if (savedItems.length >= items.length) return savedItems.map((s) => !!s.completed)
    return items.map(() => false)
  }
  const getInitialRepsOnly = () =>
    items.map((item, i) => (item.repsOnly ? (savedItems[i]?.reps ?? item.defaultReps ?? '') : null))

  const [completed, setCompleted] = useState(getInitialCompleted)
  const [setData, setSetData] = useState(() =>
    items.map((item, i) => getInitialSetData(item, savedItems[i]))
  )
  const [repsOnlyData, setRepsOnlyData] = useState(getInitialRepsOnly)

  const toggleCompleted = (index) => {
    setCompleted((prev) => {
      const next = [...prev]
      next[index] = !next[index]
      return next
    })
  }

  if (isSaved && savedItems.length >= items.length) {
    const displayItems = items.map((item, i) => {
      const s = savedItems[i] ?? {}
      return {
        ...item,
        completed: !!s.completed,
        sets: s.sets ?? [],
        reps: s.reps,
      }
    })
    return (
      <article className="day-card day-card--rest-strength">
        <p className="day-card__text">
          {card.message?.split(card.highlight).map((part, i, arr) => (
            <span key={i}>
              {part}
              {i < arr.length - 1 && (
                <strong className="day-card__highlight">{card.highlight}</strong>
              )}
            </span>
          ))}
        </p>
        <div className="day-card__rest-strength-list day-card__rest-strength-list--readonly" role="group" aria-label="운동 항목 완료 표시">
          {displayItems.map((dItem, itemIndex) => (
            <div key={itemIndex} className="day-card__rest-strength-item">
              <div className="day-card__checklist-row">
                <span
                  className={`day-card__checklist-square day-card__checklist-square--readonly ${dItem.completed ? 'day-card__checklist-square--active' : ''}`}
                />
                <span className="day-card__checklist-label">{dItem.label}</span>
                {dItem.reps != null && dItem.reps !== '' && (
                  <span className="day-card__set-value">{dItem.reps}회</span>
                )}
              </div>
              {dItem.sets?.length > 0 && (
                <div className="day-card__set-inputs day-card__set-inputs--readonly">
                  {dItem.sets.map((row, setIndex) => (
                    <div key={setIndex} className="day-card__set-input-row">
                      <span className="day-card__set-input-label">{setIndex + 1}세트</span>
                      <span className="day-card__set-value">{row.weight}kg</span>
                      <span className="day-card__set-value">{row.reps}회</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="day-card__save-wrap day-card__save-wrap--actions">
          <button type="button" className="day-card__edit-btn" onClick={onEdit}>
            수정
          </button>
          <button type="button" className="day-card__delete-btn" onClick={onDelete}>
            삭제
          </button>
        </div>
      </article>
    )
  }

  const updateSetValue = (itemIndex, setIndex, field, value) => {
    setSetData((prev) => {
      const next = prev.map((arr, i) => (i === itemIndex && arr ? [...arr] : arr))
      if (next[itemIndex] && next[itemIndex][setIndex]) {
        next[itemIndex][setIndex] = { ...next[itemIndex][setIndex], [field]: value }
      }
      return next
    })
  }

  const updateRepsOnly = (itemIndex, value) => {
    setRepsOnlyData((prev) => {
      const next = [...prev]
      next[itemIndex] = value
      return next
    })
  }

  return (
    <article className="day-card day-card--rest-strength">
      <p className="day-card__text">
        {card.message?.split(card.highlight).map((part, i, arr) => (
          <span key={i}>
            {part}
            {i < arr.length - 1 && (
              <strong className="day-card__highlight">{card.highlight}</strong>
            )}
          </span>
        ))}
      </p>
      <div className="day-card__rest-strength-list" role="group" aria-label="운동 항목 완료 표시">
        {items.map((item, itemIndex) => (
          <div key={itemIndex} className="day-card__rest-strength-item">
            <div className="day-card__checklist-row">
              <button
                type="button"
                className={`day-card__checklist-square ${completed[itemIndex] ? 'day-card__checklist-square--active' : ''}`}
                onClick={() => toggleCompleted(itemIndex)}
                aria-pressed={completed[itemIndex]}
                aria-label={`${item.label} 완료`}
              />
              <span className="day-card__checklist-label">{item.label}</span>
              {item.repsOnly && (
                <div className="day-card__reps-only-wrap">
                  <input
                    type="text"
                    inputMode="numeric"
                    className="day-card__reps-only-input"
                    value={repsOnlyData[itemIndex] ?? ''}
                    onChange={(e) => updateRepsOnly(itemIndex, e.target.value)}
                    placeholder="0"
                    aria-label={`${item.label} 횟수`}
                  />
                  <span className="day-card__set-input-unit">회</span>
                </div>
              )}
            </div>
            {item.setCount > 0 && setData[itemIndex] && (
              <div className="day-card__set-inputs">
                {setData[itemIndex].map((row, setIndex) => (
                  <div key={setIndex} className="day-card__set-input-row">
                    <span className="day-card__set-input-label">{setIndex + 1}세트</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="day-card__set-input day-card__set-input--weight"
                      value={row.weight}
                      onChange={(e) => updateSetValue(itemIndex, setIndex, 'weight', e.target.value)}
                      aria-label={`${setIndex + 1}세트 중량`}
                    />
                    <span className="day-card__set-input-unit">kg</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="day-card__set-input day-card__set-input--reps"
                      value={row.reps}
                      onChange={(e) => updateSetValue(itemIndex, setIndex, 'reps', e.target.value)}
                      aria-label={`${setIndex + 1}세트 횟수`}
                    />
                    <span className="day-card__set-input-unit">회</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="day-card__save-wrap">
        <button
          type="button"
          className="day-card__save-btn"
          onClick={() =>
            onSave?.(
              {
                items: items.map((item, i) => ({
                  completed: completed[i],
                  sets: setData[i],
                  reps: item.repsOnly ? repsOnlyData[i] : undefined,
                })),
              },
              'rest_strength_exercises'
            )
          }
        >
          저장하기
        </button>
      </div>
    </article>
  )
}

/**
 * 지난기록 (휴식/보강 형식): 같은 운동 유형의 가장 최근 기록 표시
 * 기록이 없으면 "지난 운동 기록이 없습니다." 표시
 */
function PreviousRecordsStrengthBlock({ card, latestRecord }) {
  const items = card.items ?? []
  const savedItems = (latestRecord?.detailType === 'rest_strength_exercises' && latestRecord?.payload?.items)
    ? latestRecord.payload.items
    : null

  if (!savedItems || savedItems.length === 0) {
    return (
      <article className="day-card day-card--previous-records-strength">
        {card.title && <h3 className="day-card__list-title">{card.title}</h3>}
        <p className="day-card__no-records">지난 운동 기록이 없습니다.</p>
      </article>
    )
  }

  const displayItems = items.map((item, i) => {
    const s = savedItems[i] ?? {}
    return {
      ...item,
      completed: !!s.completed,
      sets: s.sets ?? [],
      reps: s.reps,
    }
  })

  return (
    <article className="day-card day-card--previous-records-strength">
      {card.title && <h3 className="day-card__list-title">{card.title}</h3>}
      <div className="day-card__rest-strength-list">
        {displayItems.map((item, itemIndex) => (
          <div key={itemIndex} className="day-card__rest-strength-item">
            <div className="day-card__checklist-row">
              <span
                className={`day-card__checklist-square day-card__checklist-square--readonly ${item.completed ? 'day-card__checklist-square--active' : ''}`}
                aria-hidden
              />
              <span className="day-card__checklist-label">{item.label}</span>
              {item.reps != null && item.reps !== '' && (
                <span className="day-card__set-value">{item.reps}회</span>
              )}
            </div>
            {item.sets?.length > 0 && (
              <div className="day-card__set-inputs day-card__set-inputs--readonly">
                {item.sets.map((row, setIndex) => (
                  <div key={setIndex} className="day-card__set-input-row">
                    <span className="day-card__set-input-label">{setIndex + 1}세트</span>
                    <span className="day-card__set-value">{row.weight}kg</span>
                    <span className="day-card__set-value">{row.reps}회</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </article>
  )
}

/**
 * 다가오는 원정 D-day 카드
 * - '다가오는 원정 D-day' 텍스트 제거
 * - 주소 클릭 시 클립보드 복사
 */
function DdayCard({ nextExpeditionLoading, nextExpedition }) {
  const [copied, setCopied] = useState(false)

  const handleCopyAddress = useCallback(() => {
    if (!nextExpedition?.placeAddress) return
    navigator.clipboard.writeText(nextExpedition.placeAddress).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => {})
  }, [nextExpedition?.placeAddress])

  return (
    <article className="day-card day-card--dday">
      {nextExpeditionLoading ? (
        <p className="day-card__no-expedition">로딩 중...</p>
      ) : nextExpedition == null ? (
        <p className="day-card__no-expedition">정해진 다음 원정 계획이 없습니다.</p>
      ) : (
        <>
          <p className="day-card__dday-badge">
            {nextExpedition.daysUntil === 0 ? 'D-day' : `D-${nextExpedition.daysUntil}`}
          </p>
          {nextExpedition.placeName && (
            <h2 className="day-card__title">{nextExpedition.placeName}</h2>
          )}
          {nextExpedition.placeAddress && (
            <button
              type="button"
              className="day-card__address-btn"
              onClick={handleCopyAddress}
              aria-label="주소 복사"
              title="클릭하면 주소가 복사됩니다"
            >
              <span className="day-card__date day-card__date--address">
                {nextExpedition.placeAddress}
              </span>
              {copied && <span className="day-card__copy-feedback">복사됨</span>}
            </button>
          )}
          {nextExpedition.dateLabel && (
            <p className="day-card__date">{nextExpedition.dateLabel}</p>
          )}
        </>
      )}
    </article>
  )
}

/**
 * 백엔드에서 내려주는 카드 데이터(card)에 따라 카드 UI 렌더
 * card.type: dday | today_message | training_sets | training_sets_squares | previous_records | previous_records_strength | checklist | rest_strength_exercises | exercise_method | list | info
 * nextExpedition: DDAY 카드일 때만 전달. { dateLabel, daysUntil, placeName, placeAddress } 또는 null(미지정 시)
 * nextExpeditionLoading: DDAY 카드 로딩 여부
 * onSave: 저장 시 호출 (payload, detailType) => void
 * saveContext: { recordDate, exerciseTypeId, scheduleId } - 저장에 필요한 컨텍스트
 */
export default function DayContentCard({
  card,
  nextExpedition,
  nextExpeditionLoading,
  onSave,
  onDeleteRecord,
  saveContext,
  todayRecord,
  latestRecord,
  isEditingRecord,
  onEditRecord,
}) {
  if (!card) return null

  switch (card.type) {
    case CARD_TYPES.DDAY:
      return (
        <DdayCard
          nextExpeditionLoading={nextExpeditionLoading}
          nextExpedition={nextExpedition}
        />
      )

    case CARD_TYPES.TODAY_MESSAGE:
      return (
        <article className="day-card day-card--message">
          <p className="day-card__text">
            {card.message?.split(card.highlight).map((part, i, arr) => (
              <span key={i}>
                {part}
                {i < arr.length - 1 && (
                  <strong className="day-card__highlight">{card.highlight}</strong>
                )}
              </span>
            ))}
          </p>
        </article>
      )

    case CARD_TYPES.TRAINING_SETS: {
      const isSaved =
        !isEditingRecord && todayRecord?.detailType === 'training_sets'
      return (
        <TrainingSetsBlock
          key={`training-sets-${isSaved ? 'saved' : 'edit'}`}
          card={card}
          onSave={saveContext ? (p, t) => onSave?.(p, t) : undefined}
          onEdit={onEditRecord}
          onDelete={onDeleteRecord}
          isSaved={isSaved}
          savedPayload={todayRecord?.detailType === 'training_sets' ? todayRecord?.payload : undefined}
        />
      )
    }

    case CARD_TYPES.TRAINING_SETS_SQUARES: {
      const isSaved =
        !isEditingRecord && todayRecord?.detailType === 'training_sets_squares'
      return (
        <TrainingSetsSquaresBlock
          key={`training-sets-squares-${isSaved ? 'saved' : 'edit'}`}
          card={card}
          onSave={saveContext ? (p, t) => onSave?.(p, t) : undefined}
          onEdit={onEditRecord}
          onDelete={onDeleteRecord}
          isSaved={isSaved}
          savedPayload={todayRecord?.detailType === 'training_sets_squares' ? todayRecord?.payload : undefined}
        />
      )
    }

    case CARD_TYPES.PREVIOUS_RECORDS:
      return <PreviousRecordsBlock card={card} latestRecord={latestRecord} />

    case CARD_TYPES.CHECKLIST: {
      const isSaved = !isEditingRecord && todayRecord?.detailType === 'checklist'
      return (
        <ChecklistBlock
          key={`checklist-${isSaved ? 'saved' : 'edit'}`}
          card={card}
          onSave={saveContext ? (p, t) => onSave?.(p, t) : undefined}
          onEdit={onEditRecord}
          onDelete={onDeleteRecord}
          isSaved={isSaved}
          savedPayload={todayRecord?.detailType === 'checklist' ? todayRecord?.payload : undefined}
        />
      )
    }

    case CARD_TYPES.REST_STRENGTH_EXERCISES: {
      const isSaved =
        !isEditingRecord && todayRecord?.detailType === 'rest_strength_exercises'
      return (
        <RestStrengthBlock
          key={`rest-strength-${isSaved ? 'saved' : 'edit'}`}
          card={card}
          onSave={saveContext ? (p, t) => onSave?.(p, t) : undefined}
          onEdit={onEditRecord}
          onDelete={onDeleteRecord}
          isSaved={isSaved}
          savedPayload={todayRecord?.detailType === 'rest_strength_exercises' ? todayRecord?.payload : undefined}
        />
      )
    }

    case CARD_TYPES.PREVIOUS_RECORDS_STRENGTH:
      return <PreviousRecordsStrengthBlock card={card} latestRecord={latestRecord} />

    case CARD_TYPES.EXERCISE_METHOD:
      return (
        <article className="day-card day-card--exercise-method">
          {card.title && <h3 className="day-card__list-title">{card.title}</h3>}
          {card.detail && <p className="day-card__detail">{card.detail}</p>}
        </article>
      )

    case CARD_TYPES.LIST:
      return (
        <article className="day-card day-card--list">
          {card.title && <h3 className="day-card__list-title">{card.title}</h3>}
          {card.items?.length > 0 && (
            <ul className="day-card__list">
              {card.items.map((item, i) => (
                <li key={i} className="day-card__list-item">{item}</li>
              ))}
            </ul>
          )}
        </article>
      )

    case CARD_TYPES.INFO:
      return (
        <article className="day-card day-card--info">
          {card.title && <h3 className="day-card__list-title">{card.title}</h3>}
          {card.description && (
            <p className="day-card__description">{card.description}</p>
          )}
        </article>
      )

    default:
      return null
  }
}
