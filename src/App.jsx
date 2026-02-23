import { AuthProvider, useAuth } from './contexts/AuthContext'
import HomeScreen from './components/HomeScreen'
import LoginScreen from './components/LoginScreen'
import './App.css'

function AppContent() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="app app--loading">
        <p>로딩 중...</p>
      </div>
    )
  }

  if (!user) {
    return <LoginScreen />
  }

  return <HomeScreen />
}

function App() {
  return (
    <div className="app">
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </div>
  )
}

export default App
