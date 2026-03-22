import React from 'react'
import HarveyBall from './HarveyBall'

/**
 * Compact inline level picker — shows 5 Harvey balls (L0–L4) in a row.
 * Appears as a popover when a cell is clicked.
 *
 * Props:
 *   currentLevel   current assessment level
 *   onSelect       (level) => void
 *   onClose        () => void
 */
export default function LevelPicker({ currentLevel, onSelect, onClose }) {
  const levels = [0, 1, 2, 3, 4]
  const labels = ['Untrained', 'Training Received', 'Minimal Supervision', 'Independent', 'Mastery']

  return (
    <div
      className="absolute z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-2 flex gap-1 items-center"
      onMouseLeave={onClose}
    >
      {levels.map((lvl) => (
        <button
          key={lvl}
          onClick={(e) => {
            e.stopPropagation()
            onSelect(lvl)
          }}
          className={`p-1 rounded hover:bg-gray-100 transition-colors ${
            lvl === currentLevel ? 'ring-2 ring-blue-400 bg-blue-50' : ''
          }`}
          title={`${labels[lvl]} (Level ${lvl})`}
        >
          <HarveyBall level={lvl} size={24} />
        </button>
      ))}
    </div>
  )
}
