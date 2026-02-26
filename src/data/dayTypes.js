/**
 * 7가지 날 유형 (추후 백엔드에서 날짜별로 이 id가 내려옴)
 * DB/API: 날짜 → dayTypeId → 해당 날의 카드 목록
 */
export const DAY_TYPE_IDS = {
  EXPEDITION: 'expedition',           // 원정가는 날
  REST: 'rest',                       // 휴식하는 날
  FINGER: 'finger',                   // 손가락훈련하는 날
  POWER_BOULDERING: 'power_bouldering', // 파워볼더링하는 날
  REST_CARDIO: 'rest_cardio',         // 휴식/유산소하는 날
  ENDURANCE: 'endurance',            // 근지구력하는 날
  REST_STRENGTH: 'rest_strength',     // 휴식/보강운동하는 날
}

export const DAY_TYPES = [
  { id: DAY_TYPE_IDS.EXPEDITION, label: '원정가는 날' },
  { id: DAY_TYPE_IDS.REST, label: '휴식하는 날' },
  { id: DAY_TYPE_IDS.FINGER, label: '손가락훈련하는 날' },
  { id: DAY_TYPE_IDS.POWER_BOULDERING, label: '파워볼더링하는 날' },
  { id: DAY_TYPE_IDS.REST_CARDIO, label: '휴식/유산소하는 날' },
  { id: DAY_TYPE_IDS.ENDURANCE, label: '근지구력하는 날' },
  { id: DAY_TYPE_IDS.REST_STRENGTH, label: '휴식/보강운동하는 날' },
]

/**
 * 카드 타입 (백엔드에서 내려줄 카드 구조와 맞춤)
 * - dday: 다가오는 원정 D-day 카드
 * - today_message: "오늘은 ~날 입니다" 메시지 카드
 * - training_sets: 메시지 + 1 set~n set 버튼 + 저장하기 (손가락훈련 등)
 * - training_sets_squares: 1set~4set 각각 옆에 사각형 N개 완료 표시 (파워볼더링 등)
 * - previous_records: 지난기록 (세트별 사각형 완료 상태 읽기 전용, 파워볼더링/근지구력)
 * - previous_records_strength: 지난기록 (항목별 완료 + 1~4세트 중량/횟수 읽기 전용, 휴식/보강)
 * - checklist: 메시지 + 항목별 왼쪽 사각형 완료 표시 + 저장하기 (휴식/유산소 등)
 * - rest_strength_exercises: 메시지 + 항목별 완료 사각형 + (선택) 1~4세트 중량/횟수 입력 (휴식/보강운동)
 * - exercise_method: 운동방법 제목 + 상세
 * - list: 제목 + 항목 리스트 카드
 * - info: 제목 + 부가 설명 카드
 * - expedition_climbs: 원정 당일 색상(난이도)별 완등 수 기록 + 이전 방문 기록
 */
export const CARD_TYPES = {
  DDAY: 'dday',
  TODAY_MESSAGE: 'today_message',
  TRAINING_SETS: 'training_sets',
  TRAINING_SETS_SQUARES: 'training_sets_squares',
  PREVIOUS_RECORDS: 'previous_records',
  PREVIOUS_RECORDS_STRENGTH: 'previous_records_strength',
  CHECKLIST: 'checklist',
  REST_STRENGTH_EXERCISES: 'rest_strength_exercises',
  EXERCISE_METHOD: 'exercise_method',
  LIST: 'list',
  INFO: 'info',
  EXPEDITION_CLIMBS: 'expedition_climbs',
}
