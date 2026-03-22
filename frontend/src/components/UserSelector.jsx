import React from 'react'

/**
 * "Acting as" dropdown — selects which employee the current user is acting as.
 * This drives the confirmation workflow (manager vs self-assessment).
 *
 * Props:
 *   employees       array of { id, first_name, last_name, role, department }
 *   currentUserId   currently selected employee id
 *   onChange         (employeeId) => void
 */
export default function UserSelector({ employees, currentUserId, onChange }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <label htmlFor="acting-as" className="text-gray-500 whitespace-nowrap">
        Acting as:
      </label>
      <select
        id="acting-as"
        value={currentUserId || ''}
        onChange={(e) => onChange(Number(e.target.value))}
        className="border border-gray-300 rounded-md px-2 py-1 text-sm bg-white focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
      >
        <option value="">Select user...</option>
        {employees.map((emp) => (
          <option key={emp.id} value={emp.id}>
            {emp.first_name} {emp.last_name} — {emp.role}
          </option>
        ))}
      </select>
    </div>
  )
}
