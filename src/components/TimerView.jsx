import { useState, useEffect, useRef, useCallback } from 'react'
import { playBeep, playLongBeep } from '../utils/beep'
import IntervalSettings from './IntervalSettings'
import TimePickerModal from './TimePickerModal'
import './TimerView.css'

const STORAGE_KEY = 'climbing_timer_interval'
const COUNTDOWN_STORAGE_KEY = 'climbing_timer_countdown_seconds'
const DEFAULT_INTERVAL = { prepare: 10, exercise: 15, rest: 30, rounds: 5 }

function loadIntervalSettings() {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    if (s) {
      const parsed = JSON.parse(s)
      return {
        prepare: parsed.prepare ?? DEFAULT_INTERVAL.prepare,
        exercise: parsed.exercise ?? DEFAULT_INTERVAL.exercise,
        rest: parsed.rest ?? DEFAULT_INTERVAL.rest,
        rounds: parsed.rounds ?? DEFAULT_INTERVAL.rounds,
      }
    }
  } catch (_) {}
  return { ...DEFAULT_INTERVAL }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function loadCountdownSeconds() {
  try {
    const s = localStorage.getItem(COUNTDOWN_STORAGE_KEY)
    if (s) return parseInt(s, 10)
  } catch (_) {}
  return 60
}

function saveCountdownSeconds(sec) {
  try {
    localStorage.setItem(COUNTDOWN_STORAGE_KEY, String(sec))
  } catch (_) {}
}

function CountdownTimer({ onBeep }) {
  const [totalSec, setTotalSec] = useState(loadCountdownSeconds)
  const [remaining, setRemaining] = useState(null)
  const [isRunning, setIsRunning] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const lastBeepSec = useRef(null)

  const start = () => {
    if (totalSec > 0) {
      setRemaining(totalSec)
      setIsRunning(true)
    }
  }

  const reset = () => {
    setIsRunning(false)
    setRemaining(null)
  }

  const handleTimeConfirm = (minutes, seconds) => {
    const sec = minutes * 60 + seconds
    setTotalSec(sec)
    saveCountdownSeconds(sec)
    setShowTimePicker(false)
  }

  useEffect(() => {
    if (!isRunning || remaining == null) return
    if (remaining <= 0) {
      setIsRunning(false)
      playLongBeep()
      onBeep?.()
      return
    }
    if (remaining <= 3 && remaining !== lastBeepSec.current) {
      lastBeepSec.current = remaining
      playBeep()
    }
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000)
    return () => clearTimeout(id)
  }, [isRunning, remaining])

  if (isRunning) {
    return (
      <div className="timer-view__countdown">
        <div className="timer-view__display timer-view__display--countdown">
          {formatTime(remaining ?? 0)}
        </div>
        <button type="button" className="timer-view__reset-btn" onClick={reset}>
          초기화
        </button>
      </div>
    )
  }

  return (
    <div className="timer-view__countdown">
      <button
        type="button"
        className="timer-view__time-set-btn"
        onClick={() => setShowTimePicker(true)}
      >
        {formatTime(totalSec)}
      </button>
      <button type="button" className="timer-view__start-btn" onClick={start} disabled={totalSec === 0}>
        시작
      </button>
      {showTimePicker && (
        <TimePickerModal
          title="시간 설정"
          initialMinutes={Math.floor(totalSec / 60)}
          initialSeconds={totalSec % 60}
          onConfirm={handleTimeConfirm}
          onCancel={() => setShowTimePicker(false)}
        />
      )}
    </div>
  )
}

function IntervalTimer({ settings, onBeep }) {
  const [phase, setPhase] = useState('prepare')
  const [remaining, setRemaining] = useState(null)
  const [roundLeft, setRoundLeft] = useState(null)
  const [isRunning, setIsRunning] = useState(false)
  const lastBeepSec = useRef(null)

  const phases = [
    { key: 'prepare', label: '준비', color: '#ffd700' },
    { key: 'exercise', label: '운동', color: '#32cd32' },
    { key: 'rest', label: '휴식', color: '#dc3545' },
  ]

  const start = () => {
    setRoundLeft(settings.rounds)
    setPhase('prepare')
    setRemaining(settings.prepare)
    setIsRunning(true)
    lastBeepSec.current = null
  }

  const reset = () => {
    setIsRunning(false)
    setRemaining(null)
    setPhase(null)
    setRoundLeft(null)
  }

  useEffect(() => {
    if (!isRunning || remaining == null) return
    if (remaining <= 0) {
      const idx = phases.findIndex((p) => p.key === phase)
      if (phase === 'prepare') {
        playLongBeep()
        setPhase('exercise')
        setRemaining(settings.exercise)
      } else if (phase === 'exercise') {
        playLongBeep()
        setPhase('rest')
        setRemaining(settings.rest)
      } else {
        const next = roundLeft - 1
        if (next <= 0) {
          playLongBeep()
          setIsRunning(false)
          onBeep?.()
          return
        }
        playLongBeep()
        setRoundLeft(next)
        setPhase('exercise')
        setRemaining(settings.exercise)
      }
      lastBeepSec.current = null
      return
    }
    if (remaining <= 3 && remaining !== lastBeepSec.current) {
      lastBeepSec.current = remaining
      playBeep()
    }
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000)
    return () => clearTimeout(id)
  }, [isRunning, remaining, phase, roundLeft])

  const currentPhaseConfig = phases.find((p) => p.key === phase)

  if (isRunning) {
    return (
      <div className="timer-view__interval">
        <div
          className="timer-view__phase-block"
          style={{ backgroundColor: currentPhaseConfig?.color }}
        >
          <span className="timer-view__phase-label">{currentPhaseConfig?.label}</span>
          <span className="timer-view__phase-time">{formatTime(remaining ?? 0)}</span>
        </div>
        <div className="timer-view__next-phase">
          {phase === 'prepare' && (
            <div className="timer-view__next-row" style={{ borderColor: '#32cd32' }}>
              <span>운동</span>
              <span>{formatTime(settings.exercise)}</span>
            </div>
          )}
          {phase === 'exercise' && (
            <div className="timer-view__next-row" style={{ borderColor: '#dc3545' }}>
              <span>휴식</span>
              <span>{formatTime(settings.rest)}</span>
            </div>
          )}
          {phase === 'rest' && (
            <div className="timer-view__next-row" style={{ borderColor: '#32cd32' }}>
              <span>운동</span>
              <span>{formatTime(settings.exercise)}</span>
            </div>
          )}
        </div>
        <div className="timer-view__round-bar">
          <div className="timer-view__round-cell">
            <span className="timer-view__round-num">{roundLeft ?? 0}</span>
            <span className="timer-view__round-text">남은 라운드</span>
          </div>
          <button type="button" className="timer-view__reset-btn" onClick={reset}>
            초기화
          </button>
          <div className="timer-view__round-cell">
            <span className="timer-view__round-num">{roundLeft != null ? settings.rounds - roundLeft : 0}</span>
            <span className="timer-view__round-text">완료 라운드</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="timer-view__interval">
      <div className="timer-view__interval-blocks">
        <div className="timer-view__block timer-view__block--prepare" style={{ backgroundColor: '#ffd700' }}>
          <span>준비</span>
          <span>{formatTime(settings.prepare)}</span>
        </div>
        <div className="timer-view__block timer-view__block--exercise" style={{ backgroundColor: '#32cd32' }}>
          <span>운동</span>
          <span>{formatTime(settings.exercise)}</span>
        </div>
      </div>
      <div className="timer-view__round-bar">
        <div className="timer-view__round-cell">
          <span className="timer-view__round-num">{settings.rounds}</span>
          <span className="timer-view__round-text">남은 라운드</span>
        </div>
        <button type="button" className="timer-view__start-btn" onClick={start}>
          시작
        </button>
        <div className="timer-view__round-cell">
          <span className="timer-view__round-num">0</span>
          <span className="timer-view__round-text">완료 라운드</span>
        </div>
      </div>
    </div>
  )
}

function StopwatchTimer() {
  const [elapsed, setElapsed] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const startRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    if (!isRunning) return
    startRef.current = startRef.current ?? Date.now() - elapsed * 1000
    const tick = () => {
      setElapsed((Date.now() - startRef.current) / 1000)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [isRunning])

  const start = () => {
    if (!isRunning) startRef.current = Date.now() - elapsed * 1000
    setIsRunning(true)
  }
  const pause = () => setIsRunning(false)
  const reset = () => {
    setIsRunning(false)
    setElapsed(0)
    startRef.current = null
  }

  const m = Math.floor(elapsed / 60)
  const s = Math.floor(elapsed % 60)
  const ms = Math.floor((elapsed % 1) * 100)

  return (
    <div className="timer-view__stopwatch">
      <div className="timer-view__display timer-view__display--stopwatch">
        {formatTime(m * 60 + s)}.{String(ms).padStart(2, '0')}
      </div>
      <div className="timer-view__stopwatch-actions">
        <button type="button" className="timer-view__stopwatch-btn" onClick={reset}>
          초기화
        </button>
        <button
          type="button"
          className="timer-view__start-btn timer-view__start-btn--large"
          onClick={isRunning ? pause : start}
        >
          {isRunning ? '일시정지' : '시작'}
        </button>
      </div>
    </div>
  )
}

export default function TimerView({ dayTypeId, onClose }) {
  const mode = (() => {
    if (dayTypeId === 'power_bouldering') return 'countdown'
    if (dayTypeId === 'finger') return 'interval'
    if (dayTypeId === 'endurance') return 'stopwatch'
    return 'interval'
  })()
  const [intervalSettings, setIntervalSettings] = useState(loadIntervalSettings)
  const [showIntervalSettings, setShowIntervalSettings] = useState(false)

  const saveIntervalSettings = useCallback((val) => {
    setIntervalSettings(val)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
    } catch (_) {}
    setShowIntervalSettings(false)
  }, [])

  const handleSaveFromFooter = () => {
    saveIntervalSettings(intervalSettings)
  }

  return (
    <div className={`timer-view ${onClose ? 'timer-view--fullscreen' : ''}`}>
      {mode === 'interval' && !showIntervalSettings && (
        <button
          type="button"
          className="timer-view__settings-btn"
          onClick={() => setShowIntervalSettings(true)}
          aria-label="인터벌 설정"
        >
          ⚙
        </button>
      )}
      {showIntervalSettings ? (
        <div className="timer-view__content">
          <IntervalSettings
          value={intervalSettings}
          onChange={setIntervalSettings}
          onCancel={() => setShowIntervalSettings(false)}
          onSave={() => saveIntervalSettings(intervalSettings)}
          saveInFooter={Boolean(onClose)}
        />
        </div>
      ) : (
        <div className="timer-view__content">
          {mode === 'countdown' && <CountdownTimer />}
          {mode === 'interval' && <IntervalTimer settings={intervalSettings} />}
          {mode === 'stopwatch' && <StopwatchTimer />}
        </div>
      )}
      {onClose && (
        <div className="timer-view__footer">
          {showIntervalSettings && mode === 'interval' ? (
            <button
              type="button"
              className="timer-view__footer-btn timer-view__footer-btn--save"
              onClick={handleSaveFromFooter}
            >
              저장
            </button>
          ) : (
            <button
              type="button"
              className="timer-view__footer-btn"
              onClick={onClose}
            >
              종료
            </button>
          )}
        </div>
      )}
    </div>
  )
}
