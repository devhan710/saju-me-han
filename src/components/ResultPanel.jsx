import { parseResultSections } from '../lib/resultText'

export default function ResultPanel({
  resultRef,
  resultTitle,
  name,
  birthDate,
  birthTime,
  shownChart,
  result,
  onEditInput,
  onShare,
}) {
  return (
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
                  shownChart?.manAge != null && `만 ${shownChart.manAge}세`,
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
            <button type="button" className="btn-share" onClick={onEditInput}>
              입력 고치기
            </button>
            <button type="button" className="btn-share" onClick={onShare}>
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
  )
}
