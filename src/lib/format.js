export function formatBirthTime(value) {
  if (!value) return ''
  return String(value).slice(0, 5)
}

export function getMissingFields({ name, birthDate, birthTime, gender }) {
  const missing = []
  if (!name.trim()) missing.push('이름')
  if (!birthDate) missing.push('생년월일')
  if (!birthTime) missing.push('출생 시간')
  if (!gender) missing.push('성별')
  return missing
}

export function formatPersonSummary({ name, birthDate, birthTime, gender, calendar }) {
  return [
    name && `${name}님`,
    birthDate,
    birthTime,
    gender === 'male' ? '남성' : gender === 'female' ? '여성' : null,
    calendar === 'lunar' ? '음력' : calendar === 'solar' ? '양력' : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

export function buildShareText({
  resultTitle,
  name,
  birthDate,
  birthTime,
  chartDisplay,
  result,
}) {
  const metaLine = [
    name && `${name}님`,
    birthDate,
    birthTime,
    chartDisplay?.manAge != null && `만 ${chartDisplay.manAge}세`,
  ]
    .filter(Boolean)
    .join(' · ')

  const chartLine = chartDisplay
    ? `명식 시${chartDisplay.hourPillar} 일${chartDisplay.dayPillar} 월${chartDisplay.monthPillar} 년${chartDisplay.yearPillar}`
    : ''

  return [
    `[Saju Me] ${resultTitle}`,
    metaLine,
    chartLine,
    '',
    result,
    '',
    '— Saju Me에서 확인',
  ]
    .filter((line) => line !== undefined && line !== '')
    .join('\n')
}
