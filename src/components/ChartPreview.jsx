export default function ChartPreview({ manAge, chart }) {
  if (manAge == null && !chart) return null

  return (
    <div className="chart-preview" aria-live="polite">
      <p className="chart-preview-title">나의 명식</p>
      {manAge != null && <p className="chart-age">만 {manAge}세</p>}
      {chart && (
        <>
          <div className="pillar-row">
            <div className="pillar">
              <span>시주</span>
              <strong>{chart.hourPillar}</strong>
            </div>
            <div className="pillar">
              <span>일주</span>
              <strong>{chart.dayPillar}</strong>
            </div>
            <div className="pillar">
              <span>월주</span>
              <strong>{chart.monthPillar}</strong>
            </div>
            <div className="pillar">
              <span>년주</span>
              <strong>{chart.yearPillar}</strong>
            </div>
          </div>
          {chart.fiveElements && (
            <p className="chart-elements">오행 {chart.fiveElements}</p>
          )}
        </>
      )}
    </div>
  )
}
