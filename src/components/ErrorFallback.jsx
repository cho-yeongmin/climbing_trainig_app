import './ErrorFallback.css'

export default function ErrorFallback({ error, reset }) {
  const isConnectionError =
    error?.message?.toLowerCase().includes('connection') ||
    error?.message?.toLowerCase().includes('failed to fetch') ||
    error?.message?.toLowerCase().includes('network')

  return (
    <div className="error-fallback">
      <div className="error-fallback__card">
        <div className="error-fallback__icon" aria-hidden>⚠</div>
        <h1 className="error-fallback__title">
          {isConnectionError ? '연결에 실패했습니다' : '오류가 발생했습니다'}
        </h1>
        <p className="error-fallback__message">
          {isConnectionError ? (
            <>
              개발 서버에 연결할 수 없습니다.
              <br />
              터미널에서 <code>npm run dev</code>를 실행한 뒤, 페이지를 새로고침 해주세요.
            </>
          ) : (
            <>
              일시적인 오류일 수 있습니다.
              <br />
              아래 버튼으로 새로고침 하거나, 터미널에서 <code>npm run dev</code>가 실행 중인지 확인하세요.
            </>
          )}
        </p>
        <button type="button" className="error-fallback__button" onClick={reset}>
          새로고침
        </button>
      </div>
    </div>
  )
}
