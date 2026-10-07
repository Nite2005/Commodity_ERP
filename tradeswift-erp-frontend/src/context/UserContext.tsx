import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { usersApi, ApiClientError } from '../api/client'
import type { User } from '../types'

const AUTH_USER_KEY = 'tradeswift_auth_user'
const AUTH_TOKEN_KEY = 'tradeswift_auth_token'

interface UserContextValue {
  currentUser: User | null
  isAuthenticated: boolean
  token: string | null
  users: User[]
  supervisors: User[]
  isAdmin: boolean
  isEmployee: boolean
  loading: boolean
  error: string
  login: (email: string, password: string) => Promise<User>
  logout: () => void
  refreshUsers: () => Promise<void>
  switchUser: (identifier: string) => void
}

const UserContext = createContext<UserContextValue | null>(null)

export function UserProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Initial user state from localStorage
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem(AUTH_USER_KEY)
      if (saved) return JSON.parse(saved)
    } catch {
      // Fallback
    }
    return null
  })

  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem(AUTH_TOKEN_KEY) || null
  })

  const refreshUsers = useCallback(async () => {
    try {
      const data = await usersApi.list()
      setUsers(data)
      // If we have an active user, sync their data
      setCurrentUser((prev) => {
        if (!prev) return null
        const updated = data.find((u) => u.id === prev.id || u.email?.toLowerCase() === prev.email?.toLowerCase())
        if (updated) {
          localStorage.setItem(AUTH_USER_KEY, JSON.stringify(updated))
          return updated
        }
        return prev
      })
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshUsers()
  }, [refreshUsers])

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    setError('')
    const res = await usersApi.login({ email, password })
    setCurrentUser(res.user)
    setToken(res.token)
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(res.user))
    localStorage.setItem(AUTH_TOKEN_KEY, res.token)
    return res.user
  }, [])

  const logout = useCallback(() => {
    setCurrentUser(null)
    setToken(null)
    localStorage.removeItem(AUTH_USER_KEY)
    localStorage.removeItem(AUTH_TOKEN_KEY)
  }, [])

  const switchUser = useCallback(
    (identifier: string) => {
      const found = users.find(
        (u) =>
          u.username.toLowerCase() === identifier.toLowerCase() ||
          u.email?.toLowerCase() === identifier.toLowerCase(),
      )
      if (found) {
        setCurrentUser(found)
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(found))
      }
    },
    [users],
  )

  const supervisors = useMemo(() => {
    return users.filter((u) => u.role === 'ADMIN' && u.is_active)
  }, [users])

  const isAuthenticated = Boolean(currentUser)
  const isAdmin = currentUser?.role === 'ADMIN'
  const isEmployee = currentUser?.role === 'EMPLOYEE'

  const value = useMemo(
    () => ({
      currentUser,
      isAuthenticated,
      token,
      users,
      supervisors,
      isAdmin,
      isEmployee,
      loading,
      error,
      login,
      logout,
      refreshUsers,
      switchUser,
    }),
    [
      currentUser,
      isAuthenticated,
      token,
      users,
      supervisors,
      isAdmin,
      isEmployee,
      loading,
      error,
      login,
      logout,
      refreshUsers,
      switchUser,
    ],
  )

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useActiveUser() {
  const ctx = useContext(UserContext)
  if (!ctx) {
    throw new Error('useActiveUser must be used within a UserProvider')
  }
  return ctx
}
