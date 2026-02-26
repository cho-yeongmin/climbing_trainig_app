/**
 * 타이머 비프 소리 (외부 MP3 파일 사용)
 * - 짧은 삑: shortbeep.mp3 (3초 카운트다운 알림)
 * - 긴 삐--익: longbeep.mp3 (운동 시작, 휴식 종료 시)
 */

const SHORT_BEEP_URL = '/sounds/shortbeep.mp3'
const LONG_BEEP_URL = '/sounds/longbeep.mp3'

let shortBeep = null
let longBeep = null

function getShortBeep() {
  if (!shortBeep) shortBeep = new Audio(SHORT_BEEP_URL)
  return shortBeep
}

function getLongBeep() {
  if (!longBeep) longBeep = new Audio(LONG_BEEP_URL)
  return longBeep
}

/** 짧은 삑 소리 (3초 알림용) */
export function playBeep() {
  try {
    const audio = getShortBeep()
    audio.currentTime = 0
    audio.volume = 1.0
    audio.play().catch((e) => console.warn('Beep failed:', e))
  } catch (e) {
    console.warn('Beep failed:', e)
  }
}

/** 긴 삐--익 소리 (운동 시작, 휴식 종료 시) */
export function playLongBeep() {
  try {
    const audio = getLongBeep()
    audio.currentTime = 0
    audio.volume = 1.0
    audio.play().catch((e) => console.warn('Long beep failed:', e))
  } catch (e) {
    console.warn('Long beep failed:', e)
  }
}
