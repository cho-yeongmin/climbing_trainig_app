import { useState, useEffect, useRef } from 'react'
import './TimePickerModal.css'

function formatTwoDigits(n) {
  return String(n).padStart(2, '0')
}

const VALUES = Array.from({ length: 60 }, (_, i) => i)
const ITEM_HEIGHT = 40
const COLUMN_HEIGHT = 120
const COPIES = 5

export default function TimePickerModal({ title, initialMinutes = 0, initialSeconds = 10, onConfirm, onCancel }) {
  const [minutes, setMinutes] = useState(initialMinutes)
  const [seconds, setSeconds] = useState(initialSeconds)
  const minutesRef = useRef(null)
  const secondsRef = useRef(null)

  const allMinutes = Array.from({ length: VALUES.length * COPIES }, (_, i) => VALUES[i % VALUES.length])
  const allSeconds = Array.from({ length: VALUES.length * COPIES }, (_, i) => VALUES[i % VALUES.length])

  const scrollToValue = (ref, value, isMinutes) => {
    if (!ref?.current) return
    const middleCopy = Math.floor(COPIES / 2)
    const targetIndex = middleCopy * VALUES.length + value
    const targetScroll = targetIndex * ITEM_HEIGHT - (COLUMN_HEIGHT / 2 - ITEM_HEIGHT / 2)
    ref.current.scrollTop = Math.max(0, targetScroll)
  }

  useEffect(() => {
    scrollToValue(minutesRef, initialMinutes)
    scrollToValue(secondsRef, initialSeconds)
  }, [])

  const getValueFromScroll = (scrollTop) => {
    const index = Math.round((scrollTop + COLUMN_HEIGHT / 2 - ITEM_HEIGHT / 2) / ITEM_HEIGHT)
    return ((index % VALUES.length) + VALUES.length) % VALUES.length
  }

  const handleScroll = (ref, setter) => {
    if (!ref?.current) return
    const val = getValueFromScroll(ref.current.scrollTop)
    setter(val)
    return val
  }

  const maybeResetScroll = (ref, value, setter) => {
    if (!ref?.current) return
    const scrollTop = ref.current.scrollTop
    const totalHeight = VALUES.length * COPIES * ITEM_HEIGHT
    const oneCopyHeight = VALUES.length * ITEM_HEIGHT
    if (scrollTop < oneCopyHeight) {
      const prevValue = (value - 1 + VALUES.length) % VALUES.length
      setter(prevValue)
      scrollToValue(ref, prevValue)
    } else if (scrollTop > totalHeight - oneCopyHeight - COLUMN_HEIGHT) {
      const nextValue = (value + 1) % VALUES.length
      setter(nextValue)
      scrollToValue(ref, nextValue)
    }
  }

  const handleMinutesScroll = () => {
    const val = handleScroll(minutesRef, setMinutes)
    if (val !== undefined) maybeResetScroll(minutesRef, val, setMinutes)
  }

  const handleSecondsScroll = () => {
    const val = handleScroll(secondsRef, setSeconds)
    if (val !== undefined) maybeResetScroll(secondsRef, val, setSeconds)
  }

  const handleConfirm = () => {
    onConfirm?.(minutes, seconds)
  }

  const scrollToMinutes = (m) => {
    setMinutes(m)
    scrollToValue(minutesRef, m)
  }

  const scrollToSeconds = (s) => {
    setSeconds(s)
    scrollToValue(secondsRef, s)
  }

  return (
    <div className="time-picker-overlay" onClick={onCancel}>
      <div className="time-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="time-picker-header">
          <button type="button" className="time-picker-btn time-picker-btn--cancel" onClick={onCancel}>
            취소
          </button>
          <h3 className="time-picker-title">{title}</h3>
          <button type="button" className="time-picker-btn time-picker-btn--confirm" onClick={handleConfirm}>
            완료
          </button>
        </div>
        <div className="time-picker-body">
          <div className="time-picker-column-wrap">
            <div
              ref={minutesRef}
              className="time-picker-column"
              onScroll={handleMinutesScroll}
            >
              {allMinutes.map((m, i) => (
                <button
                  key={`m-${i}`}
                  type="button"
                  className={`time-picker-option ${minutes === m ? 'time-picker-option--selected' : ''}`}
                  onClick={() => scrollToMinutes(m)}
                  style={{ height: ITEM_HEIGHT }}
                >
                  {formatTwoDigits(m)}
                </button>
              ))}
            </div>
            <span className="time-picker-unit">분</span>
          </div>
          <div className="time-picker-column-wrap">
            <div
              ref={secondsRef}
              className="time-picker-column"
              onScroll={handleSecondsScroll}
            >
              {allSeconds.map((s, i) => (
                <button
                  key={`s-${i}`}
                  type="button"
                  className={`time-picker-option ${seconds === s ? 'time-picker-option--selected' : ''}`}
                  onClick={() => scrollToSeconds(s)}
                  style={{ height: ITEM_HEIGHT }}
                >
                  {formatTwoDigits(s)}
                </button>
              ))}
            </div>
            <span className="time-picker-unit">초</span>
          </div>
        </div>
      </div>
    </div>
  )
}
