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
      const { data, error } = await supabase.auth.getUser()

      if (error || !data.user) {
        router.push('/login')
        return
      }

      setUser(data.user)
      await fetchTasks(data.user.id)
      setLoading(false)
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

  if (loading) return <p className="p-6">Loading...</p>

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="mb-6 flex justify-between">
        <h1 className="text-2xl font-bold">Your Tasks</h1>

        <button
          onClick={handleLogout}
          className="rounded bg-red-500 px-4 py-2 text-white"
        >
          Logout
        </button>
      </div>

      {/* ➕ Add Task */}
      <div className="mb-6 flex gap-2">
        <input
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          placeholder="Enter new task..."
          className="flex-1 rounded border p-2 text-black"
        />
        <button
          onClick={addTask}
          className="rounded bg-blue-600 px-4 py-2 text-white"
        >
          Add
        </button>
      </div>

      {/* 📋 Task List */}
      <div className="space-y-3">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center justify-between rounded bg-white p-4 shadow"
          >
            <div
              onClick={() => toggleTask(task)}
              className={`cursor-pointer ${
                task.is_complete ? 'line-through text-gray-400' : ''
              }`}
            >
              {task.title}
            </div>

            <button
              onClick={() => deleteTask(task.id)}
              className="text-red-500"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}