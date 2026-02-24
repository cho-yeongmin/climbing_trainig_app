import { useState, useRef, useCallback, useEffect } from 'react'
import './SprayWallCreateView.css'

const LONG_PRESS_MS = 500
const CLICK_DELAY_MS = 400
const CLICK_DISTANCE_THRESHOLD = 50
const TAP_MAX_DURATION_MS = 350 // 이 시간보다 길게 누르면 탭으로 카운트하지 않음 (길게누르기 vs 탭 구분)
const TAP_WINDOW_MS = 450 // 이 시간 안의 연속 탭만 멀티탭으로 인정
const COLOR_THRESHOLD = 40

function findSimilarColorRegion(ctx, width, height, startX, startY, threshold = COLOR_THRESHOLD) {
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  const startIdx = (Math.floor(startY) * width + Math.floor(startX)) * 4
  if (startIdx < 0 || startIdx >= data.length) return null

  const targetR = data[startIdx]
  const targetG = data[startIdx + 1]
  const targetB = data[startIdx + 2]

  const visited = Array(height)
    .fill(null)
    .map(() => Array(width).fill(false))
  const region = []
  const stack = [[Math.floor(startX), Math.floor(startY)]]
  const maxPixels = 50000

  function isSimilar(r, g, b) {
    const diff = Math.sqrt(
      (r - targetR) ** 2 + (g - targetG) ** 2 + (b - targetB) ** 2
    )
    return diff <= threshold
  }

  while (stack.length > 0 && region.length < maxPixels) {
    const [x, y] = stack.pop()
    if (x < 0 || x >= width || y < 0 || y >= height) continue
    if (visited[y][x]) continue

    const idx = (y * width + x) * 4
    const r = data[idx]
    const g = data[idx + 1]
    const b = data[idx + 2]
    if (!isSimilar(r, g, b)) continue

    visited[y][x] = true
    region.push([x, y])
    if (x + 1 < width) stack.push([x + 1, y])
    if (x - 1 >= 0) stack.push([x - 1, y])
    if (y + 1 < height) stack.push([x, y + 1])
    if (y - 1 >= 0) stack.push([x, y - 1])
  }

  if (region.length < 10) return null

  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity
  region.forEach(([x, y]) => {
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  })

  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const w = maxX - minX + 10
  const h = maxY - minY + 10

  return {
    type: 'ellipse',
    centerX,
    centerY,
    width: w,
    height: h,
    radius: Math.max(w, h) / 2,
    color: '#FF0000',
    points: region,
  }
}

function isPointInPolygon(x, y, points) {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i][0],
      yi = points[i][1]
    const xj = points[j][0],
      yj = points[j][1]
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function findBorderAtPoint(borders, x, y) {
  for (let i = borders.length - 1; i >= 0; i--) {
    const b = borders[i]
    if (b.type === 'circle') {
      const d = Math.sqrt((x - b.centerX) ** 2 + (y - b.centerY) ** 2)
      if (d <= b.radius) return i
    } else if (b.type === 'ellipse') {
      const dx = (x - b.centerX) / (b.width / 2)
      const dy = (y - b.centerY) / (b.height / 2)
      if (dx * dx + dy * dy <= 1) return i
    } else if (b.type === 'polygon' && b.points?.length) {
      if (isPointInPolygon(x, y, b.points)) return i
    }
  }
  return -1
}

function getCanvasCoords(e, canvasRef) {
  const canvas = canvasRef.current
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  const clientX = e.touches?.[0]?.clientX ?? e.clientX
  const clientY = e.touches?.[0]?.clientY ?? e.clientY
  const x = Math.max(0, Math.min((clientX - rect.left) * scaleX, canvas.width))
  const y = Math.max(0, Math.min((clientY - rect.top) * scaleY, canvas.height))
  return { x, y }
}

export default function SprayWallCreateView({ problemType, onSave, onBack }) {
  const [imageDataUrl, setImageDataUrl] = useState(null)
  const [imageReady, setImageReady] = useState(false)
  const [borders, setBorders] = useState([])
  const [problemName, setProblemName] = useState('')
  const [saving, setSaving] = useState(false)
  const canvasRef = useRef(null)
  const imageRef = useRef(null)
  const longPressTimerRef = useRef(null)
  const clickTimerRef = useRef(null)
  const lastTapRef = useRef({ x: 0, y: 0, count: 0, time: 0 })
  const pointerDownRef = useRef(null) // { x, y, time, idx? }
  const longPressFiredRef = useRef(false)

  const getNextNumFromBorders = useCallback((bordersList) => {
    const used = new Set()
    bordersList.forEach((b) => (b.numbers || []).forEach((n) => used.add(n)))
    let n = 1
    while (used.has(n)) n++
    return n
  }, [])

  const drawBorders = useCallback(
    (bordersToDraw) => {
      const canvas = canvasRef.current
      const img = imageRef.current
      if (!canvas || !img) return
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      ;(bordersToDraw || []).forEach((b) => {
        ctx.strokeStyle = b.color
        ctx.lineWidth = 4
        ctx.beginPath()
        if (b.type === 'circle') {
          ctx.arc(b.centerX, b.centerY, b.radius, 0, Math.PI * 2)
        } else if (b.type === 'ellipse') {
          ctx.ellipse(
            b.centerX,
            b.centerY,
            b.width / 2,
            b.height / 2,
            0,
            0,
            Math.PI * 2
          )
        } else if (b.type === 'polygon' && b.points?.length) {
          const pts = b.points
          ctx.moveTo(pts[0][0], pts[0][1])
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
          ctx.closePath()
        }
        ctx.stroke()
        if (problemType === 'endurance' && b.numbers?.length) {
          const fs = Math.max(14, Math.min(28, (b.width || b.radius * 2) * 0.25))
          ctx.fillStyle = '#FF0000'
          ctx.font = `bold ${fs}px Arial`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.strokeStyle = '#FFF'
          ctx.lineWidth = 3
          const text = b.numbers.join(', ')
          ctx.strokeText(text, b.centerX, b.centerY)
          ctx.fillText(text, b.centerX, b.centerY)
        }
      })
    },
    [problemType]
  )

  useEffect(() => {
    if (imageReady) drawBorders(borders)
  }, [borders, imageReady, drawBorders])

  const handleImageLoad = useCallback(
    (e) => {
      const img = e.target
      imageRef.current = img
      const maxW = 400
      const maxH = window.innerHeight * 0.6
      let w = img.naturalWidth
      let h = img.naturalHeight
      if (w > maxW) {
        h = (h * maxW) / w
        w = maxW
      }
      if (h > maxH) {
        w = (w * maxH) / h
        h = maxH
      }
      const canvas = canvasRef.current
      if (canvas) {
        canvas.width = w
        canvas.height = h
        canvas.style.width = w + 'px'
        canvas.style.height = h + 'px'
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)
      }
    },
    []
  )

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (imageDataUrl) URL.revokeObjectURL(imageDataUrl)
    const url = URL.createObjectURL(file)
    setImageDataUrl(url)
    setImageReady(false)
    setBorders([])
  }, [imageDataUrl])

  const handleClick = useCallback(
    (x, y, clickCount) => {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx || !problemType) return

      setBorders((prev) => {
        const idx = findBorderAtPoint(prev, x, y)
        if (idx === -1) {
          if (clickCount !== 1) return prev
          const region = findSimilarColorRegion(
            ctx,
            canvas.width,
            canvas.height,
            x,
            y
          )
          if (region && region.points.length > 10) {
            const area = canvas.width * canvas.height
            const regArea = region.width * region.height
            if (regArea > area * 0.1) return prev
            const newB = {
              ...region,
              numbers: problemType === 'endurance' ? [getNextNumFromBorders(prev)] : undefined,
            }
            return [...prev, newB]
          }
          const newB = {
            type: 'circle',
            centerX: x,
            centerY: y,
            radius: 30,
            color: '#FF0000',
            numbers: problemType === 'endurance' ? [getNextNumFromBorders(prev)] : undefined,
          }
          return [...prev, newB]
        }

        const b = prev[idx]
        if (problemType === 'bouldering') {
          if (clickCount === 1) {
            return prev.map((p, i) =>
              i === idx ? { ...p, color: '#FF0000' } : p
            )
          }
          if (clickCount === 2) {
            return prev.map((p, i) =>
              i === idx ? { ...p, color: '#00FF00' } : p
            )
          }
          if (clickCount >= 3) {
            return prev.map((p, i) =>
              i === idx ? { ...p, color: '#0000FF' } : p
            )
          }
        } else {
          if (clickCount === 2) {
            const newNum = getNextNumFromBorders(prev)
            const nums = [...(b.numbers || []), newNum].sort((a, b) => a - b)
            return prev.map((p, i) =>
              i === idx ? { ...p, numbers: nums } : p
            )
          }
          if (clickCount >= 3) {
            return prev.filter((_, i) => i !== idx)
          }
        }
        return prev
      })
    },
    [problemType, getNextNumFromBorders]
  )

  const handleLongPress = useCallback(
    (idx) => {
      setBorders((prev) => {
        if (problemType === 'bouldering') {
          return prev.filter((_, i) => i !== idx)
        }
        const b = prev[idx]
        if (problemType !== 'endurance' || !b?.numbers?.length) return prev
        const nums = [...b.numbers]
        nums.pop()
        if (nums.length === 0) return prev.filter((_, i) => i !== idx)
        return prev.map((p, i) => (i === idx ? { ...p, numbers: nums } : p))
      })
    },
    [problemType]
  )

  const handlePointerDown = useCallback(
    (e) => {
      e.preventDefault()
      const pos = getCanvasCoords(e, canvasRef)
      if (!pos) return

      longPressFiredRef.current = false

      const idx = findBorderAtPoint(borders, pos.x, pos.y)
      const isOnBorder = idx !== -1

      pointerDownRef.current = { x: pos.x, y: pos.y, time: Date.now(), idx }

      if (isOnBorder && (problemType === 'bouldering' || problemType === 'endurance')) {
        longPressTimerRef.current = setTimeout(() => {
          longPressFiredRef.current = true
          clearTimeout(clickTimerRef.current)
          clickTimerRef.current = null
          handleLongPress(idx)
          longPressTimerRef.current = null
        }, LONG_PRESS_MS)
      }
    },
    [borders, problemType, handleLongPress]
  )

  const handlePointerUp = useCallback(
    (e) => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
      }
      if (longPressFiredRef.current) {
        longPressFiredRef.current = false
        return
      }
      const pd = pointerDownRef.current
      if (!pd) return

      const pressDuration = Date.now() - pd.time
      if (pressDuration >= TAP_MAX_DURATION_MS) {
        pointerDownRef.current = null
        return
      }

      const last = lastTapRef.current
      const dist = Math.sqrt(
        (pd.x - last.x) ** 2 + (pd.y - last.y) ** 2
      )
      const withinTime = Date.now() - last.time <= TAP_WINDOW_MS
      const isNewSequence =
        !withinTime || dist > CLICK_DISTANCE_THRESHOLD

      const tapCount = isNewSequence ? 1 : last.count + 1
      lastTapRef.current = { x: pd.x, y: pd.y, count: tapCount, time: Date.now() }
      pointerDownRef.current = null

      clearTimeout(clickTimerRef.current)
      const x = pd.x
      const y = pd.y
      clickTimerRef.current = setTimeout(() => {
        handleClick(x, y, tapCount)
        clickTimerRef.current = null
      }, CLICK_DELAY_MS)
    },
    [handleClick]
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onDown = (e) => {
      e.preventDefault()
      handlePointerDown(e)
    }
    canvas.addEventListener('pointerdown', onDown, { passive: false })
    canvas.addEventListener('pointerup', handlePointerUp)
    canvas.addEventListener('pointercancel', handlePointerUp)
    canvas.addEventListener('pointerleave', handlePointerUp)
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointerup', handlePointerUp)
      canvas.removeEventListener('pointercancel', handlePointerUp)
      canvas.removeEventListener('pointerleave', handlePointerUp)
    }
  }, [handlePointerDown, handlePointerUp])


  const handleSave = useCallback(async () => {
    if (!imageReady || !problemName.trim()) {
      alert(problemName.trim() ? '이미지를 업로드해주세요.' : '문제 이름을 입력해주세요.')
      return
    }
    const canvas = canvasRef.current
    if (!canvas) return

    const finalCanvas = document.createElement('canvas')
    finalCanvas.width = canvas.width
    finalCanvas.height = canvas.height
    const ctx = finalCanvas.getContext('2d')
    ctx.drawImage(imageRef.current, 0, 0, finalCanvas.width, finalCanvas.height)

    borders.forEach((b) => {
      ctx.strokeStyle = b.color
      ctx.lineWidth = 3
      ctx.beginPath()
      if (b.type === 'circle') {
        ctx.arc(b.centerX, b.centerY, b.radius, 0, Math.PI * 2)
      } else if (b.type === 'ellipse') {
        ctx.ellipse(
          b.centerX,
          b.centerY,
          b.width / 2,
          b.height / 2,
          0,
          0,
          Math.PI * 2
        )
      } else if (b.type === 'polygon' && b.points?.length) {
        const pts = b.points
        ctx.moveTo(pts[0][0], pts[0][1])
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
        ctx.closePath()
      }
      ctx.stroke()
      if (problemType === 'endurance' && b.numbers?.length) {
        const fs = Math.max(14, Math.min(28, (b.width || b.radius * 2) * 0.25))
        ctx.fillStyle = '#FF0000'
        ctx.font = `bold ${fs}px Arial`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.strokeStyle = '#FFF'
        ctx.lineWidth = 3
        const text = b.numbers.join(', ')
        ctx.strokeText(text, b.centerX, b.centerY)
        ctx.fillText(text, b.centerX, b.centerY)
      }
    })

    setSaving(true)
    try {
      await onSave(
        problemName.trim(),
        problemType,
        finalCanvas.toDataURL('image/png')
      )
    } finally {
      setSaving(false)
    }
  }, [imageReady, problemName, problemType, borders, onSave])


  const typeLabel = problemType === 'bouldering' ? '볼더링' : '지구력'

  return (
    <div className="spray-wall-create">
      <div className="spray-wall-create__header">
        <button type="button" className="spray-wall__back" onClick={onBack}>
          ← 타입 선택
        </button>
        <span className="spray-wall-create__type-badge">{typeLabel}</span>
      </div>

      <div className="spray-wall-create__area">
        {!imageDataUrl ? (
          <label className="spray-wall-create__upload">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="spray-wall-create__file"
            />
            <span>이미지를 업로드하세요</span>
          </label>
        ) : (
          <>
            <img
              ref={imageRef}
              src={imageDataUrl}
              alt=""
              style={{ display: 'none' }}
              onLoad={(e) => {
                handleImageLoad(e)
                setImageReady(true)
              }}
            />
            <canvas
              ref={canvasRef}
              className="spray-wall-create__canvas"
              style={{ display: imageReady ? 'block' : 'none' }}
            />
            {!imageReady && <p className="spray-wall-create__loading">로딩 중...</p>}
            <button
              type="button"
              className="spray-wall-create__reset"
              onClick={() => {
                setImageReady(false)
                setImageDataUrl(null)
                setBorders([])
                if (imageDataUrl) URL.revokeObjectURL(imageDataUrl)
              }}
            >
              이미지 다시 선택
            </button>
          </>
        )}
      </div>

      <div className="spray-wall-create__controls">
        <input
          type="text"
          className="spray-wall-create__name"
          placeholder="문제 이름 입력"
          value={problemName}
          onChange={(e) => setProblemName(e.target.value)}
        />
        <button
          type="button"
          className="spray-wall-create__save"
          onClick={handleSave}
          disabled={saving || !imageReady}
        >
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      <p className="spray-wall-create__hint">
        {problemType === 'bouldering'
          ? '볼더링: 클릭→빨강, 더블클릭→초록, 트리플클릭→파랑, 길게누르기→삭제'
          : '지구력: 클릭→홀드 추가, 더블클릭→순서 추가, 길게누르기→숫자 제거'}
      </p>
    </div>
  )
}
