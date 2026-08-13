import { calculateSaju } from 'ssaju'

export function calcManAge(birthDate) {
  if (!birthDate) return null
  const [y, m, d] = birthDate.split('-').map(Number)
  if (!y || !m || !d) return null

  const today = new Date()
  let age = today.getFullYear() - y
  const month = today.getMonth() + 1
  const day = today.getDate()
  if (month < m || (month === m && day < d)) {
    age -= 1
  }
  return age >= 0 ? age : null
}

export function buildSajuFromInput({
  name,
  birthDate,
  birthTime,
  gender,
  calendar,
}) {
  if (!birthDate || !birthTime) {
    return { ok: false, error: '생년월일과 출생 시간이 필요합니다.' }
  }

  const [year, month, day] = birthDate.split('-').map(Number)
  const [hour, minute] = birthTime.split(':').map(Number)

  if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) {
    return { ok: false, error: '생년월일 또는 시간 형식이 올바르지 않습니다.' }
  }

  const genderKo =
    gender === 'male' ? '남' : gender === 'female' ? '여' : '남'
  const calendarType = calendar === 'lunar' ? 'lunar' : 'solar'
  const manAge = calcManAge(birthDate)

  try {
    const result = calculateSaju({
      year,
      month,
      day,
      hour,
      minute,
      gender: genderKo,
      calendar: calendarType,
      timezone: 'Asia/Seoul',
    })

    const genderLabel =
      gender === 'male' ? 'male' : gender === 'female' ? 'female' : '(미입력)'
    const calendarLabel = calendar === 'lunar' ? '음력' : '양력'
    const ageText = manAge ?? result.currentAge ?? '?'

    const chartText = [
      `이름: ${name?.trim() || '(미입력)'}`,
      `생년월일: ${birthDate}`,
      `출생 시간: ${birthTime}`,
      `달력: ${calendarLabel}`,
      `성별: ${genderLabel}`,
      `나이: 만 ${ageText}세`,
      '',
      '아래는 입력값을 바탕으로 계산된 사주 명식입니다. 이 명식만 근거로 해석하세요. 다른 샘플 사주를 쓰지 마세요.',
      '',
      result.toCompact(),
    ].join('\n')

    const pillars = result.pillars || {}
    const elements = result.fiveElements || {}
    const display = {
      manAge: typeof ageText === 'number' ? ageText : Number(ageText) || null,
      yearPillar: pillars.year || '—',
      monthPillar: pillars.month || '—',
      dayPillar: pillars.day || '—',
      hourPillar: pillars.hour || '—',
      fiveElements: ['목', '화', '토', '금', '수']
        .map((k) => `${k}${elements[k] ?? 0}`)
        .join(' '),
    }

    return { ok: true, chartText, manAge: display.manAge, display, raw: result }
  } catch (err) {
    return {
      ok: false,
      error: err?.message || '사주 명식을 계산하지 못했습니다.',
    }
  }
}
