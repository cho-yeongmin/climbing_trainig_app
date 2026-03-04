import './ErrorFallback.css'

const isDev = import.meta.env.DEV

export default function ErrorFallback({ error, reset }) {
  const msg = error?.message?.toLowerCase() ?? ''
  const isChunkLoadError =
    msg.includes('dynamically imported') ||
    msg.includes('importing module') ||
    msg.includes('loading chunk') ||
    msg.includes('chunk-load')

  const isConnectionError =
    !isChunkLoadError &&
    (msg.includes('connection') ||
      msg.includes('failed to fetch') ||
      msg.includes('network'))

  const isDevServer = window.location?.hostname === 'localhost' || window.location?.hostname === '127.0.0.1'

  return (
    <div className="error-fallback">
      <div className="error-fallback__card">
        <div className="error-fallback__icon" aria-hidden>⚠</div>
        <h1 className="error-fallback__title">
          {isChunkLoadError ? '페이지 로드에 실패했습니다' : isConnectionError ? '연결에 실패했습니다' : '오류가 발생했습니다'}
        </h1>
        <p className="error-fallback__message">
          {isChunkLoadError ? (
            <>
              앱이 최신 버전으로 업데이트되었을 수 있습니다.
              <br />
              <strong>캐시를 비운 뒤 새로고침</strong> 해주세요. (Windows: <code>Ctrl+Shift+R</code>, Mac: <code>Cmd+Shift+R</code>)
            </>
          ) : isConnectionError && isDevServer ? (
            <>
              개발 서버에 연결할 수 없습니다.
              <br />
              터미널에서 <code>npm run dev</code>를 실행한 뒤, 페이지를 새로고침 해주세요.
            </>
          ) : isConnectionError ? (
            <>
              네트워크 연결을 확인해 주세요.
              <br />
              아래 버튼으로 새로고침 해보세요.
            </>
          ) : (
            <>
              일시적인 오류일 수 있습니다.
              <br />
              아래 버튼으로 새로고침 해보세요.
            </>
          )}
        </p>
        {isDev && error?.message && (
          <pre className="error-fallback__debug" aria-hidden>
            {error.message}
          </pre>
        )}
        <button type="button" className="error-fallback__button" onClick={reset}>
          새로고침
        </button>
      </div>
    </div>
  )
}
