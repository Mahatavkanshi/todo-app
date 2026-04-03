'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useRouter } from 'next/navigation'

type Task = {
  id: string
  title: string
  is_complete: boolean
  created_at?: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTask, setNewTask] = useState('')
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const [calendarDate, setCalendarDate] = useState(
    () => new Date().toISOString().split('T')[0]
  )
  const [activeDate, setActiveDate] = useState<string | null>(null)

  const showNotice = (message: string) => {
    setNotice(message)
    setTimeout(() => setNotice(null), 1600)
  }

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
  }, [router])

  // 📥 Fetch tasks
  const fetchTasks = async (userId: string, dateFilter?: string | null) => {
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
    }

    const { data, error } = await query

    if (error) {
      console.error(error)
    } else {
      setTasks(data as Task[])
    }
  }

  // ➕ Add task
  const addTask = async () => {
    if (!newTask.trim()) return

    const { error } = await supabase.from('tasks').insert([
      {
        title: newTask,
        user_id: user.id,
      },
    ])

    if (error) {
      console.error(error)
    } else {
      setNewTask('')
      fetchTasks(user.id, activeDate)
      showNotice('Task added')
    }
  }

  // ❌ Delete task
  const deleteTask = async (id: string) => {
    await supabase.from('tasks').delete().eq('id', id)
    fetchTasks(user.id, activeDate)
    showNotice('Task deleted')
  }

  // 🔄 Toggle complete
  const toggleTask = async (task: Task) => {
    await supabase
      .from('tasks')
      .update({ is_complete: !task.is_complete })
      .eq('id', task.id)

    fetchTasks(user.id, activeDate)
    showNotice(task.is_complete ? 'Marked as active' : 'Marked as complete')
  }

  const applyDateFilter = async () => {
    if (!user) return
    setActiveDate(calendarDate)
    await fetchTasks(user.id, calendarDate)
    showNotice(`Showing tasks for ${calendarDate}`)
  }

  const clearDateFilter = async () => {
    if (!user) return
    setActiveDate(null)
    await fetchTasks(user.id)
    showNotice('Showing all dates')
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
              onClick={clearDateFilter}
              className="btn sm:min-w-28 border border-slate-300 bg-white/80 text-slate-700"
            >
              Clear
            </button>
          </div>
          {activeDate && (
            <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              Active date: {activeDate}
            </p>
          )}
        </div>

        <div className="glass-panel p-4 sm:p-5">
          <p className="mb-3 text-sm font-semibold text-slate-700">Add a new task</p>
          {notice && <p className="surface-note mb-3 stagger-pop">{notice}</p>}
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
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
              className="btn btn-primary sm:min-w-28"
            >
              Add Task
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {tasks.length === 0 && (
            <div className="glass-panel p-6 text-center text-sm text-slate-600">
              Your list is clear. Add your first task to get started.
            </div>
          )}

          {tasks.map((task, index) => (
            <div
              key={task.id}
              className="task-item stagger-in flex items-center justify-between gap-4"
              style={{ animationDelay: `${Math.min(index * 55, 280)}ms` }}
            >
              <button
                onClick={() => toggleTask(task)}
                className={`task-text-btn text-left text-sm sm:text-base ${
                  task.is_complete ? 'line-through text-slate-400' : 'text-slate-800'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      task.is_complete ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  />
                  {task.title}
                </span>
              </button>

              <button
                onClick={() => deleteTask(task.id)}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-100"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}