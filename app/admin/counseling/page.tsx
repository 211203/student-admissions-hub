'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { formatDate } from '@/lib/utils'
import { CalendarDays, Clock, User, CheckCircle, X, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

interface CounselingSession {
  id: string
  student_id: string
  student_name: string
  student_email: string
  scheduled_date: string
  scheduled_time: string
  status: 'scheduled' | 'completed' | 'cancelled'
  notes: string
  admin_notes: string
  created_at: string
}

const STATUS_TABS = ['all', 'scheduled', 'completed', 'cancelled'] as const

export default function CounselingPage() {
  const [sessions, setSessions] = useState<CounselingSession[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<typeof STATUS_TABS[number]>('all')
  const [updating, setUpdating] = useState<string | null>(null)

  const fetchSessions = async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase.from('counseling_sessions').select('*').order('scheduled_date', { ascending: true })
    if (activeTab !== 'all') query = query.eq('status', activeTab)
    const { data } = await query
    setSessions(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchSessions() }, [activeTab])

  const updateStatus = async (sessionId: string, status: 'completed' | 'cancelled') => {
    setUpdating(sessionId)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('counseling_sessions')
        .update({ status })
        .eq('id', sessionId)
      if (error) throw error
      toast.success(`Session marked as ${status}`)
      fetchSessions()
    } catch {
      toast.error('Failed to update session')
    } finally {
      setUpdating(null)
    }
  }

  const counts = {
    all: sessions.length,
    scheduled: sessions.filter(s => s.status === 'scheduled').length,
    completed: sessions.filter(s => s.status === 'completed').length,
    cancelled: sessions.filter(s => s.status === 'cancelled').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center">
            <CalendarDays className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Counseling Sessions</h1>
            <p className="text-slate-400 text-sm">Manage all scheduled counseling meetings</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchSessions} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-slate-800/50 rounded-xl border border-slate-700/50 w-fit">
        {STATUS_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all duration-200 ${
              activeTab === tab
                ? 'bg-slate-700 text-white shadow'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Scheduled', count: counts.scheduled, color: 'from-blue-600 to-cyan-600', icon: Clock },
          { label: 'Completed', count: counts.completed, color: 'from-emerald-600 to-green-600', icon: CheckCircle },
          { label: 'Cancelled', count: counts.cancelled, color: 'from-red-600 to-rose-600', icon: X },
        ].map(({ label, count, color, icon: Icon }) => (
          <Card key={label} className="flex items-center gap-4">
            <div className={`w-10 h-10 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center shrink-0`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{count}</p>
              <p className="text-slate-400 text-xs">{label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Sessions Table */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700/50">
              <tr>
                {['Student', 'Date', 'Time', 'Status', 'Notes', 'Actions'].map(col => (
                  <th key={col} className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <Spinner />
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    No counseling sessions found
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {session.student_name?.charAt(0)?.toUpperCase() || <User className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="text-white font-medium text-sm whitespace-nowrap">{session.student_name || 'Unknown'}</p>
                          <p className="text-slate-400 text-xs">{session.student_email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-slate-300 text-sm whitespace-nowrap">{formatDate(session.scheduled_date)}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-slate-300 text-sm whitespace-nowrap flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-400" />
                        {session.scheduled_time}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant="status" status={session.status}>{session.status}</Badge>
                    </td>
                    <td className="px-5 py-4 max-w-[200px]">
                      <p className="text-slate-400 text-xs truncate">{session.notes || '—'}</p>
                    </td>
                    <td className="px-5 py-4">
                      {session.status === 'scheduled' && (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            loading={updating === session.id}
                            onClick={() => updateStatus(session.id, 'completed')}
                            className="gap-1 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 text-xs"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            Complete
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            loading={updating === session.id}
                            onClick={() => updateStatus(session.id, 'cancelled')}
                            className="gap-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs"
                          >
                            <X className="h-3.5 w-3.5" />
                            Cancel
                          </Button>
                        </div>
                      )}
                      {session.status !== 'scheduled' && (
                        <span className="text-slate-500 text-xs capitalize">{session.status}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
