import React from 'react'

/**
 * Filter/search bar for skills and departments.
 *
 * Props:
 *   categories         array of { id, name }
 *   selectedCategory   current category id or null
 *   onCategoryChange   (categoryId | null) => void
 *   searchTerm         current search string
 *   onSearchChange     (term) => void
 */
export default function FilterBar({
  categories,
  selectedCategory,
  onCategoryChange,
  searchTerm,
  onSearchChange,
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-white border-b border-gray-200">
      <div className="flex items-center gap-2">
        <label htmlFor="dept-filter" className="text-sm text-gray-500">
          Department:
        </label>
        <select
          id="dept-filter"
          value={selectedCategory ?? ''}
          onChange={(e) => onCategoryChange(e.target.value ? Number(e.target.value) : null)}
          className="border border-gray-300 rounded-md px-2 py-1 text-sm bg-white focus:ring-2 focus:ring-blue-400"
        >
          <option value="">All Departments</option>
          {categories?.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2 flex-1 max-w-xs">
        <label htmlFor="skill-search" className="text-sm text-gray-500">
          Search:
        </label>
        <input
          id="skill-search"
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Filter skills..."
          className="border border-gray-300 rounded-md px-2 py-1 text-sm w-full focus:ring-2 focus:ring-blue-400"
        />
      </div>
    </div>
  )
}
