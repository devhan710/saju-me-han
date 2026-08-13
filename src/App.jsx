import { useEffect, useMemo, useRef, useState } from 'react'
import mascot from './assets/tree.png'
import Hero from './components/Hero'
import ResultPanel from './components/ResultPanel'
import SajuForm from './components/SajuForm'
import Sidebar from './components/Sidebar'
import Toast from './components/Toast'
import { useAuth } from './hooks/useAuth'
import { useToast } from './hooks/useToast'
import { trackEvent } from './lib/analytics'
import { formatBirthTime, buildShareText, getMissingFields } from './lib/format'
import { buildReadingPrompt, callGemini, formatGeminiError } from './lib/gemini'
import {
  isSameAsProfile,
  fetchProfile,
  profileFromReading,
  shouldUpdateProfile,
  upsertProfile,
} from './lib/profiles'
import {
  buildMetadataPayload,
  buildReadingPayload,
  createReading,
  deleteReading,
  fetchReadings,
  updateReading,
} from './lib/readings'
import { cleanResultText } from './lib/resultText'
import { buildSajuFromInput, calcManAge } from './lib/saju'
import './App.css'

function App() {
  const {
    user,
    userLabel,
    authLoading,
    authError,
    signIn,
    signOutUser,
  } = useAuth()
  const { toast, showToast, dismissToast } = useToast()

  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [birthTime, setBirthTime] = useState('')
  const [gender, setGender] = useState('')
  const [calendar, setCalendar] = useState('solar')

  const [loading, setLoading] = useState(false)
  const [loadingKind, setLoadingKind] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState('')
  const [resultTitle, setResultTitle] = useState('사주 해석')
  const [progress, setProgress] = useState(0)
  const [chartDisplay, setChartDisplay] = useState(null)
  const [readings, setReadings] = useState([])
  const [selectedReadingId, setSelectedReadingId] = useState(null)
  const [readingsError, setReadingsError] = useState('')
  const [formCollapsed, setFormCollapsed] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [savingMetadata, setSavingMetadata] = useState(false)
  const [profile, setProfile] = useState(null)
  const [savingProfile, setSavingProfile] = useState(false)

  const nameInputRef = useRef(null)
  const resultRef = useRef(null)
  const selectedReadingIdRef = useRef(null)
  selectedReadingIdRef.current = selectedReadingId

  const selectedReading = useMemo(
    () => readings.find((row) => row.id === selectedReadingId) ?? null,
    [readings, selectedReadingId],
  )
  const missingFields = useMemo(
    () => getMissingFields({ name, birthDate, birthTime, gender }),
    [name, birthDate, birthTime, gender],
  )
  const formReady = missingFields.length === 0
  const formFields = useMemo(
    () => ({ name, birthDate, birthTime, gender, calendar }),
    [name, birthDate, birthTime, gender, calendar],
  )
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
  const matchesProfile = isSameAsProfile(profile, formFields)
  const hasSavedProfile = Boolean(
    profile?.name && profile?.birth_date && profile?.birth_time && profile?.gender,
  )
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
  const shownChart = chartDisplay || liveChart

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
          nextProfile ?? profileFromReading(user.id, rows[0])

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

  const handleGoogleSignIn = async () => {
    trackEvent('login', { method: 'google' })
    sessionStorage.setItem('ga_login_pending', '1')
    try {
      await signIn()
    } catch (err) {
      sessionStorage.removeItem('ga_login_pending')
      trackEvent('login_error', { method: 'google' })
      showToast(err.message, { type: 'error' })
    }
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

  const handleSignOut = async () => {
    trackEvent('logout')
    try {
      await signOutUser()
      setProfile(null)
      handleNewSaju({ useProfile: false })
      showToast('다음에 또 만나요.', {
        action: { label: '다시 만나요', onClick: handleGoogleSignIn },
      })
    } catch (err) {
      showToast(err.message, { type: 'error' })
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

    trackEvent('save_profile')
    setSavingProfile(true)
    setError('')
    try {
      const saved = await upsertProfile(user.id, formFields)
      setProfile(saved)
      showToast('기본 정보를 기억해 둘게요.', {
        action: { label: '바로 채우기', onClick: () => handleNewSaju() },
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
    trackEvent('delete_reading', {
      reading_kind: removed?.result_kind || 'overall',
    })
    setDeletingId(readingId)
    setReadingsError('')
    try {
      await deleteReading(readingId)
      setReadings((prev) => prev.filter((row) => row.id !== readingId))
      if (selectedReadingId === readingId) {
        handleNewSaju()
      }
      showToast('기록을 치워 두었어요.', {
        action:
          removed && user
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
                    showToast(undoError.message || '되돌리기가 잘 안 됐어요.', {
                      type: 'error',
                    })
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

    trackEvent('save_reading_info')
    const chartResult = buildSajuFromInput(formFields)
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
          ...formFields,
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

  const handleViewSaju = async (kind = 'overall') => {
    if (missingFields.length > 0) {
      setError(`${missingFields.join(', ')}을(를) 알려 주시면 읽어 볼게요.`)
      setFormCollapsed(false)
      return
    }

    const chartResult = buildSajuFromInput(formFields)
    if (!chartResult.ok) {
      setError(chartResult.error)
      setResult('')
      setChartDisplay(null)
      setFormCollapsed(false)
      return
    }

    const previousId = selectedReadingId

    trackEvent('generate_reading', { reading_kind: kind })
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

      const text = await callGemini(
        apiKey,
        buildReadingPrompt(kind, chartResult.chartText),
        {
          onRetryWait: (sec) => {
            setError(
              `요청이 많아서 잠시 기다리고 있어요. 약 ${sec}초 뒤에 다시 읽어 볼게요.`,
            )
          },
        },
      )

      setError('')
      setProgress(100)
      await new Promise((resolve) => setTimeout(resolve, 350))
      const cleaned = cleanResultText(text)
      trackEvent('generate_reading_success', {
        reading_kind: kind,
        saved: Boolean(user || previousId),
      })
      setResult(cleaned)
      setFormCollapsed(true)
      scrollToResult()

      const payload = buildReadingPayload({
        ...formFields,
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
      trackEvent('generate_reading_error', { reading_kind: kind })
      setError(
        formatGeminiError(err.message) ||
          '해석 중에 문제가 생겼어요. 다시 한 번 해 볼까요?',
      )
      setProgress(0)
    } finally {
      setLoading(false)
      setLoadingKind('')
    }
  }

  const handleShareResult = async () => {
    if (!result) return

    const shareText = buildShareText({
      resultTitle,
      name,
      birthDate,
      birthTime,
      chartDisplay,
      result,
    })

    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({
          title: `Saju Me · ${resultTitle}`,
          text: shareText,
        })
        trackEvent('share', {
          method: 'native',
          content_type: resultTitle === '연애운' ? 'love' : 'overall',
        })
        showToast('잘 전달됐어요.')
        return
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText)
        trackEvent('share', {
          method: 'clipboard',
          content_type: resultTitle === '연애운' ? 'love' : 'overall',
        })
        showToast('해석을 복사해 두었어요.')
        return
      }

      const textarea = document.createElement('textarea')
      textarea.value = shareText
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      trackEvent('share', {
        method: 'clipboard',
        content_type: resultTitle === '연애운' ? 'love' : 'overall',
      })
      showToast('해석을 복사해 두었어요.')
    } catch (err) {
      if (err?.name === 'AbortError') return
      showToast('공유가 잘 안 됐어요. 다시 한 번 해 볼까요?', { type: 'error' })
    }
  }

  return (
    <div className="page">
      <div className="layout">
        <img src={mascot} alt="사주 나무" className="mascot mascot-aside" />

        <Sidebar
          user={user}
          userLabel={userLabel}
          authLoading={authLoading}
          authError={authError}
          readings={readings}
          readingsError={readingsError}
          selectedReadingId={selectedReadingId}
          deletingId={deletingId}
          loading={loading}
          onSignIn={handleGoogleSignIn}
          onSignOut={handleSignOut}
          onNewSaju={() => {
            trackEvent('new_reading', {
              used_profile: hasSavedProfile,
            })
            handleNewSaju()
          }}
          onSelectReading={(reading) => {
            trackEvent('select_content', {
              content_type: 'reading',
              item_id: reading.result_kind || 'overall',
            })
            handleSelectReading(reading)
          }}
          onDeleteReading={handleDeleteReading}
        />

        <Hero
          selectedReadingId={selectedReadingId}
          name={name}
          hasSavedProfile={hasSavedProfile}
        />

        <main className="shell">
          <SajuForm
            name={name}
            birthDate={birthDate}
            birthTime={birthTime}
            gender={gender}
            calendar={calendar}
            nameInputRef={nameInputRef}
            result={result}
            formCollapsed={formCollapsed}
            user={user}
            hasSavedProfile={hasSavedProfile}
            matchesProfile={matchesProfile}
            selectedReadingId={selectedReadingId}
            liveManAge={liveManAge}
            shownChart={shownChart}
            loading={loading}
            loadingKind={loadingKind}
            savingMetadata={savingMetadata}
            savingProfile={savingProfile}
            formReady={formReady}
            missingFields={missingFields}
            hasMetadataChanges={hasMetadataChanges}
            error={error}
            progress={progress}
            onToggleCollapsed={() => setFormCollapsed((prev) => !prev)}
            onFillProfile={() => applyProfileToForm(profile)}
            onChangeName={setName}
            onChangeBirthDate={setBirthDate}
            onChangeBirthTime={setBirthTime}
            onChangeGender={setGender}
            onChangeCalendar={setCalendar}
            onViewSaju={handleViewSaju}
            onSaveMetadata={handleSaveMetadata}
            onSaveProfile={handleSaveAsMyProfile}
          />

          {result && (
            <ResultPanel
              resultRef={resultRef}
              resultTitle={resultTitle}
              name={name}
              birthDate={birthDate}
              birthTime={birthTime}
              shownChart={shownChart}
              result={result}
              onEditInput={() => {
                setFormCollapsed(false)
                requestAnimationFrame(() => nameInputRef.current?.focus())
              }}
              onShare={handleShareResult}
            />
          )}
        </main>
      </div>

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}

export default App
