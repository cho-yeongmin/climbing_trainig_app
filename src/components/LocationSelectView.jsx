import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { usePlaces, useRecentPlaces, saveRecentPlace } from '../hooks/useSupabase'
import './LocationSelectView.css'

const RECENT_STORAGE_KEY = 'climbing_recent_locations'
const MAX_RECENT = 5

/**
 * 장소 선택 페이지 (Figma: "장소를 선택해주세요" 클릭 시 표시)
 * - 검색: Supabase places DB 검색
 * - 최근 검색: user_recent_places 또는 localStorage (비로그인 시)
 */
export default function LocationSelectView({ onClose, onSelect }) {
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const { data: searchResults, loading: searchLoading } = usePlaces(searchQuery)
  const { data: recentPlaces, refetch: refetchRecent } = useRecentPlaces()
  const [localRecent, setLocalRecent] = useState([])

  useEffect(() => {
    if (user) return
    try {
      const raw = localStorage.getItem(RECENT_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        setLocalRecent(Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [])
      } else {
        setLocalRecent([])
      }
    } catch {
      setLocalRecent([])
    }
  }, [user])

  const recentList = user ? recentPlaces : localRecent

  const saveRecent = async (place) => {
    if (user) {
      try {
        await saveRecentPlace(user.id, place.id)
        refetchRecent()
      } catch {}
    } else {
      const without = localRecent.filter((p) => p.id !== place.id)
      const next = [{ ...place }, ...without].slice(0, MAX_RECENT)
      setLocalRecent(next)
      try {
        localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next))
      } catch {}
    }
  }

  const handleSelectPlace = async (place) => {
    await saveRecent(place)
    onSelect?.(place)
    onClose()
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
  }

  const displayList = searchQuery.trim() ? searchResults : []
  const showRecent = !searchQuery.trim()

  return (
    <div className="location-select" role="dialog" aria-modal="true" aria-labelledby="location-select-title">
      <div className="location-select__backdrop" onClick={onClose} aria-hidden />
      <div className="location-select__panel">
        <h1 id="location-select-title" className="location-select__title">
          클라이밍을 잘하고 싶다
        </h1>

        <form className="location-select__search-form" onSubmit={handleSearchSubmit}>
          <span className="location-select__search-icon" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" fill="currentColor"/>
            </svg>
          </span>
          <input
            type="search"
            className="location-select__search-input"
            placeholder="검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="장소 검색"
            autoComplete="off"
          />
        </form>

        <section className="location-select__recent" aria-label={showRecent ? '최근 검색' : '검색 결과'}>
          <h2 className="location-select__recent-title">
            {showRecent ? '최근 검색' : '검색 결과'}
          </h2>
          {showRecent ? (
            recentList.length === 0 ? (
              <p className="location-select__recent-empty">최근 검색한 장소가 없습니다.</p>
            ) : (
              <ul className="location-select__recent-list">
                {recentList.map((place) => (
                  <li key={place.id}>
                    <button
                      type="button"
                      className="location-select__item"
                      onClick={() => handleSelectPlace(place)}
                    >
                      {place.image_url ? (
                        <img
                          src={place.image_url}
                          alt=""
                          className="location-select__item-thumb"
                        />
                      ) : (
                        <span className="location-select__item-icon" aria-hidden />
                      )}
                      <span className="location-select__item-content">
                        <span className="location-select__item-name">{place.name}</span>
                        <span className="location-select__item-address">{place.address}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : searchLoading ? (
            <p className="location-select__recent-empty">검색 중...</p>
          ) : displayList.length === 0 ? (
            <p className="location-select__recent-empty">검색 결과가 없습니다.</p>
          ) : (
            <ul className="location-select__recent-list">
              {displayList.map((place) => (
                <li key={place.id}>
                  <button
                    type="button"
                    className="location-select__item"
                    onClick={() => handleSelectPlace(place)}
                  >
                    {place.image_url ? (
                      <img
                        src={place.image_url}
                        alt=""
                        className="location-select__item-thumb"
                      />
                    ) : (
                      <span className="location-select__item-icon" aria-hidden />
                    )}
                    <span className="location-select__item-content">
                      <span className="location-select__item-name">{place.name}</span>
                      <span className="location-select__item-address">{place.address}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
