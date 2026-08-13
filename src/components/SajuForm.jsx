import { formatPersonSummary } from '../lib/format'
import ChartPreview from './ChartPreview'

export default function SajuForm({
  name,
  birthDate,
  birthTime,
  gender,
  calendar,
  nameInputRef,
  result,
  formCollapsed,
  user,
  hasSavedProfile,
  matchesProfile,
  selectedReadingId,
  liveManAge,
  shownChart,
  loading,
  loadingKind,
  savingMetadata,
  savingProfile,
  formReady,
  missingFields,
  hasMetadataChanges,
  error,
  progress,
  onToggleCollapsed,
  onFillProfile,
  onChangeName,
  onChangeBirthDate,
  onChangeBirthTime,
  onChangeGender,
  onChangeCalendar,
  onViewSaju,
  onSaveMetadata,
  onSaveProfile,
}) {
  return (
    <section className="form-panel" aria-label="사주 입력">
      {result && (
        <button type="button" className="form-toggle" onClick={onToggleCollapsed}>
          {formCollapsed ? '입력 수정하기' : '입력 접기'}
        </button>
      )}

      {formCollapsed && (
        <p className="form-summary">
          {formatPersonSummary({ name, birthDate, birthTime, gender, calendar })}
        </p>
      )}

      {!formCollapsed && (
        <>
          {user && hasSavedProfile && !matchesProfile && (
            <button type="button" className="form-toggle" onClick={onFillProfile}>
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
              onChange={(e) => onChangeName(e.target.value)}
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="birthDate">생년월일</label>
              <input
                id="birthDate"
                type="date"
                value={birthDate}
                onChange={(e) => onChangeBirthDate(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="birthTime">출생 시간</label>
              <input
                id="birthTime"
                type="time"
                value={birthTime}
                onChange={(e) => onChangeBirthTime(e.target.value)}
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
                  onChange={(e) => onChangeGender(e.target.value)}
                />
                남성
              </label>
              <label className={`chip ${gender === 'female' ? 'is-selected' : ''}`}>
                <input
                  type="radio"
                  name="gender"
                  value="female"
                  checked={gender === 'female'}
                  onChange={(e) => onChangeGender(e.target.value)}
                />
                여성
              </label>
            </div>
          </div>

          <div className="field">
            <span className="field-label">달력</span>
            <div className="chip-group" role="radiogroup" aria-label="달력">
              <label className={`chip ${calendar === 'solar' ? 'is-selected' : ''}`}>
                <input
                  type="radio"
                  name="calendar"
                  value="solar"
                  checked={calendar === 'solar'}
                  onChange={(e) => onChangeCalendar(e.target.value)}
                />
                양력
              </label>
              <label className={`chip ${calendar === 'lunar' ? 'is-selected' : ''}`}>
                <input
                  type="radio"
                  name="calendar"
                  value="lunar"
                  checked={calendar === 'lunar'}
                  onChange={(e) => onChangeCalendar(e.target.value)}
                />
                음력
              </label>
            </div>
          </div>

          <ChartPreview manAge={liveManAge} chart={shownChart} />

          <div className="btn-row">
            <button
              type="button"
              className="btn-primary"
              onClick={() => onViewSaju('overall')}
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
              onClick={() => onViewSaju('love')}
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
              onClick={onSaveMetadata}
              disabled={loading || savingMetadata || savingProfile || !formReady}
            >
              {savingMetadata ? '적어 두는 중…' : '입력 정보만 저장'}
            </button>
          )}

          {user && formReady && !matchesProfile && (
            <button
              type="button"
              className="btn-save-meta"
              onClick={onSaveProfile}
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

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </>
      )}

      {formCollapsed && error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
