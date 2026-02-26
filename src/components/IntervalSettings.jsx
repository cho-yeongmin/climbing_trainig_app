import { useState } from 'react'
import TimePickerModal from './TimePickerModal'
import NumberPickerModal from './NumberPickerModal'
import './IntervalSettings.css'

const INTERVAL_KEYS = ['prepare', 'exercise', 'rest']
const INTERVAL_CONFIG = {
  prepare: { label: '준비', subtitle: '시작하기 전 카운트다운', color: '#ffd700' },
  exercise: { label: '운동', subtitle: '오래 운동하기', color: '#32cd32' },
  rest: { label: '휴식', subtitle: '오래 휴식하기', color: '#dc3545' },
  rounds: { label: '라운드', subtitle: '1라운드는 운동 + 휴식입니다', color: '#87ceeb' },
}

function formatTime(minutes, seconds) {
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export default function IntervalSettings({ value, onChange, onCancel, onSave, saveInFooter }) {
  const [timePickerKey, setTimePickerKey] = useState(null)
  const [showRoundsPicker, setShowRoundsPicker] = useState(false)

  const handleTimeConfirm = (key, minutes, seconds) => {
    onChange?.({ ...value, [key]: minutes * 60 + seconds })
    setTimePickerKey(null)
  }

  const handleRoundsConfirm = (n) => {
    onChange?.({ ...value, rounds: n })
    setShowRoundsPicker(false)
  }

  return (
    <div className="interval-settings">
      <div className="interval-settings__header">
        <button type="button" className="interval-settings__btn interval-settings__btn--cancel" onClick={onCancel}>
          취소
        </button>
        <h2 className="interval-settings__title">라운드</h2>
        {saveInFooter ? (
          <span className="interval-settings__header-spacer" aria-hidden="true" />
        ) : (
          <button type="button" className="interval-settings__btn interval-settings__btn--save" onClick={onSave}>
            저장
          </button>
        )}
      </div>

      <h3 className="interval-settings__section">인터벌</h3>

      <div className="interval-settings__list">
        {INTERVAL_KEYS.map((key) => {
          const config = INTERVAL_CONFIG[key]
          const totalSeconds = value?.[key] ?? 0
          const minutes = Math.floor(totalSeconds / 60)
          const seconds = totalSeconds % 60
          return (
            <button
              key={key}
              type="button"
              className="interval-settings__row"
              onClick={() => setTimePickerKey(key)}
            >
              <span className="interval-settings__icon" style={{ backgroundColor: config.color }} />
              <div className="interval-settings__text">
                <span className="interval-settings__label">{config.label}</span>
                <span className="interval-settings__subtitle">{config.subtitle}</span>
              </div>
              <span className="interval-settings__value">{formatTime(minutes, seconds)}</span>
              <span className="interval-settings__arrow">›</span>
            </button>
          )
        })}

        <button
          type="button"
          className="interval-settings__row"
          onClick={() => setShowRoundsPicker(true)}
        >
          <span className="interval-settings__icon" style={{ backgroundColor: INTERVAL_CONFIG.rounds.color }} />
          <div className="interval-settings__text">
            <span className="interval-settings__label">{INTERVAL_CONFIG.rounds.label}</span>
            <span className="interval-settings__subtitle">{INTERVAL_CONFIG.rounds.subtitle}</span>
          </div>
          <span className="interval-settings__value">{value?.rounds ?? 4}</span>
          <span className="interval-settings__arrow">›</span>
        </button>
      </div>

      {timePickerKey && (
        <TimePickerModal
          key={timePickerKey}
          title={INTERVAL_CONFIG[timePickerKey].label}
          initialMinutes={Math.floor((value?.[timePickerKey] ?? 0) / 60)}
          initialSeconds={(value?.[timePickerKey] ?? 0) % 60}
          onConfirm={(min, sec) => handleTimeConfirm(timePickerKey, min, sec)}
          onCancel={() => setTimePickerKey(null)}
        />
      )}
      {showRoundsPicker && (
        <NumberPickerModal
          title={INTERVAL_CONFIG.rounds.label}
          initialValue={value?.rounds ?? 4}
          min={1}
          max={99}
          onConfirm={handleRoundsConfirm}
          onCancel={() => setShowRoundsPicker(false)}
        />
      )}
    </div>
  )
}
