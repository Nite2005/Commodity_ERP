import { useState, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import {
  Users,
  Shield,
  UserCheck,
  UserX,
  UserPlus,
  Search,
  CheckCircle2,
  Edit2,
  ArrowRightLeft,
  RefreshCw,
} from 'lucide-react'
import { usersApi, ApiClientError } from '../../api/client'
import type { User, UserRole } from '../../types'
import { useActiveUser } from '../../context/UserContext'
import { Button } from '../../components/Button'
import { Modal, Alert } from '../../components/Modal'
import { Card } from '../../components/Card'

export function UsersPage() {
  const { users, currentUser, isAdmin, refreshUsers, switchUser, loading, error: contextError } = useActiveUser()

  // Guard: non-admins are redirected back to Dashboard
  if (!loading && currentUser && !isAdmin) {
    return <Navigate to="/" replace />
  }

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'ADMIN' | 'EMPLOYEE'>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')

  // Modals state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState<{
    full_name: string
    email: string
    password: string
    username: string
    role: UserRole
    designation: string
    is_active: boolean
  }>({
    full_name: '',
    email: '',
    password: '',
    username: '',
    role: 'EMPLOYEE',
    designation: '',
    is_active: true,
  })

  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all([
        refreshUsers(),
        new Promise((resolve) => setTimeout(resolve, 450)),
      ])
      setFeedback({ type: 'success', message: 'User roster refreshed successfully.' })
      setTimeout(() => setFeedback(null), 3000)
    } catch {
      setFeedback({ type: 'error', message: 'Failed to reload user roster.' })
    } finally {
      setRefreshing(false)
    }
  }

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        !search ||
        u.full_name.toLowerCase().includes(search.toLowerCase()) ||
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        (u.email && u.email.toLowerCase().includes(search.toLowerCase())) ||
        (u.designation && u.designation.toLowerCase().includes(search.toLowerCase()))

      const matchRole = roleFilter === 'ALL' || u.role === roleFilter
      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && u.is_active) ||
        (statusFilter === 'INACTIVE' && !u.is_active)

      return matchSearch && matchRole && matchStatus
    })
  }, [users, search, roleFilter, statusFilter])

  // Metrics
  const adminCount = useMemo(() => users.filter((u) => u.role === 'ADMIN').length, [users])
  const employeeCount = useMemo(() => users.filter((u) => u.role === 'EMPLOYEE').length, [users])
  const activeCount = useMemo(() => users.filter((u) => u.is_active).length, [users])

  const openCreateModal = () => {
    setEditingUser(null)
    setFormData({
      full_name: '',
      email: '',
      password: '',
      username: '',
      role: 'EMPLOYEE',
      designation: '',
      is_active: true,
    })
    setFormError('')
    setModalOpen(true)
  }

  const openEditModal = (user: User) => {
    setEditingUser(user)
    setFormData({
      full_name: user.full_name,
      email: user.email || '',
      password: '',
      username: user.username,
      role: user.role,
      designation: user.designation || '',
      is_active: user.is_active,
    })
    setFormError('')
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    if (!formData.full_name.trim()) {
      setFormError('Full name is required.')
      return
    }
    if (!formData.email.trim()) {
      setFormError('Email address is required for user login.')
      return
    }
    if (!editingUser && !formData.password.trim()) {
      setFormError('Password is required for creating a new user account.')
      return
    }

    setSaving(true)
    try {
      if (editingUser) {
        await usersApi.update(editingUser.id, {
          full_name: formData.full_name.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password.trim() || undefined,
          role: formData.role,
          designation: formData.designation.trim() || null,
          is_active: formData.is_active,
        })
        setFeedback({
          type: 'success',
          message: `User '${formData.full_name}' updated successfully.`,
        })
      } else {
        await usersApi.create({
          full_name: formData.full_name.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password.trim(),
          username: formData.username.trim() || null,
          role: formData.role,
          designation: formData.designation.trim() || null,
        })
        setFeedback({
          type: 'success',
          message: `User '${formData.full_name}' created successfully with login email '${formData.email.trim()}'.`,
        })
      }
      setModalOpen(false)
      await refreshUsers()
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : 'Failed to save user.')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (user: User) => {
    if (!isAdmin) {
      setFeedback({
        type: 'error',
        message: 'Permission denied: Only Administrators can change user activation status.',
      })
      return
    }
    try {
      await usersApi.update(user.id, { is_active: !user.is_active })
      setFeedback({
        type: 'success',
        message: `User '${user.full_name}' has been ${!user.is_active ? 'activated' : 'deactivated'}.`,
      })
      await refreshUsers()
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof ApiClientError ? err.message : 'Failed to toggle status.',
      })
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-brand-50 border border-brand-200 text-brand-700 mt-1">
            <Users size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">User Management</h1>
              <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                RBAC ACCESS CONTROL
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Manage system users and access roles: <strong>Admin</strong> (full access & approval gate) and <strong>Employee</strong> (read-only; edits require Admin approval).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="flex items-center gap-1.5"
            title="Reload user accounts"
          >
            <RefreshCw size={15} className={refreshing || loading ? 'animate-spin text-brand-600' : ''} />
            Refresh
          </Button>
          <Button
            onClick={openCreateModal}
            className="flex items-center gap-2"
          >
            <UserPlus size={16} />
            Add New User
          </Button>
        </div>
      </div>

      {feedback && (
        <Alert
          message={feedback.message}
          type={feedback.type === 'error' ? 'error' : 'success'}
        />
      )}
      {contextError && <Alert message={contextError} />}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Users</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{users.length}</h3>
            </div>
            <div className="p-3 bg-slate-100 rounded-xl text-slate-600">
              <Users size={22} />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">All configured enterprise accounts</p>
        </Card>

        <Card className="p-4 border-indigo-200 bg-indigo-50/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Administrators</p>
              <h3 className="text-2xl font-bold text-indigo-950 mt-1">{adminCount}</h3>
            </div>
            <div className="p-3 bg-indigo-100 rounded-xl text-indigo-700">
              <Shield size={22} />
            </div>
          </div>
          <p className="text-[11px] text-indigo-700/80 mt-2">Full access & supervisor authorization</p>
        </Card>

        <Card className="p-4 border-amber-200 bg-amber-50/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Employees</p>
              <h3 className="text-2xl font-bold text-amber-950 mt-1">{employeeCount}</h3>
            </div>
            <div className="p-3 bg-amber-100 rounded-xl text-amber-700">
              <UserCheck size={22} />
            </div>
          </div>
          <p className="text-[11px] text-amber-800/80 mt-2">Read-only; edits require Admin approval</p>
        </Card>

        <Card className="p-4 border-emerald-200 bg-emerald-50/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Active Status</p>
              <h3 className="text-2xl font-bold text-emerald-950 mt-1">{activeCount}</h3>
            </div>
            <div className="p-3 bg-emerald-100 rounded-xl text-emerald-700">
              <CheckCircle2 size={22} />
            </div>
          </div>
          <p className="text-[11px] text-emerald-700/80 mt-2">Active logins available</p>
        </Card>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, username, role…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setRoleFilter('ALL')}
              className={`px-2.5 py-1 text-xs font-semibold rounded ${
                roleFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              All Roles
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('ADMIN')}
              className={`px-2.5 py-1 text-xs font-semibold rounded ${
                roleFilter === 'ADMIN' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Admins ({adminCount})
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('EMPLOYEE')}
              className={`px-2.5 py-1 text-xs font-semibold rounded ${
                roleFilter === 'EMPLOYEE' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Employees ({employeeCount})
            </button>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">User Details</th>
                <th className="py-3 px-4">Role & Access Type</th>
                <th className="py-3 px-4">Designation</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Operational Rights</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Loading users…
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No users matching criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrent = currentUser?.id === u.id
                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isCurrent ? 'bg-indigo-50/30' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full font-bold text-xs ${
                              u.role === 'ADMIN'
                                ? 'bg-indigo-100 text-indigo-700'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {u.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 font-bold text-slate-900">
                              {u.full_name}
                              {isCurrent && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 font-bold border border-indigo-200">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-slate-500">
                              @{u.username}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {u.role === 'ADMIN' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
                            <Shield size={12} />
                            Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                            <UserCheck size={12} />
                            Employee
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-700 font-medium">
                        {u.designation || <span className="text-slate-400">—</span>}
                      </td>

                      <td className="py-3 px-4 text-slate-600">
                        {u.email || <span className="text-slate-400">—</span>}
                      </td>

                      <td className="py-3 px-4">
                        {u.role === 'ADMIN' ? (
                          <span className="text-slate-700 text-[11px]">
                            <strong>Full Access:</strong> Read, Edit, Gate Authorization
                          </span>
                        ) : (
                          <span className="text-amber-800 text-[11px]">
                            <strong>Read-Only:</strong> Sensitive edits require Admin approval
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {u.is_active ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                            Inactive
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick persona switch button */}
                          <button
                            type="button"
                            onClick={() => switchUser(u.username)}
                            title={`Switch active persona to ${u.full_name}`}
                            className={`p-1.5 rounded hover:bg-slate-200 text-slate-600 ${
                              isCurrent ? 'text-indigo-600 font-bold' : ''
                            }`}
                          >
                            <ArrowRightLeft size={14} />
                          </button>

                          {/* Edit user button */}
                          <button
                            type="button"
                            onClick={() => openEditModal(u)}
                            title="Edit User"
                            className="p-1.5 rounded hover:bg-slate-200 text-slate-600"
                          >
                            <Edit2 size={14} />
                          </button>

                          {/* Toggle Active */}
                          <button
                            type="button"
                            onClick={() => handleToggleActive(u)}
                            title={u.is_active ? 'Deactivate User' : 'Activate User'}
                            className={`p-1.5 rounded hover:bg-slate-200 ${
                              u.is_active ? 'text-rose-600' : 'text-emerald-600'
                            }`}
                          >
                            {u.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add / Edit User Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingUser ? `Edit User: ${editingUser.full_name}` : 'Create New User'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && <Alert message={formError} />}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Rahul Sharma"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Email (Login ID) *
            </label>
            <input
              type="email"
              required
              placeholder="e.g. rahul@tradeswift.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <p className="text-[11px] text-slate-400 mt-0.5">Used as the user's primary login identifier.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              {editingUser ? 'Reset Password (Optional)' : 'Password *'}
            </label>
            <input
              type="password"
              required={!editingUser}
              placeholder={editingUser ? 'Leave blank to keep current password' : 'Enter account password (e.g. employee123)'}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            {!editingUser && (
              <p className="text-[11px] text-slate-400 mt-0.5">Password used to authenticate at login.</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Username (Optional)
            </label>
            <input
              type="text"
              disabled={!!editingUser}
              placeholder="e.g. rahul_ops (auto-derived from email if empty)"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-100 disabled:text-slate-500"
            />
            {editingUser && (
              <p className="text-[11px] text-slate-400 mt-0.5">Username cannot be changed after creation.</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Designation / Role Title
            </label>
            <input
              type="text"
              placeholder="e.g. Desk Trader / Accounts Executive"
              value={formData.designation}
              onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Access Role *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  formData.role === 'ADMIN'
                    ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="role"
                    value="ADMIN"
                    checked={formData.role === 'ADMIN'}
                    onChange={() => setFormData({ ...formData, role: 'ADMIN' })}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                    <Shield size={14} className="text-indigo-600" />
                    Admin
                  </div>
                </div>
                <p className="text-[11px] text-slate-600 mt-1 pl-5">
                  <strong>Full Access:</strong> Can edit and read anything. Approves or rejects supervisor gate requests.
                </p>
              </label>

              <label
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  formData.role === 'EMPLOYEE'
                    ? 'border-amber-500 bg-amber-50/50 ring-1 ring-amber-500'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="role"
                    value="EMPLOYEE"
                    checked={formData.role === 'EMPLOYEE'}
                    onChange={() => setFormData({ ...formData, role: 'EMPLOYEE' })}
                    className="text-amber-600 focus:ring-amber-500"
                  />
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                    <UserCheck size={14} className="text-amber-600" />
                    Employee
                  </div>
                </div>
                <p className="text-[11px] text-slate-600 mt-1 pl-5">
                  <strong>Read-Only Access:</strong> Edits to sensitive master records require approval from Admin.
                </p>
              </label>
            </div>
          </div>

          {editingUser && (
            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                Active User Account
              </label>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : editingUser ? 'Update User' : 'Create User'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
