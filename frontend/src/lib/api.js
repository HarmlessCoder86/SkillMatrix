const BASE = import.meta.env.VITE_API_URL || ''

let authToken = null

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`
  }
  const res = await fetch(`${BASE}${path}`, { ...options, headers })
  if (!res.ok) {
    if (res.status === 401 && !path.includes('/auth/login')) {
      localStorage.removeItem('skill-matrix-token')
      authToken = null
      window.location.href = '/login'
      throw new Error('Session expired')
    }
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `API error ${res.status}`)
  }
  const ct = res.headers.get('content-type')
  if (ct && ct.includes('text/csv')) return res.blob()
  return res.json()
}

export const api = {
  setToken: (token) => { authToken = token },

  // Auth
  login: (email, password) =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  getMe: () => request('/api/auth/me'),
  register: (data) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  getRegistrationOptions: () => request('/api/auth/registration-options'),

  // Categories & Departments
  getCategories: () => request('/api/categories'),
  getDepartments: () => request('/api/departments'),

  // Skills
  getSkills: () => request('/api/skills'),
  createSkill: (data) => request('/api/skills', { method: 'POST', body: JSON.stringify(data) }),
  updateSkill: (id, data) => request(`/api/skills/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSkill: (id) => request(`/api/skills/${id}`, { method: 'DELETE' }),

  // Skill Requirements
  getSkillRequirements: () => request('/api/skill-requirements'),
  updateSkillRequirements: (skillId, data) =>
    request(`/api/skills/${skillId}/requirements`, { method: 'PUT', body: JSON.stringify(data) }),

  // Role Requirements
  getRoleRequirements: () => request('/api/role-requirements'),
  updateRoleRequirement: (data) =>
    request('/api/role-requirements', { method: 'PUT', body: JSON.stringify(data) }),
  deleteRoleRequirement: (id) => request(`/api/role-requirements/${id}`, { method: 'DELETE' }),

  // Retrain Date
  setRetrainDate: (employeeId, skillId, date) =>
    request(`/api/assessments/${employeeId}/${skillId}/retrain-date`, {
      method: 'PUT', body: JSON.stringify({ retrain_due_date: date }),
    }),

  // Employee Roles (job titles)
  getEmployeeRoles: () => request('/api/employee-roles'),
  createEmployeeRole: (data) => request('/api/employee-roles', { method: 'POST', body: JSON.stringify(data) }),
  updateEmployeeRole: (id, data) => request(`/api/employee-roles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEmployeeRole: (id) => request(`/api/employee-roles/${id}`, { method: 'DELETE' }),

  // Employees
  getEmployees: (department, supervisorsOnly) => {
    const params = new URLSearchParams()
    if (department) params.set('department', department)
    if (supervisorsOnly) params.set('supervisors_only', 'true')
    const qs = params.toString()
    return request(`/api/employees${qs ? `?${qs}` : ''}`)
  },
  createEmployee: (data) => request('/api/employees', { method: 'POST', body: JSON.stringify(data) }),
  deleteEmployee: (id) => request(`/api/employees/${id}`, { method: 'DELETE' }),

  // Matrix
  getMatrix: (params = {}) => {
    const qs = new URLSearchParams()
    if (params.department) qs.set('department', params.department)
    if (params.category_id) qs.set('category_id', params.category_id)
    const q = qs.toString()
    return request(`/api/matrix${q ? `?${q}` : ''}`)
  },

  // Assessments
  updateAssessment: (employeeId, skillId, data) =>
    request(`/api/assessments/${employeeId}/${skillId}`, {
      method: 'PUT', body: JSON.stringify(data),
    }),
  getAssessmentDetail: (employeeId, skillId) =>
    request(`/api/assessments/${employeeId}/${skillId}`),

  // Confirmation
  getConfirmationQueue: () => request('/api/confirmation-queue'),
  confirmAssessment: (id) =>
    request(`/api/assessments/${id}/confirm`, { method: 'PUT', body: JSON.stringify({}) }),
  rejectAssessment: (id) =>
    request(`/api/assessments/${id}/reject`, { method: 'PUT', body: JSON.stringify({}) }),

  // Teams
  getTeams: () => request('/api/teams'),

  // Users (Admin)
  getUsers: () => request('/api/users'),
  createUser: (data) => request('/api/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id, data) => request(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deactivateUser: (id) => request(`/api/users/${id}/deactivate`, { method: 'PUT' }),
  changePassword: (id, password) =>
    request(`/api/users/${id}/password`, { method: 'PUT', body: JSON.stringify({ password }) }),
  getArchivedUsers: () => request('/api/users/archived'),
  reactivateUser: (id) => request(`/api/users/${id}/reactivate`, { method: 'PUT' }),

  // Assignments
  getAssignments: () => request('/api/assignments'),
  createAssignment: (data) => request('/api/assignments', { method: 'POST', body: JSON.stringify(data) }),
  deleteAssignment: (id) => request(`/api/assignments/${id}`, { method: 'DELETE' }),

  // Dashboard
  getDashboard: () => request('/api/dashboard'),

  // Employee Profile
  getEmployeeProfile: (id) => request(`/api/employees/${id}/profile`),

  // Talent Search
  talentSearch: (skillId, minLevel) =>
    request(`/api/talent-search?skill_id=${skillId}&min_level=${minLevel}`),

  // Matrix Export
  exportMatrix: (params = {}) => {
    const qs = new URLSearchParams()
    if (params.department) qs.set('department', params.department)
    if (params.category_id) qs.set('category_id', params.category_id)
    const q = qs.toString()
    return request(`/api/matrix/export${q ? `?${q}` : ''}`)
  },

  // Activity Log
  getActivityLog: (params = {}) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v) })
    const q = qs.toString()
    return request(`/api/activity-log${q ? `?${q}` : ''}`)
  },
  exportActivityLog: (params = {}) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v) })
    const q = qs.toString()
    return request(`/api/activity-log/export${q ? `?${q}` : ''}`)
  },
}
