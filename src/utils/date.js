/**
 * 한국 시간(KST, Asia/Seoul) 기준 날짜 유틸리티
 * new Date().toISOString().slice(0,10) 은 UTC 기준이라
 * 한국 새벽/심야에 날짜가 어긋날 수 있어 KST 기준으로 사용
 */

/** 오늘 날짜 (YYYY-MM-DD) - 한국 시간 기준 */
export function getTodayKST() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
}

/** Date 또는 문자열을 한국 시간 기준 YYYY-MM-DD로 변환 */
export function toDateStringKST(dateOrString) {
  if (typeof dateOrString === 'string') return dateOrString
  if (!dateOrString) return null
  return dateOrString.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
}
