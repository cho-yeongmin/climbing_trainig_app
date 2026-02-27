/**
 * Screen Orientation API - Android Chrome
 * 가로 모드 버튼: 화면을 오른쪽 90도(landscape-primary)로 잠금
 */

function hasOrientationAPI() {
  return typeof screen !== 'undefined' && screen.orientation && typeof screen.orientation.lock === 'function'
}

export function canLockOrientation() {
  return hasOrientationAPI()
}

/**
 * 화면을 가로(오른쪽 90도)로 잠금
 * Chrome Android: fullscreen 후 lock 시도 (성공률 높음)
 * @returns {Promise<boolean>} 성공 여부
 */
export async function lockLandscape() {
  if (!hasOrientationAPI()) return false

  // 1) fullscreen 없이 lock 시도
  try {
    await screen.orientation.lock('landscape-primary')
    return true
  } catch (_) {}

  try {
    await screen.orientation.lock('landscape')
    return true
  } catch (_) {}

  // 2) Chrome Android: fullscreen 후 lock
  try {
    await document.documentElement.requestFullscreen()
    await screen.orientation.lock('landscape-primary')
    return true
  } catch (_) {
    try {
      await screen.orientation.lock('landscape')
      return true
    } catch (_) {
      return false
    }
  }
}

/**
 * 화면 잠금 해제
 */
export async function unlockOrientation() {
  try {
    screen.orientation?.unlock?.()
  } catch (_) {}

  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    }
  } catch (_) {}
}
