import { useState, useEffect, useRef } from 'react'
import './NumberPickerModal.css'

export default function NumberPickerModal({ title, initialValue = 1, min = 1, max = 99, onConfirm, onCancel }) {
  const [value, setValue] = useState(Math.max(min, Math.min(max, initialValue)))
  const columnRef = useRef(null)

  const options = Array.from({ length: max - min + 1 }, (_, i) => min + i)

  useEffect(() => {
    setValue(Math.max(min, Math.min(max, initialValue)))
  }, [initialValue, min, max])

  useEffect(() => {
    if (columnRef.current) {
      const optionEl = columnRef.current.querySelector(`[data-value="${value}"]`)
      if (optionEl) {
        optionEl.scrollIntoView({ block: 'center', behavior: 'auto' })
      }
    }
  }, [])

  const handleScroll = () => {
    const el = columnRef.current
    if (!el) return
    const itemHeight = 48
    const center = el.scrollTop + el.clientHeight / 2
    const index = Math.round(center / itemHeight)
    const newVal = options[Math.max(0, Math.min(index, options.length - 1))]
    if (newVal !== value) setValue(newVal)
  }

  const handleConfirm = () => {
    onConfirm?.(value)
  }

  return (
    <div className="number-picker-overlay" onClick={onCancel}>
      <div className="number-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="number-picker-header">
          <button type="button" className="number-picker-btn number-picker-btn--cancel" onClick={onCancel}>
            취소
          </button>
          <h3 className="number-picker-title">{title}</h3>
          <button type="button" className="number-picker-btn number-picker-btn--confirm" onClick={handleConfirm}>
            완료
          </button>
        </div>
        <div className="number-picker-body">
          <div className="number-picker-column-wrap">
            <div
              ref={columnRef}
              className="number-picker-column"
              onScroll={handleScroll}
            >
              {options.map((n) => (
                <button
                  key={n}
                  type="button"
                  data-value={n}
                  className={`number-picker-option ${value === n ? 'number-picker-option--selected' : ''}`}
                  onClick={() => {
                    setValue(n)
                    const el = columnRef.current?.querySelector(`[data-value="${n}"]`)
                    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
            <span className="number-picker-unit">라운드</span>
          </div>
        </div>
      </div>
    </div>
  )
}
