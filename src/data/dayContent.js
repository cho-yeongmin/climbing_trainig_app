/**
 * 날짜에 따른 오늘의 유형 & 카드 목록
 * 추후: API 예) GET /api/day?date=2026-02-28 → { dayTypeId, cards }
 * 현재: 목업으로 날짜별 dayTypeId 결정 후, 유형별 카드 템플릿 반환
 */

import { DAY_TYPE_IDS, DAY_TYPES, CARD_TYPES } from './dayTypes'

/**
 * 목업: 날짜로 오늘의 dayTypeId 결정 (추후 API에서 대체)
 * 예: 요일/주차 기반으로 7가지 유형 로테이션
 */
export function getDayTypeIdForDate(date) {
  const d = typeof date === 'string' ? new Date(date) : date
  const dayOfWeek = d.getDay()
  const weekOfYear = getWeekNumber(d)
  const index = (weekOfYear * 7 + dayOfWeek) % DAY_TYPES.length
  return DAY_TYPES[index].id
}

function getWeekNumber(d) {
  const start = new Date(d.getFullYear(), 0, 1)
  const diff = d - start
  return Math.floor(diff / 7 / 24 / 60 / 60 / 1000)
}

/**
 * 유형별 카드 목록 (추후 백엔드에서 날짜+유형 기준으로 동일 구조로 내려줄 예정)
 * cards[].type 에 따라 UI 컴포넌트가 바뀜
 */
export function getCardsForDayType(dayTypeId) {
  const templates = {
    [DAY_TYPE_IDS.EXPEDITION]: [
      {
        type: CARD_TYPES.DDAY,
        subtitle: '다가오는 원정 D-day',
        title: '레드원 첨단점',
        date: '26년 2월 28일 일요일',
      },
      {
        type: CARD_TYPES.TODAY_MESSAGE,
        message: '오늘은 원정가는 날 입니다.',
        highlight: '원정가는 날',
      },
    ],
    [DAY_TYPE_IDS.REST]: [
      {
        type: CARD_TYPES.DDAY,
        subtitle: '다가오는 원정 D-day',
      },
      {
        type: CARD_TYPES.TODAY_MESSAGE,
        message: '오늘은 휴식하는 날 입니다.',
        highlight: '휴식하는 날',
      },
      {
        type: CARD_TYPES.INFO,
        title: '휴식 가이드',
        description: '충분한 휴식으로 회복에 집중하세요.',
      },
    ],
    [DAY_TYPE_IDS.FINGER]: [
      {
        type: CARD_TYPES.DDAY,
        subtitle: '다가오는 원정 D-day',
        title: '레드원 첨단점',
        date: '26년 2월 28일 일요일',
      },
      {
        type: CARD_TYPES.TRAINING_SETS,
        message: '오늘은 손가락훈련하는 날 입니다.',
        highlight: '손가락훈련하는 날',
        setCount: 5,
      },
      {
        type: CARD_TYPES.EXERCISE_METHOD,
        title: '운동방법',
        detail: '15초 매달리기 | 30초 휴식',
      },
    ],
    [DAY_TYPE_IDS.POWER_BOULDERING]: [
      {
        type: CARD_TYPES.DDAY,
        subtitle: '다가오는 원정 D-day',
        title: '레드원 첨단점',
        date: '26년 2월 28일 일요일',
      },
      {
        type: CARD_TYPES.TRAINING_SETS_SQUARES,
        message: '오늘은 파워볼더링하는 날 입니다.',
        highlight: '파워볼더링하는 날',
        setCount: 4,
        squaresPerSet: 4,
      },
      {
        type: CARD_TYPES.PREVIOUS_RECORDS,
        title: '지난기록',
        setCount: 4,
        squaresPerSet: 4,
      },
    ],
    [DAY_TYPE_IDS.REST_CARDIO]: [
      {
        type: CARD_TYPES.DDAY,
        subtitle: '다가오는 원정 D-day',
        title: '레드원 첨단점',
        date: '26년 2월 28일 일요일',
      },
      {
        type: CARD_TYPES.CHECKLIST,
        message: '오늘은 휴식/유산소하는 날 입니다.',
        highlight: '휴식/유산소하는 날',
        items: [
          '가벼운 유산소 런닝머신 30분',
          '가벼운 스트레칭',
        ],
      },
    ],
    [DAY_TYPE_IDS.ENDURANCE]: [
      {
        type: CARD_TYPES.DDAY,
        subtitle: '다가오는 원정 D-day',
        title: '레드원 첨단점',
        date: '26년 2월 28일 일요일',
      },
      {
        type: CARD_TYPES.TRAINING_SETS_SQUARES,
        message: '오늘은 근지구력하는 날 입니다.',
        highlight: '근지구력하는 날',
        setCount: 4,
        squaresPerSet: 4,
      },
      {
        type: CARD_TYPES.PREVIOUS_RECORDS,
        title: '지난기록',
        setCount: 4,
        squaresPerSet: 4,
      },
    ],
    [DAY_TYPE_IDS.REST_STRENGTH]: [
      {
        type: CARD_TYPES.DDAY,
        subtitle: '다가오는 원정 D-day',
        title: '레드원 첨단점',
        date: '26년 2월 28일 일요일',
      },
      {
        type: CARD_TYPES.REST_STRENGTH_EXERCISES,
        message: '오늘은 휴식/보강운동하는 날 입니다.',
        highlight: '휴식/보강운동하는 날',
        items: [
          {
            label: '덤벨숄더프레스',
            setCount: 4,
            defaultWeight: '3',
            defaultReps: '10',
          },
          { label: '푸쉬업', repsOnly: true, defaultReps: '' },
          { label: '모빌리티 스트레칭' },
        ],
      },
      {
        type: CARD_TYPES.PREVIOUS_RECORDS_STRENGTH,
        title: '지난기록',
        items: [
          { label: '덤벨숄더프레스', setCount: 4 },
          { label: '푸쉬업', repsOnly: true },
          { label: '모빌리티 스트레칭' },
        ],
      },
    ],
  }

  return templates[dayTypeId] ?? templates[DAY_TYPE_IDS.REST]
}

/**
 * 한 번에: 날짜 → 오늘 유형 + 카드 목록 (API 대체용)
 */
export function getDayContent(date = new Date()) {
  const dayTypeId = getDayTypeIdForDate(date)
  const cards = getCardsForDayType(dayTypeId)
  const dayTypeLabel = getDayTypeLabel(dayTypeId)
  return { date, dayTypeId, dayTypeLabel, cards }
}

/**
 * 유형 id로 바로 카드 목록 가져오기 (미리보기/테스트용)
 */
export function getDayContentByType(dayTypeId) {
  const cards = getCardsForDayType(dayTypeId)
  const dayTypeLabel = getDayTypeLabel(dayTypeId)
  return { dayTypeId, dayTypeLabel, cards }
}

export function getDayTypeLabel(dayTypeId) {
  const labels = {
    [DAY_TYPE_IDS.EXPEDITION]: '원정가는 날',
    [DAY_TYPE_IDS.REST]: '휴식하는 날',
    [DAY_TYPE_IDS.FINGER]: '손가락훈련하는 날',
    [DAY_TYPE_IDS.POWER_BOULDERING]: '파워볼더링하는 날',
    [DAY_TYPE_IDS.REST_CARDIO]: '휴식/유산소하는 날',
    [DAY_TYPE_IDS.ENDURANCE]: '근지구력하는 날',
    [DAY_TYPE_IDS.REST_STRENGTH]: '휴식/보강운동하는 날',
  }
  return labels[dayTypeId] ?? '휴식하는 날'
}
