import { useEffect, useMemo, useState } from 'react'
import { setAnalyticsUserId, trackEvent } from '../lib/analytics'
import { getUserLabel, signInWithGoogle, signOut } from '../lib/auth'
import { supabase } from '../lib/supabaseClient'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState('')

  const userLabel = useMemo(() => getUserLabel(user), [user])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return
      if (error) {
        setAuthError(
          error.message || '로그인 상태를 확인하지 못했어요. 잠시 후 다시 해 볼까요?',
        )
      } else {
        setUser(data.session?.user ?? null)
        setAnalyticsUserId(data.session?.user?.id)
      }
      setAuthLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)
      setAuthError('')
      setAnalyticsUserId(session?.user?.id)

      if (event === 'SIGNED_IN' && session?.user) {
        const pending = sessionStorage.getItem('ga_login_pending')
        if (pending) {
          sessionStorage.removeItem('ga_login_pending')
          trackEvent('login_success', { method: 'google' })
        }
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async () => {
    setAuthError('')
    try {
      await signInWithGoogle()
    } catch (err) {
      const message = err.message || '로그인이 잘 안 됐어요. 다시 한 번 해 볼까요?'
      setAuthError(message)
      throw new Error(message)
    }
  }

  const signOutUser = async () => {
    setAuthError('')
    try {
      await signOut()
      setUser(null)
    } catch (err) {
      const message = err.message || '로그아웃이 잘 안 됐어요. 다시 시도해 주세요.'
      setAuthError(message)
      throw new Error(message)
    }
  }

  return {
    user,
    userLabel,
    authLoading,
    authError,
    setAuthError,
    signIn,
    signOutUser,
  }
}
