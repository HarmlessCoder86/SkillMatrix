import React, { useState, useMemo } from 'react'

/**
 * Collapsible skill tree sidebar.
 * Builds a tree from flat skill list using parent_skill_id references.
 *
 * Props:
 *   skills       flat array of { id, category_id, parent_skill_id, name, category_name, sort_order }
 *   categories   array of { id, name, sort_order }
 *   onAddSkill   (categoryId, parentId) => void
 */

function TreeNode({ node, depth, collapsed, onToggle }) {
  const hasChildren = node.children && node.children.length > 0
  const isCollapsed = collapsed.has(node.id)
  const isLeaf = !hasChildren
  const indent = depth * 20

  return (
    <>
      <div
        className={`flex items-center gap-1 py-1 px-2 hover:bg-gray-100 text-sm cursor-default select-none ${
          isLeaf ? 'text-gray-700' : 'font-medium text-gray-800'
        }`}
        style={{ paddingLeft: `${indent + 8}px` }}
        data-skill-id={node.id}
      >
        {hasChildren ? (
          <button
            onClick={() => onToggle(node.id)}
            className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600"
          >
            {isCollapsed ? '▶' : '▼'}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <span className="truncate">{node.name}</span>
      </div>

      {hasChildren && !isCollapsed &&
        node.children.map((child) => (
          <TreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            collapsed={collapsed}
            onToggle={onToggle}
          />
        ))}
    </>
  )
}

export default function SkillTree({ skills, categories }) {
  const [collapsed, setCollapsed] = useState(new Set())

  const toggle = (id) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Build tree grouped by category
  const tree = useMemo(() => {
    if (!skills || !categories) return []

    // Index skills by id
    const byId = {}
    skills.forEach((s) => (byId[s.id] = { ...s, children: [] }))

    // Build parent-child relationships
    const roots = {} // category_id → top-level skills
    skills.forEach((s) => {
      if (s.parent_skill_id && byId[s.parent_skill_id]) {
        byId[s.parent_skill_id].children.push(byId[s.id])
      } else {
        if (!roots[s.category_id]) roots[s.category_id] = []
        roots[s.category_id].push(byId[s.id])
      }
    })

    // Sort children
    Object.values(byId).forEach((node) => {
      node.children.sort((a, b) => a.sort_order - b.sort_order)
    })

    return categories
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((cat) => ({
        ...cat,
        skills: (roots[cat.id] || []).sort((a, b) => a.sort_order - b.sort_order),
      }))
  }, [skills, categories])

  return (
    <div className="w-64 min-w-[256px] border-r border-gray-200 bg-white overflow-y-auto">
      <div className="p-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Skills</h2>
      </div>
      {tree.map((cat) => (
        <div key={cat.id}>
          <button
            onClick={() => toggle(`cat-${cat.id}`)}
            className="w-full flex items-center gap-1 px-3 py-2 text-sm font-semibold text-gray-900 bg-gray-50 hover:bg-gray-100 border-b border-gray-200"
          >
            <span className="w-4 h-4 flex items-center justify-center text-gray-400">
              {collapsed.has(`cat-${cat.id}`) ? '▶' : '▼'}
            </span>
            {cat.name}
          </button>
          {!collapsed.has(`cat-${cat.id}`) &&
            cat.skills.map((skill) => (
              <TreeNode
                key={skill.id}
                node={skill}
                depth={0}
                collapsed={collapsed}
                onToggle={toggle}
              />
            ))}
        </div>
      ))}
    </div>
  )
}
