import mascot from '../assets/tree.png'

export default function Hero({ selectedReadingId, name, hasSavedProfile }) {
  return (
    <header className="hero">
      <img src={mascot} alt="" className="mascot mascot-hero" />
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
  )
}
