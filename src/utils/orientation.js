/**
 * JS 기반 가로 모드 감지 - CSS @media (orientation) 미동작 시 대응
 * width > height 로 직접 판단하여 html 에 class 추가
 */
const LANDSCAPE_2COL_MAX_HEIGHT = 900
const LANDSCAPE_SHORT_MAX_HEIGHT = 500

function updateOrientation() {
  const w = window.innerWidth
  const h = window.innerHeight
  const isLandscape = w > h
  const is2col = isLandscape && h <= LANDSCAPE_2COL_MAX_HEIGHT
  const isShort = isLandscape && h <= LANDSCAPE_SHORT_MAX_HEIGHT

  const root = document.documentElement
  root.classList.toggle('is-landscape', isLandscape)
  root.classList.toggle('is-landscape-2col', is2col)
  root.classList.toggle('is-landscape-short', isShort)
}

export function initOrientation() {
  updateOrientation()

  window.addEventListener('orientationchange', () => {
    // 회전 직후 viewport 갱신 지연 대비
    setTimeout(updateOrientation, 100)
  })
  window.addEventListener('resize', updateOrientation)
}
