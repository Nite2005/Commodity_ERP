import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Package,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react'
import { useActiveUser } from '../../context/UserContext'
import { ApiClientError } from '../../api/client'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Modal'

export function LoginPage() {
  const { login } = useActiveUser()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const submitEmail = email.trim()
    const submitPwd = password

    if (!submitEmail) {
      setError('Please enter your email address.')
      return
    }
    if (!submitPwd) {
      setError('Please enter your password.')
      return
    }

    setLoading(true)
    try {
      await login(submitEmail, submitPwd)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 px-4 py-8 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 to-amber-500 text-white shadow-lg shadow-brand-500/30 mb-1">
            <Package size={30} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">TRADESWIFT ERP</h1>
          <p className="text-xs text-slate-400">
            Physical Commodity Trading & Governance Platform
          </p>
        </div>

        {/* Main Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-8 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-lg font-bold text-slate-900">Sign In to Your Account</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter your email and password to continue
            </p>
          </div>

          {error && <Alert message={error} type="error" />}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-xs pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-slate-900 shadow-none"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-3 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-xs pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-slate-900 shadow-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-brand-600/20 mt-2"
            >
              {loading ? (
                <span>Authenticating…</span>
              ) : (
                <>
                  <span>Sign In to ERP</span>
                  <ArrowRight size={15} />
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Security / System Footer */}
        <div className="text-center text-xs text-slate-400 space-y-1">
          <p className="flex items-center justify-center gap-1.5">
            <CheckCircle2 size={13} className="text-emerald-400" />
            Tradeswift Multi-Gate RBAC Security Enabled
          </p>
          <p className="text-[11px] text-slate-500">Jaipur, Rajasthan · Physical Trading</p>
        </div>
      </div>
    </div>
  )
}
