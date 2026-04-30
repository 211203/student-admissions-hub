'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { formatDate, getDocumentTypesForStream } from '@/lib/utils'
import {
  FileText, Upload, MessageSquare, CalendarDays,
  Bell, ChevronRight, TrendingUp, Clock
} from 'lucide-react'
import Link from 'next/link'

interface DashboardData {
  application: { status: string; preferred_course: string | null; created_at: string; academic_stream?: string | null } | null
  documentsCount: number
  requiredDocumentsCount: number
  counselingSession: { scheduled_date: string; scheduled_time: string; status: string } | null
  notifications: { id: string; message: string; read: boolean; created_at: string }[]
  unreadCount: number
}

export default function StudentDashboard() {
  const { profile } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [applicationRes, storageRes, counselingRes, notifRes] = await Promise.all([
        supabase.from('applications').select('*').eq('student_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        fetch('/api/storage/list', { cache: 'no-store' }),
        supabase.from('counseling_sessions').select('scheduled_date, scheduled_time, status').eq('student_id', user.id).eq('status', 'scheduled').order('scheduled_date', { ascending: true }).limit(1).single(),
        supabase.from('notifications').select('*').eq('student_id', user.id).order('created_at', { ascending: false }).limit(5),
      ])

      const storageJson = storageRes.ok
        ? ((await storageRes.json()) as { documents?: { document_type: string }[] })
        : { documents: [] }

      const objects = storageJson.documents || []
      const uploadedTypes = new Set(objects.map((o) => o.document_type))

      const stream = applicationRes.data?.academic_stream || 'PCM'
      const requiredDocIds = getDocumentTypesForStream(stream).filter((d) => d.required).map((d) => d.id)
      const requiredDocumentsCount = requiredDocIds.length
      const uploadedRequiredCount = requiredDocIds.filter((id) => uploadedTypes.has(id)).length

      setData({
        application: applicationRes.data,
        documentsCount: uploadedRequiredCount,
        requiredDocumentsCount,
        counselingSession: counselingRes.data,
        notifications: notifRes.data || [],
        unreadCount: (notifRes.data || []).filter((n: { read: boolean }) => !n.read).length,
      })
      setLoading(false)
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  const quickLinks = [
    { href: '/student/apply', label: 'Apply for Course', icon: FileText, desc: 'Submit a new application', color: 'from-violet-600 to-indigo-600' },
    { href: '/student/documents', label: 'Upload Documents', icon: Upload, desc: 'Manage your documents', color: 'from-blue-600 to-cyan-600' },
    { href: '/student/chat', label: 'AI Assistant', icon: MessageSquare, desc: 'Get answers instantly', color: 'from-emerald-600 to-teal-600' },
    { href: '/student/book-counseling', label: 'Book Counseling', icon: CalendarDays, desc: 'Schedule a session', color: 'from-amber-600 to-orange-600' },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">
          Welcome back, <span className="gradient-text">{profile?.full_name?.split(' ')[0] || 'Student'}</span> 👋
        </h1>
        <p className="text-slate-400 mt-1">Here&apos;s your admission overview for today.</p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {/* Application Status */}
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 bg-violet-500/20 rounded-xl flex items-center justify-center">
              <FileText className="h-5 w-5 text-violet-400" />
            </div>
            {data?.application ? (
              <Badge variant="status" status={data.application.status}>
                {data.application.status}
              </Badge>
            ) : (
              <Badge variant="secondary">No application</Badge>
            )}
          </div>
          <div>
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Application Status</p>
            <p className="text-white font-semibold mt-0.5">
              {data?.application?.preferred_course || 'Not applied yet'}
            </p>
            {data?.application?.created_at && (
              <p className="text-slate-500 text-xs mt-1">Applied {formatDate(data.application.created_at)}</p>
            )}
          </div>
        </Card>

        {/* Counseling */}
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
              <CalendarDays className="h-5 w-5 text-amber-400" />
            </div>
            {data?.counselingSession ? (
              <Badge variant="status" status="scheduled">scheduled</Badge>
            ) : (
              <Badge variant="secondary">None</Badge>
            )}
          </div>
          <div>
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Counseling Session</p>
            {data?.counselingSession ? (
              <>
                <p className="text-white font-semibold mt-0.5">{formatDate(data.counselingSession.scheduled_date)}</p>
                <p className="text-slate-500 text-xs mt-1">at {data.counselingSession.scheduled_time}</p>
              </>
            ) : (
              <p className="text-white font-semibold mt-0.5">Not booked yet</p>
            )}
          </div>
        </Card>

        {/* Documents */}
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <Upload className="h-5 w-5 text-blue-400" />
            </div>
            <span className="text-2xl font-bold text-white">
              {data?.documentsCount || 0}
              <span className="text-slate-500 text-base font-normal">/{data?.requiredDocumentsCount || 0}</span>
            </span>
          </div>
          <div>
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Documents Uploaded</p>
            <p className="text-white font-semibold mt-0.5">
              {data?.requiredDocumentsCount && data?.documentsCount === data.requiredDocumentsCount
                ? 'All documents submitted'
                : `${Math.max(0, (data?.requiredDocumentsCount || 0) - (data?.documentsCount || 0))} remaining`}
            </p>
          </div>
        </Card>

        {/* Notifications */}
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
              <Bell className="h-5 w-5 text-emerald-400" />
            </div>
            {(data?.unreadCount || 0) > 0 && (
              <span className="w-6 h-6 bg-violet-500 rounded-full text-xs text-white flex items-center justify-center font-bold">
                {data?.unreadCount}
              </span>
            )}
          </div>
          <div>
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Notifications</p>
            <p className="text-white font-semibold mt-0.5">
              {data?.unreadCount ? `${data.unreadCount} unread` : 'All caught up!'}
            </p>
          </div>
        </Card>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {quickLinks.map(({ href, label, icon: Icon, desc, color }) => (
              <Link
                key={href}
                href={href}
                className="group flex items-center gap-4 p-5 bg-slate-800/50 border border-slate-700/50 rounded-2xl hover:border-slate-600 hover:bg-slate-800 transition-all duration-200"
              >
                <div className={`w-12 h-12 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center shadow-lg shrink-0 group-hover:scale-105 transition-transform duration-200`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm">{label}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 shrink-0 transition-colors" />
              </Link>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            Recent Notifications
            {(data?.unreadCount || 0) > 0 && (
              <span className="w-5 h-5 bg-violet-500 rounded-full text-xs text-white flex items-center justify-center">
                {data?.unreadCount}
              </span>
            )}
          </h2>
          <Card className="p-0 overflow-hidden">
            {data?.notifications && data.notifications.length > 0 ? (
              <div className="divide-y divide-slate-700/50">
                {data.notifications.map(notif => (
                  <div key={notif.id} className={`p-4 ${!notif.read ? 'bg-violet-500/5' : ''}`}>
                    <div className="flex gap-3">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!notif.read ? 'bg-violet-400' : 'bg-slate-600'}`} />
                      <div>
                        <p className="text-slate-300 text-sm">{notif.message}</p>
                        <p className="text-slate-500 text-xs mt-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(notif.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center">
                <TrendingUp className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">No notifications yet</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
