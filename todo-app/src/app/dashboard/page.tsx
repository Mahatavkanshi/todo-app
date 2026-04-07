'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

type Task = {
  id: string
  title: string
  is_complete: boolean
  category?: TaskCategory | null
  priority?: TaskPriority | null
  due_date?: string | null
  created_at?: string
}

type TaskCategory = 'personal' | 'groceries' | 'study' | 'travelling' | 'other'
type TaskPriority = 'low' | 'medium' | 'high'
type CompletionFilter = 'all' | 'completed' | 'pending'

const CATEGORY_OPTIONS: Array<{ value: TaskCategory; label: string; icon: string }> = [
  { value: 'personal', label: 'Personal', icon: '🙂' },
  { value: 'groceries', label: 'Groceries', icon: '🛒' },
  { value: 'study', label: 'Study', icon: '📘' },
  { value: 'travelling', label: 'Travelling', icon: '✈️' },
  { value: 'other', label: 'Other', icon: '🗂️' },
]

const PRIORITY_OPTIONS: Array<{ value: TaskPriority; label: string; icon: string }> = [
  { value: 'high', label: 'High', icon: '🔴' },
  { value: 'medium', label: 'Medium', icon: '🟡' },
  { value: 'low', label: 'Low', icon: '🟢' },
]

const getTodayDateString = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const isPastDate = (dateStr: string) => dateStr < getTodayDateString()

const getTaskDate = (task: Task) => (task.created_at ? task.created_at.split('T')[0] : '')

const isTaskReadOnly = (task: Task) => {
  const dateStr = getTaskDate(task)
  return !!dateStr && isPastDate(dateStr)
}

const formatTaskDate = (dateStr: string) => {
  if (!dateStr) return 'No date'
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const getCategoryMeta = (category: Task['category']) =>
  CATEGORY_OPTIONS.find((item) => item.value === category) ??
  CATEGORY_OPTIONS.find((item) => item.value === 'other')!

const getPriorityMeta = (priority: Task['priority']) =>
  PRIORITY_OPTIONS.find((item) => item.value === priority) ??
  PRIORITY_OPTIONS.find((item) => item.value === 'medium')!

const getDueDateOnly = (dueDate: Task['due_date']) => (dueDate ? dueDate.split('T')[0] : '')

const getTaskDueDateOnly = (task: Task) => getDueDateOnly(task.due_date) || getTaskDate(task)

const isTaskOverdue = (task: Task) => {
  const due = getDueDateOnly(task.due_date)
  return !!due && due < getTodayDateString() && !task.is_complete
}

const isMissingTaskColumnError = (error: unknown) => {
  const message = typeof error === 'object' && error !== null && 'message' in error
    ? String((error as { message?: string }).message)
    : ''
  return /column/i.test(message) && /(category|priority|due_date)/i.test(message)
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTask, setNewTask] = useState('')
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const [calendarDate, setCalendarDate] = useState(() => getTodayDateString())
  const [activeDate, setActiveDate] = useState<string | null>(null)
  const [isHistoryView, setIsHistoryView] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [editingCategory, setEditingCategory] = useState<TaskCategory>('other')
  const [editingPriority, setEditingPriority] = useState<TaskPriority>('medium')
  const [editingDueDate, setEditingDueDate] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<TaskCategory>('personal')
  const [selectedPriority, setSelectedPriority] = useState<TaskPriority>('medium')
  const [newDueDate, setNewDueDate] = useState('')
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [popupMessage, setPopupMessage] = useState<string | null>(null)

  const visibleTasks = tasks
    .filter((task) => {
      if (completionFilter === 'completed') return task.is_complete
      if (completionFilter === 'pending') return !task.is_complete
      return true
    })
    .filter((task) => task.title.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    .sort((a, b) => {
      const dueA = getDueDateOnly(a.due_date)
      const dueB = getDueDateOnly(b.due_date)
      const dueTimeA = dueA ? new Date(`${dueA}T00:00:00`).getTime() : Number.POSITIVE_INFINITY
      const dueTimeB = dueB ? new Date(`${dueB}T00:00:00`).getTime() : Number.POSITIVE_INFINITY
      if (dueTimeA !== dueTimeB) return dueTimeA - dueTimeB

      const createdA = a.created_at ? new Date(a.created_at).getTime() : 0
      const createdB = b.created_at ? new Date(b.created_at).getTime() : 0
      return createdB - createdA
    })

  const showNotice = (message: string) => {
    setNotice(message)
    setTimeout(() => setNotice(null), 1600)
  }

  const showPopup = (message: string) => {
    setPopupMessage(message)
  }

  const closePopup = () => {
    setPopupMessage(null)
  }

  // 📥 Fetch tasks
  const fetchTasks = useCallback(async (
    userId: string,
    dateFilter?: string | null,
    includePast = false
  ) => {
    let query = supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (dateFilter) {
      const dayStart = new Date(`${dateFilter}T00:00:00`)
      const dayEnd = new Date(`${dateFilter}T23:59:59.999`)
      query = query
        .gte('created_at', dayStart.toISOString())
        .lte('created_at', dayEnd.toISOString())
    } else if (!includePast) {
      const todayStart = new Date(`${getTodayDateString()}T00:00:00`)
      query = query.gte('created_at', todayStart.toISOString())
    }

    const { data, error } = await query

    if (error) {
      console.error(error)
    } else {
      setTasks(data as Task[])
    }
  }, [])

  // 🔐 Check user + fetch tasks
  useEffect(() => {
    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getUser()

        if (error || !data.user) {
          router.push('/login')
          return
        }

        setUser(data.user)
        await fetchTasks(data.user.id)
        setLoading(false)
      } catch {
        router.push('/login')
      }
    }

    init()
  }, [fetchTasks, router])

  // ➕ Add task
  const addTask = async () => {
    if (!newTask.trim() || !user) return

    const selectedDate = activeDate ?? calendarDate
    if (selectedDate && isPastDate(selectedDate)) {
      const msg = 'Cannot add task to a previous date. Past dates are history-only.'
      showNotice(msg)
      showPopup(msg)
      return
    }

    const targetDate = activeDate ?? getTodayDateString()
    if (isPastDate(targetDate)) {
      const msg = 'Cannot add task to a previous date. Past dates are history-only.'
      showNotice(msg)
      showPopup(msg)
      return
    }

    let { error } = await supabase.from('tasks').insert([
      {
        title: newTask,
        user_id: user.id,
        category: selectedCategory,
        priority: selectedPriority,
        due_date: newDueDate ? `${newDueDate}T23:59:59.999Z` : null,
        created_at: `${targetDate}T12:00:00.000Z`,
      },
    ])

    if (error && isMissingTaskColumnError(error)) {
      const retry = await supabase.from('tasks').insert([
        {
          title: newTask,
          user_id: user.id,
          created_at: `${targetDate}T12:00:00.000Z`,
        },
      ])
      error = retry.error
      if (!retry.error) {
        showNotice('Task added. Add category/priority/due_date columns in DB to save full metadata.')
      }
    }

    if (error) {
      console.error(error)
    } else {
      setNewTask('')
      setNewDueDate('')
      setSelectedPriority('medium')
      fetchTasks(user.id, activeDate)
      showNotice('Task added')
    }
  }

  // ❌ Delete task
  const deleteTask = async (id: string) => {
    const task = tasks.find((item) => item.id === id)
    if (task && isTaskReadOnly(task)) {
      showNotice('Past-date tasks are read only')
      return
    }

    await supabase.from('tasks').delete().eq('id', id)
    fetchTasks(user.id, activeDate)
    showNotice('Task deleted')
  }

  // 🔄 Toggle complete
  const toggleTask = async (task: Task) => {
    if (isTaskReadOnly(task)) {
      showNotice('Past-date tasks are read only')
      return
    }

    await supabase
      .from('tasks')
      .update({ is_complete: !task.is_complete })
      .eq('id', task.id)

    fetchTasks(user.id, activeDate)
    showNotice(task.is_complete ? 'Marked as active' : 'Marked as complete')
  }

  const startEditTask = (task: Task) => {
    if (isTaskReadOnly(task)) {
      showNotice('Past-date tasks are read only')
      return
    }

    setEditingTaskId(task.id)
    setEditingTitle(task.title)
    setEditingCategory(task.category ?? 'other')
    setEditingPriority(task.priority ?? 'medium')
    setEditingDueDate(getDueDateOnly(task.due_date))
  }

  const cancelEditTask = () => {
    setEditingTaskId(null)
    setEditingTitle('')
    setEditingCategory('other')
    setEditingPriority('medium')
    setEditingDueDate('')
  }

  const updateTask = async (taskId: string) => {
    if (!editingTitle.trim()) {
      showNotice('Task title cannot be empty')
      return
    }

    const task = tasks.find((item) => item.id === taskId)
    if (!task) return

    if (isTaskReadOnly(task)) {
      showNotice('You cannot edit a task from a previous date')
      return
    }

    let { error } = await supabase
      .from('tasks')
      .update({
        title: editingTitle.trim(),
        category: editingCategory,
        priority: editingPriority,
        due_date: editingDueDate ? `${editingDueDate}T23:59:59.999Z` : null,
      })
      .eq('id', taskId)

    if (error && isMissingTaskColumnError(error)) {
      const retry = await supabase
        .from('tasks')
        .update({ title: editingTitle.trim() })
        .eq('id', taskId)
      error = retry.error
      if (!retry.error) {
        showNotice('Task updated. Add category/priority/due_date columns in DB to save full metadata.')
      }
    }

    if (error) {
      console.error(error)
      showNotice('Could not update task')
      return
    }

    await fetchTasks(user.id, activeDate)
    setEditingTaskId(null)
    setEditingTitle('')
    setEditingCategory('other')
    setEditingPriority('medium')
    setEditingDueDate('')
    showNotice('Task updated')
  }

  const applyDateFilter = async () => {
    if (!user) return

    if (isPastDate(calendarDate)) {
      setActiveDate(calendarDate)
      setIsHistoryView(true)
      await fetchTasks(user.id, calendarDate, true)
      const msg = 'Past date selected. History only: you cannot add or edit tasks for previous dates.'
      showNotice(msg)
      showPopup(msg)
      return
    }

    setActiveDate(calendarDate)
    setIsHistoryView(false)
    await fetchTasks(user.id, calendarDate)
    showNotice(`Showing tasks for ${calendarDate}`)
  }

  const viewOldTasks = async () => {
    if (!user) return

    if (!isPastDate(calendarDate)) {
      showNotice('Pick a previous date to use View Old Tasks')
      return
    }

    setActiveDate(calendarDate)
    setIsHistoryView(true)
    await fetchTasks(user.id, calendarDate, true)
    showNotice(`Viewing old tasks for ${calendarDate}`)
  }

  const clearDateFilter = async () => {
    if (!user) return
    setActiveDate(null)
    setIsHistoryView(false)
    await fetchTasks(user.id)
    showNotice('Showing today and upcoming tasks')
  }

  // 🚪 Logout
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="app-shell flex items-center justify-center">
        <div className="glass-panel px-6 py-4 text-sm text-slate-700">Loading your workspace...</div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <div className="mx-auto max-w-4xl space-y-5 fade-up">
        <div className="glass-panel glass-panel-strong p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Dashboard</p>
              <h1 className="mt-1 text-3xl">Your Tasks</h1>
              <p className="mt-1 text-sm text-slate-600">
                Signed in as <span className="font-medium text-slate-800">{user?.email}</span>
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="btn btn-danger w-full sm:w-auto"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="glass-panel p-4 sm:p-5">
          <p className="mb-3 text-sm font-semibold text-slate-700">Calendar filter</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="date"
              value={calendarDate}
              onChange={(e) => setCalendarDate(e.target.value)}
              className="soft-input sm:max-w-52"
            />
            <button
              onClick={applyDateFilter}
              className="btn btn-secondary sm:min-w-28"
            >
              Set Date
            </button>
            <button
              onClick={viewOldTasks}
              className="btn sm:min-w-32 border border-slate-300 bg-white/80 text-slate-700"
            >
              View Old Tasks
            </button>
            <button
              onClick={clearDateFilter}
              className="btn sm:min-w-28 border border-slate-300 bg-white/80 text-slate-700"
            >
              Clear
            </button>
          </div>
          {activeDate && (
            <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              Active date: {activeDate} {isHistoryView ? '(history mode)' : ''}
            </p>
          )}
          <p className="mt-2 text-xs text-slate-500">
            Only today and upcoming dates are editable. Use View Old Tasks for history.
          </p>
        </div>

        <div className="glass-panel p-4 sm:p-5">
          <p className="mb-3 text-sm font-semibold text-slate-700">Add a new task</p>
          {notice && <p className="surface-note mb-3 stagger-pop">{notice}</p>}
          <div className="mb-3 grid gap-3 md:grid-cols-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Category</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSelectedCategory(option.value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    selectedCategory === option.value
                      ? 'border-slate-700 bg-slate-700 text-white'
                      : 'border-slate-300 bg-white/80 text-slate-700 hover:bg-white'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span>{option.icon}</span>
                    <span>{option.label}</span>
                  </span>
                </button>
              ))}
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Priority</p>
              <div className="flex flex-wrap gap-2">
                {PRIORITY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSelectedPriority(option.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      selectedPriority === option.value
                        ? 'border-slate-700 bg-slate-700 text-white'
                        : 'border-slate-300 bg-white/80 text-slate-700 hover:bg-white'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <span>{option.icon}</span>
                      <span>{option.label}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Due date</p>
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="soft-input"
                disabled={isPastDate(calendarDate) || (!!activeDate && isPastDate(activeDate))}
              />
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              disabled={isPastDate(calendarDate) || (!!activeDate && isPastDate(activeDate))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  addTask()
                }
              }}
              placeholder="Enter new task..."
              className="soft-input flex-1"
            />
            <button
              onClick={addTask}
              disabled={isPastDate(calendarDate) || (!!activeDate && isPastDate(activeDate))}
              className="btn btn-primary sm:min-w-28"
            >
              Add Task
            </button>
          </div>
          {(isPastDate(calendarDate) || (!!activeDate && isPastDate(activeDate))) && (
            <p className="mt-2 text-xs text-slate-500">Past dates are read only.</p>
          )}
        </div>

        <div className="glass-panel p-4 sm:p-5">
          <p className="mb-3 text-sm font-semibold text-slate-700">Task controls</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {(['all', 'completed', 'pending'] as CompletionFilter[]).map((item) => (
                <button
                  key={item}
                  onClick={() => setCompletionFilter(item)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-widest transition ${
                    completionFilter === item
                      ? 'border-slate-700 bg-slate-700 text-white'
                      : 'border-slate-300 bg-white/80 text-slate-700 hover:bg-white'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="soft-input sm:max-w-xs"
            />
          </div>
        </div>

        <div className="space-y-3">
          {visibleTasks.length === 0 && (
            <div className="glass-panel p-6 text-center text-sm text-slate-600">
              No tasks match this filter.
            </div>
          )}

          {visibleTasks.map((task, index) => (
            <div
              key={task.id}
              className={`task-item stagger-in flex items-center justify-between gap-4 ${
                isTaskOverdue(task) ? 'border-red-200 bg-red-50/70' : ''
              }`}
              style={{ animationDelay: `${Math.min(index * 55, 280)}ms` }}
            >
              <div className="flex-1">
                {editingTaskId === task.id ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      className="soft-input"
                    />
                    <select
                      value={editingCategory}
                      onChange={(e) => setEditingCategory(e.target.value as TaskCategory)}
                      className="soft-input sm:max-w-44"
                    >
                      {CATEGORY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={editingPriority}
                      onChange={(e) => setEditingPriority(e.target.value as TaskPriority)}
                      className="soft-input sm:max-w-36"
                    >
                      {PRIORITY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      value={editingDueDate}
                      onChange={(e) => setEditingDueDate(e.target.value)}
                      className="soft-input sm:max-w-44"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateTask(task.id)}
                        className="btn btn-secondary"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEditTask}
                        className="btn border border-slate-300 bg-white/80 text-slate-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={task.is_complete}
                      onChange={() => toggleTask(task)}
                      disabled={isTaskReadOnly(task)}
                      className="mt-1 h-4 w-4 cursor-pointer rounded border-slate-300 text-teal-700"
                    />
                    <span
                      className={`inline-flex items-center gap-2 text-sm sm:text-base ${
                        task.is_complete ? 'text-slate-500' : 'text-slate-800'
                      }`}
                    >
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          task.is_complete ? 'bg-emerald-500' : 'bg-slate-300'
                        }`}
                      />
                      {task.title}
                    </span>
                  </div>
                )}
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                  <span>Date: {formatTaskDate(getTaskDate(task))}</span>
                  <span className={`rounded-full border px-2 py-0.5 font-medium ${
                    isTaskOverdue(task)
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}>
                    Due: {formatTaskDate(getTaskDueDateOnly(task))}
                  </span>
                  <span className={`rounded-full border px-2 py-0.5 font-medium ${
                    task.priority === 'high'
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : task.priority === 'medium'
                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  }`}>
                    {getPriorityMeta(task.priority).icon} {getPriorityMeta(task.priority).label}
                  </span>
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 font-medium text-sky-700">
                    {getCategoryMeta(task.category).icon} {getCategoryMeta(task.category).label}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => startEditTask(task)}
                  className="rounded-lg border border-slate-300 bg-white/80 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-white"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteTask(task.id)}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-100"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {popupMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-popup-title"
            className="glass-panel glass-panel-strong w-full max-w-md p-5 sm:p-6"
          >
            <p
              id="dashboard-popup-title"
              className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500"
            >
              Action blocked
            </p>
            <p className="mt-2 text-sm text-slate-700">{popupMessage}</p>
            <div className="mt-5 flex justify-end">
              <button
                onClick={closePopup}
                className="btn btn-secondary sm:min-w-24"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}