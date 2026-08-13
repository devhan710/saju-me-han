const MEASUREMENT_ID = 'G-MCYEV4XB25'

export function trackEvent(name, params = {}) {
  if (typeof window.gtag !== 'function') return
  window.gtag('event', name, params)
}

export function setAnalyticsUserId(userId) {
  if (typeof window.gtag !== 'function') return
  window.gtag('set', { user_id: userId || undefined })
  window.gtag('config', MEASUREMENT_ID, {
    user_id: userId || undefined,
    send_page_view: false,
  })
}
