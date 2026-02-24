import { useState } from 'react'
import SprayWallCreateView from './SprayWallCreateView'
import SprayWallGalleryView from './SprayWallGalleryView'
import { saveSprayWallProblem } from '../hooks/useSupabase'
import './SprayWallView.css'

const SCREENS = {
  menu: 'menu',
  typeSelect: 'typeSelect',
  create: 'create',
  gallery: 'gallery',
}

export default function SprayWallView({ userId }) {
  const [screen, setScreen] = useState(SCREENS.menu)
  const [galleryType, setGalleryType] = useState(null)
  const [problemType, setProblemType] = useState(null)

  const handleOpenCreate = () => {
    setScreen(SCREENS.typeSelect)
  }

  const handleSelectType = (type) => {
    setProblemType(type)
    setScreen(SCREENS.create)
  }

  const handleSelectGallery = (type) => {
    setGalleryType(type)
    setScreen(SCREENS.gallery)
  }

  const handleBackToMenu = () => {
    setScreen(SCREENS.menu)
    setGalleryType(null)
    setProblemType(null)
  }

  const handleSaveProblem = async (name, type, imageData) => {
    if (!userId) return
    try {
      await saveSprayWallProblem({
        userId,
        name,
        type,
        imageData,
        tags: [],
      })
      alert('저장되었습니다.')
      handleBackToMenu()
    } catch (err) {
      console.error(err)
      alert('저장에 실패했습니다.')
    }
  }

  if (!userId) {
    return (
      <div className="spray-wall-view">
        <div className="spray-wall-card">
          <p className="spray-wall__empty">로그인하면 스프레이월 기능을 사용할 수 있습니다.</p>
        </div>
      </div>
    )
  }

  if (screen === SCREENS.typeSelect) {
    return (
      <div className="spray-wall-view">
        <div className="spray-wall-view__header">
          <button type="button" className="spray-wall__back" onClick={handleBackToMenu}>
            ← 스프레이월
          </button>
        </div>
        <h2 className="spray-wall__type-title">문제 타입 선택</h2>
        <div className="spray-wall-view__cards spray-wall-view__cards--type">
          <button
            type="button"
            className="spray-wall-card spray-wall-card--menu"
            onClick={() => handleSelectType('bouldering')}
          >
            <span className="spray-wall-card__icon">🧗</span>
            <span className="spray-wall-card__label">볼더링</span>
          </button>
          <button
            type="button"
            className="spray-wall-card spray-wall-card--menu"
            onClick={() => handleSelectType('endurance')}
          >
            <span className="spray-wall-card__icon">⛰️</span>
            <span className="spray-wall-card__label">지구력</span>
          </button>
        </div>
      </div>
    )
  }

  if (screen === SCREENS.create) {
    return (
      <SprayWallCreateView
        problemType={problemType}
        onSave={handleSaveProblem}
        onBack={handleBackToMenu}
      />
    )
  }

  if (screen === SCREENS.gallery) {
    return (
      <SprayWallGalleryView
        userId={userId}
        galleryType={galleryType}
        onBack={handleBackToMenu}
      />
    )
  }

  return (
    <div className="spray-wall-view">
      <div className="spray-wall-view__cards">
        <button
          type="button"
          className="spray-wall-card spray-wall-card--menu"
          onClick={handleOpenCreate}
        >
          <span className="spray-wall-card__icon">➕</span>
          <span className="spray-wall-card__label">문제 생성</span>
          <span className="spray-wall-card__sub">볼더링 / 지구력 선택 후 시작</span>
        </button>
        <button
          type="button"
          className="spray-wall-card spray-wall-card--menu"
          onClick={() => handleSelectGallery('bouldering')}
        >
          <span className="spray-wall-card__icon">🖼️</span>
          <span className="spray-wall-card__label">볼더링 갤러리</span>
          <span className="spray-wall-card__sub">저장된 볼더링 문제 보기</span>
        </button>
        <button
          type="button"
          className="spray-wall-card spray-wall-card--menu"
          onClick={() => handleSelectGallery('endurance')}
        >
          <span className="spray-wall-card__icon">⛰️</span>
          <span className="spray-wall-card__label">지구력 갤러리</span>
          <span className="spray-wall-card__sub">저장된 지구력 문제 보기</span>
        </button>
      </div>
    </div>
  )
}
