import mascot from '../assets/tree.png'

export default function Toast({ toast, onDismiss }) {
  if (!toast) return null

  return (
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
            onDismiss()
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
        onClick={onDismiss}
      >
        ×
      </button>
    </div>
  )
}
