import { useState } from 'react'
import SprayWallCreateView from './SprayWallCreateView'
import SprayWallGalleryView from './SprayWallGalleryView'
import TeamSprayWallView from './TeamSprayWallView'
import { useAuth } from '../contexts/AuthContext'
import {
  saveSprayWallProblem,
  updateSprayWallProblem,
  fetchSprayWallProblemById,
  useTeamSprayWall,
} from '../hooks/useSupabase'
import './SprayWallView.css'
import './TeamSprayWallView.css'

const SCREENS = {
  menu: 'menu',
  typeSelect: 'typeSelect',
  teamSprayWall: 'teamSprayWall',
  create: 'create',
  gallery: 'gallery',
  edit: 'edit',
}

export default function SprayWallView({ userId, teamId }) {
  const { isAdmin, isSupervisor } = useAuth()
  const canManageTeamWall = isAdmin || isSupervisor
  const { data: teamSprayWall, loading: teamWallLoading, refetch: refetchTeamWall } = useTeamSprayWall(teamId)

  const [screen, setScreen] = useState(SCREENS.menu)
  const [galleryType, setGalleryType] = useState(null)
  const [problemType, setProblemType] = useState(null)
  const [editingProblem, setEditingProblem] = useState(null)
  const [loadingEdit, setLoadingEdit] = useState(false)

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
    setEditingProblem(null)
  }

  const handleBackToTypeSelect = () => {
    setScreen(SCREENS.typeSelect)
    setProblemType(null)
  }

  const handleBackToGallery = () => {
    setScreen(SCREENS.gallery)
    setEditingProblem(null)
  }

  const handleSaveProblem = async ({ name, type, imageData, baseImageData, borders }) => {
    if (!userId) return
    try {
      await saveSprayWallProblem({
        userId,
        teamId: teamId ?? null,
        name,
        type,
        imageData,
        baseImageData,
        borders,
        tags: [],
      })
      alert('저장되었습니다.')
      handleBackToMenu()
    } catch (err) {
      console.error(err)
      alert('저장에 실패했습니다.')
    }
  }

  const handleUpdateProblem = async ({ name, imageData, baseImageData, borders }) => {
    if (!editingProblem?.id) return
    try {
      await updateSprayWallProblem(editingProblem.id, {
        name,
        imageData,
        baseImageData,
        borders,
      })
      alert('수정되었습니다.')
      handleBackToGallery()
    } catch (err) {
      console.error(err)
      alert('수정에 실패했습니다.')
    }
  }

  const handleEditProblem = async (problem) => {
    setLoadingEdit(true)
    try {
      const full = await fetchSprayWallProblemById(problem.id)
      setEditingProblem(full)
      setScreen(SCREENS.edit)
    } catch (err) {
      console.error(err)
      alert('문제 정보를 불러오지 못했습니다.')
    } finally {
      setLoadingEdit(false)
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
    const teamWallSub = !teamId
      ? '팀 소속 시 사용 가능'
      : teamWallLoading
        ? '불러오는 중...'
        : teamSprayWall
          ? '등록됨 · 팀원 문제 생성 시 자동 적용'
          : canManageTeamWall
            ? '미등록 · 관리자 등록 필요'
            : '미등록 · 관리자에게 요청하세요'

    const teamWallSubClass = teamSprayWall
      ? 'spray-wall-card__sub--registered'
      : 'spray-wall-card__sub--pending'

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
            className="spray-wall-card spray-wall-card--menu spray-wall-card--team-wall"
            onClick={() => setScreen(SCREENS.teamSprayWall)}
          >
            <span className="spray-wall-card__icon">🧱</span>
            <span className="spray-wall-card__label">이번달의 스프레이월</span>
            <span className={`spray-wall-card__sub ${teamWallSubClass}`}>{teamWallSub}</span>
          </button>
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

  if (screen === SCREENS.teamSprayWall) {
    return (
      <TeamSprayWallView
        teamId={teamId}
        userId={userId}
        canManage={canManageTeamWall}
        existing={teamSprayWall}
        onBack={handleBackToTypeSelect}
        onSaved={refetchTeamWall}
      />
    )
  }

  if (screen === SCREENS.create) {
    return (
      <SprayWallCreateView
        problemType={problemType}
        defaultImageData={teamSprayWall?.image_data ?? null}
        onSave={handleSaveProblem}
        onBack={handleBackToTypeSelect}
      />
    )
  }

  if (screen === SCREENS.edit && editingProblem) {
    return (
      <SprayWallCreateView
        initialProblem={editingProblem}
        onSave={handleUpdateProblem}
        onBack={handleBackToGallery}
        backLabel={`← ${galleryType === 'endurance' ? '지구력' : '볼더링'} 갤러리`}
      />
    )
  }

  if (screen === SCREENS.gallery) {
    return (
      <SprayWallGalleryView
        userId={userId}
        teamId={teamId}
        galleryType={galleryType}
        onBack={handleBackToMenu}
        onEdit={handleEditProblem}
        editLoading={loadingEdit}
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
