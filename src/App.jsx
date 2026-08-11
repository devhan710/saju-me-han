import { useEffect, useMemo, useState } from 'react'
import { buildSajuFromInput, calcManAge } from './saju'
import './App.css'

// 모델이 붙이는 **, ***, # 같은 마크다운 기호 정리
function cleanResultText(text) {
  return text
    .replace(/\*{1,3}/g, '')
    .replace(/_{1,2}/g, '')
    .replace(/`+/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^\s*[-*•]\s+/gm, '· ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// "1. 제목" 패턴으로 나눠 섹션 카드로 보여줌
function parseResultSections(text) {
  const cleaned = cleanResultText(text)
  if (!cleaned) return []

  const chunks = cleaned.split(/(?=^\d+\.\s+)/m).filter((part) => part.trim())

  return chunks.map((chunk, index) => {
    const lines = chunk.trim().split('\n')
    const first = lines[0].trim()
    const headingMatch = first.match(/^(\d+)\.\s*(.+)$/)

    if (headingMatch) {
      return {
        id: `${headingMatch[1]}-${index}`,
        number: headingMatch[1],
        title: headingMatch[2].trim(),
        body: lines.slice(1).join('\n').trim(),
      }
    }

    return {
      id: `intro-${index}`,
      number: '',
      title: '',
      body: chunk.trim(),
    }
  })
}

// 필수 입력 검사
function getMissingFields({ name, birthDate, birthTime, gender }) {
  const missing = []
  if (!name.trim()) missing.push('이름')
  if (!birthDate) missing.push('생년월일')
  if (!birthTime) missing.push('출생 시간')
  if (!gender) missing.push('성별')
  return missing
}

const FORMAT_RULES = `작성 규칙:
- 반드시 한국어로만 작성한다.
- 마크다운을 쓰지 않는다. 별표(*), 해시(#), 백틱, 밑줄로 강조하지 않는다.
- 제목은 숫자와 점으로만 쓴다. 예: 1. 성격과 기질
- 문단은 평문만 사용하고, 기호 장식은 최소화한다.
- 제공된 명식 데이터만 사용한다. 다른 사람의 샘플 사주를 끌어오지 않는다.`

function App() {
  // 각 입력값을 저장하는 상태
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('') // 생년월일 (YYYY-MM-DD)
  const [birthTime, setBirthTime] = useState('') // 출생 시간 (HH:MM)
  const [gender, setGender] = useState('') // 'male' | 'female'
  const [calendar, setCalendar] = useState('solar') // 'solar' 양력 | 'lunar' 음력

  // Gemini 사주 해석 상태
  const [loading, setLoading] = useState(false)
  const [loadingKind, setLoadingKind] = useState('') // 'overall' | 'love'
  const [error, setError] = useState('')
  const [result, setResult] = useState('')
  const [resultTitle, setResultTitle] = useState('사주 해석')
  const [progress, setProgress] = useState(0) // 로딩 바 0~100
  const [shareMessage, setShareMessage] = useState('') // 공유 성공/실패 안내
  const [chartDisplay, setChartDisplay] = useState(null) // 계산된 명식 요약

  // 입력만 채워지면 미리 만 나이·사주 미리보기
  const liveManAge = useMemo(() => calcManAge(birthDate), [birthDate])
  const liveChart = useMemo(() => {
    if (!birthDate || !birthTime) return null
    const built = buildSajuFromInput({
      name,
      birthDate,
      birthTime,
      gender,
      calendar,
    })
    return built.ok ? built.display : null
  }, [name, birthDate, birthTime, gender, calendar])

  // 로딩 중일 때 게이지가 서서히 차오름 (실제 API 완료 전 최대 90%)
  useEffect(() => {
    if (!loading) return

    setProgress(6)
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev
        const step = Math.max(0.4, (90 - prev) * 0.06)
        return Math.min(90, prev + step)
      })
    }, 180)

    return () => clearInterval(timer)
  }, [loading])

  // kind: 'overall' | 'love'
  const handleViewSaju = async (kind = 'overall') => {
    const missing = getMissingFields({ name, birthDate, birthTime, gender })
    if (missing.length > 0) {
      setError(`${missing.join(', ')} 항목을 입력해 주세요.`)
      setResult('')
      setProgress(0)
      return
    }

    // 입력 기반 사주 명식 계산
    const chartResult = buildSajuFromInput({
      name,
      birthDate,
      birthTime,
      gender,
      calendar,
    })
    if (!chartResult.ok) {
      setError(chartResult.error)
      setResult('')
      setChartDisplay(null)
      return
    }

    setLoading(true)
    setLoadingKind(kind)
    setError('')
    setResult('')
    setProgress(0)
    setShareMessage('')
    setChartDisplay(chartResult.display)
    setResultTitle(kind === 'love' ? '연애운' : '사주 해석')

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY
      if (!apiKey) {
        throw new Error('VITE_GEMINI_API_KEY가 설정되지 않았습니다.')
      }

      const chart = chartResult.chartText

      const overallPrompt = `당신은 세계 최고의 사주 해석 전문가다. 논리와 구조 중심으로 사주를 해석하며, 수천 명의 인생을 분석해 온 경험이 있다. 분석은 매우 냉정하고 직설적으로 진행되며, 감정에 휘둘리지 않는다. 그러나 예외로 인간 내면에 대한 깊은 통찰을 지니고 있고 장점과 단점을 냉정하게 말한다.

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

      const lovePrompt = `당신은 세계 최고의 사주 해석 전문가다. 연애·관계 키워드를 냉정하고 직설적으로 분석한다.

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

      const prompt = kind === 'love' ? lovePrompt : overallPrompt

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Gemini API 요청에 실패했습니다.')
      }

      // 응답 텍스트 모으기 (thinking 파트 등 text 없는 파트는 건너뜀)
      const text =
        data.candidates?.[0]?.content?.parts
          ?.map((part) => part.text)
          .filter(Boolean)
          .join('') || ''

      if (!text) {
        throw new Error('모델 응답이 비어 있습니다.')
      }

      setProgress(100)
      // 100% 채움 애니메이션을 잠깐 보여준 뒤 결과 표시
      await new Promise((resolve) => setTimeout(resolve, 350))
      setResult(cleanResultText(text))
    } catch (err) {
      setError(err.message || '사주 해석 중 오류가 발생했습니다.')
      setProgress(0)
    } finally {
      setLoading(false)
      setLoadingKind('')
    }
  }

  // 결과 공유: 가능한 환경이면 시스템 공유, 아니면 클립보드 복사
  const handleShareResult = async () => {
    if (!result) return

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

    const shareText = [
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

    try {
      // 모바일 등 시스템 공유 시트가 있으면 우선 사용
      if (typeof navigator.share === 'function') {
        await navigator.share({
          title: `Saju Me · ${resultTitle}`,
          text: shareText,
        })
        setShareMessage('공유를 완료했어요.')
        return
      }

      // 데스크톱 등: 클립보드에 복사
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText)
        setShareMessage('결과 텍스트를 복사했어요. 원하는 곳에 붙여넣기 하세요.')
        return
      }

      // 구형 브라우저 폴백
      const textarea = document.createElement('textarea')
      textarea.value = shareText
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setShareMessage('결과 텍스트를 복사했어요. 원하는 곳에 붙여넣기 하세요.')
    } catch (err) {
      // 사용자가 공유 시트를 닫은 경우는 조용히 무시
      if (err?.name === 'AbortError') return
      setShareMessage('공유에 실패했어요. 다시 시도해 주세요.')
    }
  }

  const shownChart = chartDisplay || liveChart

  return (
    <div className="page">
      <main className="shell">
        <header className="hero">
          <p className="brand">Saju Me</p>
          <h1>나의 사주</h1>
          <p className="lede">기본 정보를 입력하고 명식을 읽어 보세요.</p>
        </header>

        <section className="form-panel" aria-label="사주 입력">
          <div className="field">
            <label htmlFor="name">이름</label>
            <input
              id="name"
              type="text"
              placeholder="예: 홍길동"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="birthDate">생년월일</label>
              <input
                id="birthDate"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="birthTime">출생 시간</label>
              <input
                id="birthTime"
                type="time"
                value={birthTime}
                onChange={(e) => setBirthTime(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <span className="field-label">성별</span>
            <div className="chip-group" role="radiogroup" aria-label="성별">
              <label className={`chip ${gender === 'male' ? 'is-selected' : ''}`}>
                <input
                  type="radio"
                  name="gender"
                  value="male"
                  checked={gender === 'male'}
                  onChange={(e) => setGender(e.target.value)}
                />
                남성
              </label>
              <label
                className={`chip ${gender === 'female' ? 'is-selected' : ''}`}
              >
                <input
                  type="radio"
                  name="gender"
                  value="female"
                  checked={gender === 'female'}
                  onChange={(e) => setGender(e.target.value)}
                />
                여성
              </label>
            </div>
          </div>

          <div className="field">
            <span className="field-label">달력</span>
            <div className="chip-group" role="radiogroup" aria-label="달력">
              <label
                className={`chip ${calendar === 'solar' ? 'is-selected' : ''}`}
              >
                <input
                  type="radio"
                  name="calendar"
                  value="solar"
                  checked={calendar === 'solar'}
                  onChange={(e) => setCalendar(e.target.value)}
                />
                양력
              </label>
              <label
                className={`chip ${calendar === 'lunar' ? 'is-selected' : ''}`}
              >
                <input
                  type="radio"
                  name="calendar"
                  value="lunar"
                  checked={calendar === 'lunar'}
                  onChange={(e) => setCalendar(e.target.value)}
                />
                음력
              </label>
            </div>
          </div>

          {(liveManAge != null || shownChart) && (
            <div className="chart-preview" aria-live="polite">
              <p className="chart-preview-title">나의 명식</p>
              {liveManAge != null && (
                <p className="chart-age">만 {liveManAge}세</p>
              )}
              {shownChart && (
                <>
                  <div className="pillar-row">
                    <div className="pillar">
                      <span>시주</span>
                      <strong>{shownChart.hourPillar}</strong>
                    </div>
                    <div className="pillar">
                      <span>일주</span>
                      <strong>{shownChart.dayPillar}</strong>
                    </div>
                    <div className="pillar">
                      <span>월주</span>
                      <strong>{shownChart.monthPillar}</strong>
                    </div>
                    <div className="pillar">
                      <span>년주</span>
                      <strong>{shownChart.yearPillar}</strong>
                    </div>
                  </div>
                  {shownChart.fiveElements && (
                    <p className="chart-elements">
                      오행 {shownChart.fiveElements}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          <div className="btn-row">
            <button
              type="button"
              className="btn-primary"
              onClick={() => handleViewSaju('overall')}
              disabled={loading}
            >
              {loading && loadingKind === 'overall'
                ? '🔮 풀이 중...'
                : '내 사주 보기'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => handleViewSaju('love')}
              disabled={loading}
            >
              {loading && loadingKind === 'love'
                ? '🔮 풀이 중...'
                : '연애운 보기'}
            </button>
          </div>

          {(loading || progress > 0) && (
            <div
              className="progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress)}
              aria-label="사주 풀이 진행률"
            >
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="progress-label">
                {loading
                  ? `명식을 읽는 중… ${Math.round(progress)}%`
                  : progress === 100
                    ? '풀이 완료'
                    : null}
              </p>
            </div>
          )}

          {error && <p className="error" role="alert">{error}</p>}
        </section>

        {result && (
          <section className="result" aria-live="polite">
            <div className="result-header">
              <div className="result-header-row">
                <div>
                  <p className="result-kicker">Reading</p>
                  <h2>{resultTitle}</h2>
                  {(name || birthDate) && (
                    <p className="result-meta">
                      {[
                        name && `${name}님`,
                        birthDate,
                        birthTime,
                        shownChart?.manAge != null &&
                          `만 ${shownChart.manAge}세`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                  {shownChart && (
                    <p className="result-meta result-pillars">
                      {[
                        `시 ${shownChart.hourPillar}`,
                        `일 ${shownChart.dayPillar}`,
                        `월 ${shownChart.monthPillar}`,
                        `년 ${shownChart.yearPillar}`,
                      ].join(' · ')}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="btn-share"
                  onClick={handleShareResult}
                >
                  결과 공유
                </button>
              </div>
            </div>

            <div className="result-list">
              {parseResultSections(result).map((section) => (
                <article key={section.id} className="result-block">
                  {(section.number || section.title) && (
                    <div className="result-block-head">
                      {section.number && (
                        <span className="result-num">{section.number}</span>
                      )}
                      {section.title && (
                        <h3 className="result-block-title">{section.title}</h3>
                      )}
                    </div>
                  )}
                  {section.body && (
                    <p className="result-block-body">{section.body}</p>
                  )}
                </article>
              ))}
            </div>

            {shareMessage && (
              <p className="share-message" role="status">
                {shareMessage}
              </p>
            )}
          </section>
        )}
      </main>
    </div>
  )
}

export default App
