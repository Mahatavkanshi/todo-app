'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useRouter } from 'next/navigation'

type Task = {
  id: string
  title: string
  is_complete: boolean
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTask, setNewTask] = useState('')
  const [loading, setLoading] = useState(true)

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
  const fetchTasks = async (userId: string) => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

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
      fetchTasks(user.id)
    }
  }

  // ❌ Delete task
  const deleteTask = async (id: string) => {
    await supabase.from('tasks').delete().eq('id', id)
    fetchTasks(user.id)
  }

  // 🔄 Toggle complete
  const toggleTask = async (task: Task) => {
    await supabase
      .from('tasks')
      .update({ is_complete: !task.is_complete })
      .eq('id', task.id)

    fetchTasks(user.id)
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
          <p className="mb-3 text-sm font-semibold text-slate-700">Add a new task</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
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

          {tasks.map((task) => (
            <div
              key={task.id}
              className="task-item flex items-center justify-between gap-4"
            >
              <button
                onClick={() => toggleTask(task)}
                className={`text-left text-sm sm:text-base ${{
                  true: 'line-through text-slate-400',
                  false: 'text-slate-800',
                }[String(task.is_complete) as 'true' | 'false']}`}
              >
                {task.title}
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