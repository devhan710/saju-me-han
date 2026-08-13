export default function Sidebar({
  user,
  userLabel,
  authLoading,
  authError,
  readings,
  readingsError,
  selectedReadingId,
  deletingId,
  loading,
  onSignIn,
  onSignOut,
  onNewSaju,
  onSelectReading,
  onDeleteReading,
}) {
  return (
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
              onClick={onSignOut}
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
              onClick={onSignIn}
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
        onClick={onNewSaju}
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
                onClick={() => onSelectReading(reading)}
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
                onClick={(event) => onDeleteReading(reading.id, event)}
              >
                {deletingId === reading.id ? '…' : '삭제'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
