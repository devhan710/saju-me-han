const FORMAT_RULES = `작성 규칙:
- 반드시 한국어로만 작성한다.
- 마크다운을 쓰지 않는다. 별표(*), 해시(#), 백틱, 밑줄로 강조하지 않는다.
- 제목은 숫자와 점으로만 쓴다. 예: 1. 성격과 기질
- 문단은 평문만 사용하고, 기호 장식은 최소화한다.
- 제공된 명식 데이터만 사용한다. 다른 사람의 샘플 사주를 끌어오지 않는다.`

export function formatGeminiError(message) {
  const raw = message || 'Gemini API 요청에 실패했습니다.'
  const lower = raw.toLowerCase()

  if (
    lower.includes('exceeded your current quota') ||
    lower.includes('rate limit') ||
    lower.includes('resource_exhausted')
  ) {
    const waitMatch = raw.match(/retry in ([\d.]+)\s*s/i)
    const waitSec = waitMatch ? Math.ceil(Number(waitMatch[1])) : null
    if (waitSec) {
      return `요청이 많아서 잠시 쉬고 있어요. 약 ${waitSec}초 뒤에 다시 읽어 볼게요.`
    }
    return '요청이 많아서 잠시 쉬고 있어요. 조금 뒤에 다시 시도해 주세요.'
  }

  if (lower.includes('api key') || lower.includes('permission')) {
    return 'API 키를 확인해주세요. .env의 VITE_GEMINI_API_KEY를 점검해 주세요.'
  }

  return raw
}

export function buildReadingPrompt(kind, chart) {
  if (kind === 'love') {
    return `당신은 세계 최고의 사주 해석 전문가다. 연애·관계 키워드를 냉정하고 직설적으로 분석한다.

${FORMAT_RULES}

질문: 이 사람의 연애운만 깊이 있게 분석해 주세요.
쉬운 말로 설명하고, 중요한 부분에서는 근거(일주, 십신, 대운 등)를 짧게 밝혀 주세요.

아래 순서로 작성하세요.
1. 연애 성향
2. 끌리는 상대 / 잘 맞는 관계
3. 반복하기 쉬운 연애 패턴과 약점
4. 올해·가까운 시기의 관계 흐름 (대운·세운 관점)
5. 한 줄 조언
6. 마무리 질문 하나

${chart}`
  }

  return `당신은 세계 최고의 사주 해석 전문가다. 논리와 구조 중심으로 사주를 해석하며, 수천 명의 인생을 분석해 온 경험이 있다. 분석은 매우 냉정하고 직설적으로 진행되며, 감정에 휘둘리지 않는다. 그러나 예외로 인간 내면에 대한 깊은 통찰을 지니고 있고 장점과 단점을 냉정하게 말한다.

${FORMAT_RULES}

질문: 사주를 통해 이 사람의 전반적인 성격, 기질, 재능을 분석해 주세요.
사용자가 사주 용어에 익숙하지 않다고 가정하고, 쉽고 명확한 말로 설명하며 중요한 포인트에서는 핵심 사주 근거를 밝혀주세요.

아래 순서로 작성하세요.
1. 성격과 기질
2. 특이한 점
3. 약점
4. 돋보이는 강점
5. 종합 한 줄
6. 사용자가 더 궁금할 수 있는 질문 하나

판단 근거는 제공된 모든 정보와 계산된 사주 명식만 사용하세요. 긍정·부정 해석을 모두 담아 주세요.

${chart}`
}

export async function callGemini(apiKey, prompt, { onRetryWait } = {}) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
  })

  const requestOnce = async () => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    const data = await response.json()
    return { response, data }
  }

  let { response, data } = await requestOnce()

  if (!response.ok) {
    const msg = data.error?.message || 'Gemini API 요청에 실패했습니다.'
    const waitMatch = msg.match(/retry in ([\d.]+)\s*s/i)
    const isQuota =
      /quota|rate limit|resource_exhausted/i.test(msg) && waitMatch

    if (isQuota) {
      const waitMs = Math.ceil(Number(waitMatch[1]) * 1000) + 500
      if (onRetryWait) onRetryWait(Math.ceil(waitMs / 1000))
      await new Promise((resolve) => setTimeout(resolve, waitMs))
      ;({ response, data } = await requestOnce())
    }
  }

  if (!response.ok) {
    throw new Error(
      formatGeminiError(data.error?.message || 'Gemini API 요청에 실패했습니다.'),
    )
  }

  const text =
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .filter(Boolean)
      .join('') || ''

  if (!text) {
    throw new Error('모델 응답이 비어 있습니다.')
  }

  return text
}
