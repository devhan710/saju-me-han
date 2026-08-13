import { useEffect, useMemo, useRef, useState } from 'react'
import mascot from './assets/tree.png'
import { getUserLabel, signInWithGoogle, signOut } from './auth'
import { buildSajuFromInput, calcManAge } from './saju'
import { supabase } from './supabaseClient'
import './App.css'

function formatBirthTime(value) {
  if (!value) return ''
  return String(value).slice(0, 5)
}

const READING_COLUMNS =
  'id, name, birth_date, birth_time, gender, calendar, result_kind, result_title, result_text, chart, created_at'

async function fetchReadings() {
  const { data, error } = await supabase
    .from('saju_readings')
    .select(READING_COLUMNS)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

async function createReading(payload, userId) {
  const { data, error } = await supabase
    .from('saju_readings')
    .insert({ ...payload, user_id: userId })
    .select(READING_COLUMNS)
    .single()

  if (error) throw error
  return data
}

async function updateReading(id, payload) {
  const { data, error } = await supabase
    .from('saju_readings')
    .update(payload)
    .eq('id', id)
    .select(READING_COLUMNS)
    .single()

  if (error) throw error
  return data
}

async function deleteReading(id) {
  const { error } = await supabase.from('saju_readings').delete().eq('id', id)
  if (error) throw error
}

const PROFILE_COLUMNS = 'id, name, birth_date, birth_time, gender, calendar'

async function fetchProfile() {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .maybeSingle()

  if (error) throw error
  return data
}

async function upsertProfile(userId, { name, birthDate, birthTime, gender, calendar }) {
  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      name: name.trim(),
      birth_date: birthDate,
      birth_time: birthTime,
      gender,
      calendar,
      updated_at: new Date().toISOString(),
    })
    .select(PROFILE_COLUMNS)
    .single()

  if (error) throw error
  return data
}

function isSameAsProfile(profile, fields) {
  if (!profile) return false
  return (
    fields.name.trim() === (profile.name ?? '').trim() &&
    fields.birthDate === (profile.birth_date ?? '') &&
    formatBirthTime(fields.birthTime) === formatBirthTime(profile.birth_time) &&
    fields.gender === (profile.gender ?? '') &&
    fields.calendar === (profile.calendar ?? 'solar')
  )
}

function shouldUpdateProfile(profile, nameValue) {
  if (!profile?.name) return true
  return nameValue.trim() === profile.name.trim()
}

function buildReadingPayload({
  name,
  birthDate,
  birthTime,
  gender,
  calendar,
  kind,
  resultText,
  chart,
}) {
  return {
    name: name.trim(),
    birth_date: birthDate,
    birth_time: birthTime,
    gender,
    calendar,
    result_kind: kind,
    result_title: kind === 'love' ? '연애운' : '사주 해석',
    result_text: resultText,
    chart,
  }
}

function buildMetadataPayload({ name, birthDate, birthTime, gender, calendar, chart }) {
  return {
    name: name.trim(),
    birth_date: birthDate,
    birth_time: birthTime,
    gender,
    calendar,
    chart,
  }
}

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

// Gemini 에러 메시지 → 사람이 읽기 쉬운 한국어
function formatGeminiError(message) {
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

// generateContent 호출 (할당량 초과 시 1회 대기 후 재시도)
async function callGemini(apiKey, prompt, { onRetryWait } = {}) {
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

    // 서버가 알려준 대기 시간만큼 쉬고 한 번 더 시도
    if (isQuota) {
      const waitMs = Math.ceil(Number(waitMatch[1]) * 1000) + 500
      if (onRetryWait) onRetryWait(Math.ceil(waitMs / 1000))
      await new Promise((resolve) => setTimeout(resolve, waitMs))
      ;({ response, data } = await requestOnce())
    }
  }

  if (!response.ok) {
    throw new Error(
      formatGeminiError(data.error?.message || 'Gemini API 요청에 실패했습니다.')
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
  const [toast, setToast] = useState(null)
  const [chartDisplay, setChartDisplay] = useState(null) // 계산된 명식 요약
  const [readings, setReadings] = useState([])
  const [selectedReadingId, setSelectedReadingId] = useState(null)
  const [readingsError, setReadingsError] = useState('')
  const [formCollapsed, setFormCollapsed] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [savingMetadata, setSavingMetadata] = useState(false)
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [profile, setProfile] = useState(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const nameInputRef = useRef(null)
  const resultRef = useRef(null)
  const selectedReadingIdRef = useRef(null)
  const toastTimerRef = useRef(null)
  selectedReadingIdRef.current = selectedReadingId

  const userLabel = useMemo(() => getUserLabel(user), [user])

  const selectedReading = useMemo(
    () => readings.find((row) => row.id === selectedReadingId) ?? null,
    [readings, selectedReadingId],
  )

  const missingFields = useMemo(
    () => getMissingFields({ name, birthDate, birthTime, gender }),
    [name, birthDate, birthTime, gender],
  )
  const formReady = missingFields.length === 0

  const hasMetadataChanges = useMemo(() => {
    if (!selectedReading) return false
    return (
      name.trim() !== (selectedReading.name ?? '').trim() ||
      birthDate !== (selectedReading.birth_date ?? '') ||
      formatBirthTime(birthTime) !== formatBirthTime(selectedReading.birth_time) ||
      gender !== (selectedReading.gender ?? '') ||
      calendar !== (selectedReading.calendar ?? 'solar')
    )
  }, [selectedReading, name, birthDate, birthTime, gender, calendar])

  const formFields = useMemo(
    () => ({ name, birthDate, birthTime, gender, calendar }),
    [name, birthDate, birthTime, gender, calendar],
  )
  const matchesProfile = isSameAsProfile(profile, formFields)
  const hasSavedProfile = Boolean(
    profile?.name && profile?.birth_date && profile?.birth_time && profile?.gender,
  )

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

  const applyProfileToForm = (nextProfile) => {
    if (!nextProfile) return
    setName(nextProfile.name ?? '')
    setBirthDate(nextProfile.birth_date ?? '')
    setBirthTime(formatBirthTime(nextProfile.birth_time))
    setGender(nextProfile.gender ?? '')
    setCalendar(nextProfile.calendar ?? 'solar')
    setChartDisplay(null)
  }

  const resetBlankForm = () => {
    setName('')
    setBirthDate('')
    setBirthTime('')
    setGender('')
    setCalendar('solar')
    setChartDisplay(null)
  }

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return
      if (error) {
        setAuthError(error.message || '로그인 상태를 확인하지 못했어요. 잠시 후 다시 해 볼까요?')
      } else {
        setUser(data.session?.user ?? null)
      }
      setAuthLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)
      setAuthError('')
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      setReadings([])
      setProfile(null)
      setSelectedReadingId(null)
      setReadingsError('')
      return
    }

    let cancelled = false

    ;(async () => {
      try {
        const [rows, nextProfile] = await Promise.all([
          fetchReadings(),
          fetchProfile(),
        ])
        if (cancelled) return

        const fallbackProfile =
          nextProfile ??
          (rows[0]
            ? {
                id: user.id,
                name: rows[0].name,
                birth_date: rows[0].birth_date,
                birth_time: rows[0].birth_time,
                gender: rows[0].gender,
                calendar: rows[0].calendar,
              }
            : null)

        setReadings(rows)
        setProfile(fallbackProfile)
        setReadingsError('')
        if (!selectedReadingIdRef.current && fallbackProfile) {
          applyProfileToForm(fallbackProfile)
        }
      } catch (err) {
        if (!cancelled) {
          setReadingsError(err.message || '남겨 둔 해석을 불러오지 못했어요.')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user, authLoading])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

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

  const scrollToResult = () => {
    requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const showToast = (message, { type = 'success', action, duration } = {}) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    const next = { id: Date.now(), message, type, action }
    setToast(next)
    const ms = duration ?? (action ? 7000 : 2800)
    toastTimerRef.current = setTimeout(() => {
      setToast((current) => (current?.id === next.id ? null : current))
    }, ms)
  }

  const dismissToast = () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(null)
  }

  const handleGoogleSignIn = async () => {
    setAuthError('')
    try {
      await signInWithGoogle()
    } catch (err) {
      const message = err.message || '로그인이 잘 안 됐어요. 다시 한 번 해 볼까요?'
      setAuthError(message)
      showToast(message, { type: 'error' })
    }
  }

  const handleSignOut = async () => {
    setAuthError('')
    try {
      await signOut()
      setProfile(null)
      handleNewSaju({ useProfile: false })
      showToast('다음에 또 만나요.', {
        action: { label: '다시 만나요', onClick: handleGoogleSignIn },
      })
    } catch (err) {
      const message = err.message || '로그아웃이 잘 안 됐어요. 다시 시도해 주세요.'
      setAuthError(message)
      showToast(message, { type: 'error' })
    }
  }

  const handleSelectReading = (reading) => {
    setSelectedReadingId(reading.id)
    setName(reading.name ?? '')
    setBirthDate(reading.birth_date ?? '')
    setBirthTime(formatBirthTime(reading.birth_time))
    setGender(reading.gender ?? '')
    setCalendar(reading.calendar ?? 'solar')
    setResultTitle(reading.result_title || '사주 해석')
    setResult(reading.result_text || '')
    setChartDisplay(reading.chart ?? null)
    setError('')
    setProgress(0)
    setFormCollapsed(true)
    scrollToResult()
  }

  const handleNewSaju = ({ useProfile = true } = {}) => {
    setSelectedReadingId(null)
    if (useProfile && hasSavedProfile) {
      applyProfileToForm(profile)
    } else {
      resetBlankForm()
    }
    setResult('')
    setResultTitle('사주 해석')
    setError('')
    setProgress(0)
    setLoading(false)
    setLoadingKind('')
    setFormCollapsed(false)
    requestAnimationFrame(() => {
      if (useProfile && hasSavedProfile) return
      nameInputRef.current?.focus()
    })
  }

  const maybeSaveProfile = async () => {
    if (!user || !formReady) return null
    if (!shouldUpdateProfile(profile, name)) return profile

    try {
      const saved = await upsertProfile(user.id, formFields)
      setProfile(saved)
      return saved
    } catch {
      return profile
    }
  }

  const handleSaveAsMyProfile = async () => {
    if (!user || !formReady) return

    setSavingProfile(true)
    setError('')
    try {
      const saved = await upsertProfile(user.id, formFields)
      setProfile(saved)
      showToast('기본 정보를 기억해 둘게요.', {
        action: {
          label: '바로 채우기',
          onClick: () => handleNewSaju(),
        },
      })
    } catch (err) {
      setError(err.message || '기본 정보를 저장하지 못했어요. 다시 해 볼까요?')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleDeleteReading = async (readingId, event) => {
    event.stopPropagation()
    if (deletingId) return

    const removed = readings.find((row) => row.id === readingId)
    setDeletingId(readingId)
    setReadingsError('')
    try {
      await deleteReading(readingId)
      setReadings((prev) => prev.filter((row) => row.id !== readingId))
      if (selectedReadingId === readingId) {
        handleNewSaju()
      }
      showToast('기록을 치워 두었어요.', {
        action: removed && user
          ? {
              label: '되돌리기',
              onClick: async () => {
                try {
                  const restored = await createReading(
                    buildReadingPayload({
                      name: removed.name ?? '',
                      birthDate: removed.birth_date ?? '',
                      birthTime: formatBirthTime(removed.birth_time),
                      gender: removed.gender ?? '',
                      calendar: removed.calendar ?? 'solar',
                      kind: removed.result_kind || 'overall',
                      resultText: removed.result_text || '',
                      chart: removed.chart ?? null,
                    }),
                    user.id,
                  )
                  setReadings((prev) => [
                    restored,
                    ...prev.filter((row) => row.id !== restored.id),
                  ])
                  handleSelectReading(restored)
                  showToast('다시 꺼내 두었어요.')
                } catch (undoError) {
                  showToast(
                    undoError.message || '되돌리기가 잘 안 됐어요.',
                    { type: 'error' },
                  )
                }
              },
            }
          : undefined,
      })
    } catch (err) {
      const message = err.message || '삭제가 잘 안 됐어요. 다시 시도해 주세요.'
      setReadingsError(message)
      showToast(message, { type: 'error' })
    } finally {
      setDeletingId(null)
    }
  }

  const handleSaveMetadata = async () => {
    if (!user) {
      showToast('저장하려면 먼저 로그인해 주세요.', {
        type: 'error',
        action: { label: '로그인', onClick: handleGoogleSignIn },
      })
      return
    }
    if (!selectedReadingId || !formReady || !hasMetadataChanges) return

    const chartResult = buildSajuFromInput({
      name,
      birthDate,
      birthTime,
      gender,
      calendar,
    })
    if (!chartResult.ok) {
      setError(chartResult.error)
      return
    }

    setSavingMetadata(true)
    setReadingsError('')
    setError('')
    try {
      const updated = await updateReading(
        selectedReadingId,
        buildMetadataPayload({
          name,
          birthDate,
          birthTime,
          gender,
          calendar,
          chart: chartResult.display,
        }),
      )

      setChartDisplay(chartResult.display)
      setReadings((prev) =>
        prev.map((row) => (row.id === updated.id ? updated : row)),
      )
      await maybeSaveProfile()
      showToast('입력하신 내용을 저장해 두었어요.')
    } catch (err) {
      setError(err.message || '입력 내용을 저장하지 못했어요. 다시 해 볼까요?')
    } finally {
      setSavingMetadata(false)
    }
  }

  const upsertReadingInList = (saved, removedId) => {
    setSelectedReadingId(saved.id)
    setReadings((prev) => [
      saved,
      ...prev.filter((row) => row.id !== saved.id && row.id !== removedId),
    ])
  }

  // kind: 'overall' | 'love'
  const handleViewSaju = async (kind = 'overall') => {
    if (missingFields.length > 0) {
      setError(`${missingFields.join(', ')}을(를) 알려 주시면 읽어 볼게요.`)
      setFormCollapsed(false)
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
      setFormCollapsed(false)
      return
    }

    const previousId = selectedReadingId

    setLoading(true)
    setLoadingKind(kind)
    setError('')
    setResult('')
    setProgress(0)
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

      const text = await callGemini(apiKey, prompt, {
        onRetryWait: (sec) => {
          setError(`요청이 많아서 잠시 기다리고 있어요. 약 ${sec}초 뒤에 다시 읽어 볼게요.`)
        },
      })

      setError('')
      setProgress(100)
      // 100% 채움 애니메이션을 잠깐 보여준 뒤 결과 표시
      await new Promise((resolve) => setTimeout(resolve, 350))
      const cleaned = cleanResultText(text)
      setResult(cleaned)
      setFormCollapsed(true)
      scrollToResult()

      const payload = buildReadingPayload({
        name,
        birthDate,
        birthTime,
        gender,
        calendar,
        kind,
        resultText: cleaned,
        chart: chartResult.display,
      })

      if (previousId) {
        const updated = await updateReading(previousId, payload)
        upsertReadingInList(updated)
        await maybeSaveProfile()
        showToast('해석을 다시 적어 두었어요.', {
          action: { label: '결과 보기', onClick: scrollToResult },
        })
      } else if (user) {
        const saved = await createReading(payload, user.id)
        upsertReadingInList(saved)
        await maybeSaveProfile()
        showToast('해석을 소중히 저장해 두었어요.', {
          action: { label: '결과 보기', onClick: scrollToResult },
        })
      } else {
        showToast('로그인하면 이 해석을 남겨 둘 수 있어요.', {
          action: { label: '로그인', onClick: handleGoogleSignIn },
        })
      }
    } catch (err) {
      setError(formatGeminiError(err.message) || '해석 중에 문제가 생겼어요. 다시 한 번 해 볼까요?')
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
        showToast('잘 전달됐어요.')
        return
      }

      // 데스크톱 등: 클립보드에 복사
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText)
        showToast('해석을 복사해 두었어요.')
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
      showToast('해석을 복사해 두었어요.')
    } catch (err) {
      // 사용자가 공유 시트를 닫은 경우는 조용히 무시
      if (err?.name === 'AbortError') return
      showToast('공유가 잘 안 됐어요. 다시 한 번 해 볼까요?', { type: 'error' })
    }
  }

  const shownChart = chartDisplay || liveChart

  return (
    <div className="page">
      <div className="layout">
        <img
          src={mascot}
          alt="사주 나무"
          className="mascot mascot-aside"
        />

        <aside className="sidebar" aria-label="저장된 사주">
          <div className="auth-panel">
            {authLoading ? (
              <p className="auth-status">잠깐만, 확인하고 있어요…</p>
            ) : user ? (
              <>
                <p className="auth-user">{userLabel}님, 반가워요</p>
                <button
                  type="button"
                  className="auth-btn auth-btn-secondary"
                  onClick={handleSignOut}
                  disabled={loading}
                >
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <p className="auth-status">로그인하면 해석을 남겨 둘 수 있어요.</p>
                <button
                  type="button"
                  className="auth-btn auth-btn-google"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                >
                  Google로 로그인
                </button>
              </>
            )}
            {authError && (
              <p className="sidebar-error" role="alert">
                {authError}
              </p>
            )}
          </div>

          <button
            type="button"
            className={`sidebar-new ${selectedReadingId == null ? 'is-selected' : ''}`}
            onClick={handleNewSaju}
            disabled={loading || !user}
            title={user ? undefined : '로그인하면 함께 읽어 볼 수 있어요'}
          >
            새 사주 만들기
          </button>
          <p className="sidebar-title">남겨 둔 해석</p>
          {!user && !authLoading && (
            <p className="sidebar-empty">로그인하면 여기 목록이 생겨요.</p>
          )}
          {user && readingsError && (
            <p className="sidebar-error" role="alert">
              {readingsError}
            </p>
          )}
          {user && !readingsError && readings.length === 0 && (
            <p className="sidebar-empty">아직 남겨 둔 해석이 없어요. 함께 읽어 볼까요?</p>
          )}
          {user && (
          <ul className="sidebar-list">
            {readings.map((reading) => (
              <li key={reading.id} className="sidebar-row">
                <button
                  type="button"
                  className={`sidebar-item ${
                    selectedReadingId === reading.id ? 'is-selected' : ''
                  }`}
                  onClick={() => handleSelectReading(reading)}
                >
                  <span className="sidebar-name">{reading.name}</span>
                  <span className="sidebar-meta">
                    {reading.result_title ||
                      (reading.result_kind === 'love' ? '연애운' : '사주 해석')}
                  </span>
                </button>
                <button
                  type="button"
                  className="sidebar-delete"
                  aria-label={`${reading.name} 기록 삭제`}
                  disabled={deletingId === reading.id || loading}
                  onClick={(event) => handleDeleteReading(reading.id, event)}
                >
                  {deletingId === reading.id ? '…' : '삭제'}
                </button>
              </li>
            ))}
          </ul>
          )}
        </aside>

        <header className="hero">
          <img
            src={mascot}
            alt=""
            className="mascot mascot-hero"
          />
          <div className="hero-copy">
            <p className="brand">Saju Me</p>
            <h1>
              {selectedReadingId && name.trim()
                ? `${name.trim()}님의 사주`
                : '나의 사주'}
            </h1>
            <p className="lede">
              {selectedReadingId
                ? '남겨 둔 해석을 보고 있어요. 고치고 싶으면 언제든 말씀해 주세요.'
                : hasSavedProfile
                  ? '이미 아는 정보로 바로 읽어 볼게요. 다른 분 사주도 괜찮아요.'
                  : '생년월일만 알려 주시면, 함께 천천히 읽어 볼게요.'}
            </p>
          </div>
        </header>

        <main className="shell">
        <section className="form-panel" aria-label="사주 입력">
          {result && (
            <button
              type="button"
              className="form-toggle"
              onClick={() => setFormCollapsed((prev) => !prev)}
            >
              {formCollapsed ? '입력 수정하기' : '입력 접기'}
            </button>
          )}

          {formCollapsed && (
            <p className="form-summary">
              {[
                name && `${name}님`,
                birthDate,
                birthTime,
                gender === 'male'
                  ? '남성'
                  : gender === 'female'
                    ? '여성'
                    : null,
                calendar === 'lunar' ? '음력' : '양력',
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}

          {!formCollapsed && (
            <>
          {user && hasSavedProfile && !matchesProfile && (
            <button
              type="button"
              className="form-toggle"
              onClick={() => applyProfileToForm(profile)}
            >
              내 정보로 다시 채우기
            </button>
          )}

          <div className="field">
            <label htmlFor="name">이름</label>
            <input
              id="name"
              ref={nameInputRef}
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
              disabled={loading || savingMetadata || savingProfile || !formReady}
              title={
                formReady
                  ? undefined
                  : `${missingFields.join(', ')}을(를) 입력해 주세요`
              }
            >
              {loading && loadingKind === 'overall'
                ? '읽는 중...'
                : selectedReadingId
                  ? '사주 다시 읽기'
                  : '내 사주 읽어 보기'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => handleViewSaju('love')}
              disabled={loading || savingMetadata || savingProfile || !formReady}
              title={
                formReady
                  ? undefined
                  : `${missingFields.join(', ')}을(를) 입력해 주세요`
              }
            >
              {loading && loadingKind === 'love'
                ? '읽는 중...'
                : selectedReadingId
                  ? '연애운 다시 읽기'
                  : '연애운 읽어 보기'}
            </button>
          </div>

          {selectedReadingId && hasMetadataChanges && (
            <button
              type="button"
              className="btn-save-meta"
              onClick={handleSaveMetadata}
              disabled={loading || savingMetadata || savingProfile || !formReady}
            >
              {savingMetadata ? '적어 두는 중…' : '입력 정보만 저장'}
            </button>
          )}

          {user && formReady && !matchesProfile && (
            <button
              type="button"
              className="btn-save-meta"
              onClick={handleSaveAsMyProfile}
              disabled={loading || savingMetadata || savingProfile}
            >
              {savingProfile ? '기억해 두는 중…' : '내 기본 정보로 기억하기'}
            </button>
          )}

          {!formReady && !loading && (
            <p className="form-hint">
              {missingFields.join(', ')}만 알려 주시면 바로 읽어 볼게요.
            </p>
          )}

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
                  ? `명식을 천천히 읽고 있어요… ${Math.round(progress)}%`
                  : progress === 100
                    ? '다 읽어 보았어요'
                    : null}
              </p>
            </div>
          )}

          {error && <p className="error" role="alert">{error}</p>}
            </>
          )}

          {formCollapsed && error && (
            <p className="error" role="alert">{error}</p>
          )}
        </section>

        {result && (
          <section className="result" aria-live="polite" ref={resultRef}>
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
                <div className="result-actions">
                  <button
                    type="button"
                    className="btn-share"
                    onClick={() => {
                      setFormCollapsed(false)
                      requestAnimationFrame(() => nameInputRef.current?.focus())
                    }}
                  >
                    입력 고치기
                  </button>
                  <button
                    type="button"
                    className="btn-share"
                    onClick={handleShareResult}
                  >
                    결과 나누기
                  </button>
                </div>
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

          </section>
        )}
      </main>
      </div>

      {toast && (
        <div
          className={`toast toast-${toast.type}`}
          role="status"
          aria-live="polite"
        >
          <img src={mascot} alt="" className="toast-mascot" />
          <p className="toast-message">{toast.message}</p>
          {toast.action && (
            <button
              type="button"
              className="toast-action"
              onClick={async () => {
                const action = toast.action
                dismissToast()
                await action.onClick()
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button
            type="button"
            className="toast-close"
            aria-label="닫기"
            onClick={dismissToast}
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}

export default App
