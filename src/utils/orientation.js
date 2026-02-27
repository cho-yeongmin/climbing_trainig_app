/**
 * JS 기반 가로 모드 감지 - CSS @media (orientation) 미동작 시 대응
 * width > height 로 직접 판단하여 html 에 class 추가
 */
const LANDSCAPE_2COL_MAX_HEIGHT = 900
const LANDSCAPE_SHORT_MAX_HEIGHT = 500
const STORAGE_KEY = 'force-landscape-layout'

let forceLandscape = false

function updateOrientation() {
  const w = window.innerWidth
  const h = window.innerHeight
  let isLandscape = w > h
  let is2col = isLandscape && h <= LANDSCAPE_2COL_MAX_HEIGHT
  let isShort = isLandscape && h <= LANDSCAPE_SHORT_MAX_HEIGHT

  if (forceLandscape) {
    isLandscape = true
    is2col = h <= LANDSCAPE_2COL_MAX_HEIGHT
    isShort = h <= LANDSCAPE_SHORT_MAX_HEIGHT
  }

  const root = document.documentElement
  root.classList.toggle('is-landscape', isLandscape)
  root.classList.toggle('is-landscape-2col', is2col)
  root.classList.toggle('is-landscape-short', isShort)
}

export function initOrientation() {
  try {
    forceLandscape = sessionStorage.getItem(STORAGE_KEY) === '1'
  } catch (_) {}
  updateOrientation()

  window.addEventListener('orientationchange', () => {
    setTimeout(updateOrientation, 100)
  })
  window.addEventListener('resize', updateOrientation)
}

export function setForceLandscape(on) {
  forceLandscape = !!on
  try {
    sessionStorage.setItem(STORAGE_KEY, on ? '1' : '0')
  } catch (_) {}
  updateOrientation()
}

export function getForceLandscape() {
  return forceLandscape
}
