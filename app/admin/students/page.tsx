'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { Select } from '@/components/ui/Input'
import { formatDate, formatDateTime } from '@/lib/utils'
import { STUDENT_DOCUMENTS_BUCKET } from '@/lib/supabase/storage'
import { Users, Search, ChevronRight, SlidersHorizontal, Cog, FileText } from 'lucide-react'
import toast from 'react-hot-toast'

interface ApplicationWithMeta {
  id: string
  student_id: string
  student_name?: string | null
  student_email?: string | null
  student_phone?: string | null
  full_name: string | null
  email: string | null
  phone: string | null
  preferred_course: string | null
  academic_stream: string | null
  preferred_intake_year: string | null
  questions: string | null
  status: string | null
  created_at: string
  documents_count: number
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

const PAGE_SIZE = 10

export default function StudentsPage() {
  const router = useRouter()
  const [applications, setApplications] = useState<ApplicationWithMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [processingId, setProcessingId] = useState<string | null>(null)

  useEffect(() => {
    fetchApplications()
  }, [search, statusFilter, page])

  const fetchApplications = async () => {
    setLoading(true)
    const supabase = createClient()

    let query = supabase
      .from('applications')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (search) {
      query = query.or(`student_name.ilike.%${search}%,student_email.ilike.%${search}%`)
    }

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    const { data: apps, count } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (!apps) {
      setApplications([])
      setTotal(0)
      setLoading(false)
      return
    }

    const studentIds = Array.from(new Set(apps.map(a => a.student_id)))
    const { data: docsData } = await supabase
      .from('documents')
      .select('student_id')
      .in('student_id', studentIds)

    const docCounts: Record<string, number> = {}
    docsData?.forEach(d => {
      docCounts[d.student_id] = (docCounts[d.student_id] || 0) + 1
    })

    setApplications(
      apps.map((a) => ({
        ...a,
        full_name: a.student_name || a.full_name || null,
        email: a.student_email || a.email || null,
        phone: a.student_phone || a.phone || null,
        documents_count: docCounts[a.student_id] || 0,
      }))
    )

    setTotal(count || 0)
    setLoading(false)
  }

  const processApplication = async (e: React.MouseEvent, app: ApplicationWithMeta) => {
    e.stopPropagation()
    setProcessingId(app.id)

    try {
      const supabase = createClient()

      const { data: documents } = await supabase
        .from('documents')
        .select('*')
        .eq('student_id', app.student_id)

      if (!documents || documents.length === 0) {
        toast.error('No documents found for this student')
        return
      }

      const docsWithUrls = await Promise.all(
        documents.map(async (doc) => {
          const { data } = await supabase.storage
            .from(STUDENT_DOCUMENTS_BUCKET)
            .createSignedUrl(doc.file_path, 3600)
          return {
            docType: doc.document_type,
            filePath: doc.file_path,
            fileName: doc.file_name,
            signedUrl: data?.signedUrl || '',
          }
        })
      )

      const response = await fetch('/api/webhook/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: app.id,
          student_name: app.full_name,
          student_email: app.email,
          student_phone: app.phone,
          student_id: app.student_id,
          intake_year: app.preferred_intake_year,
          preferred_stream: app.academic_stream,
          studentId: app.student_id,
          fullName: app.full_name,
          email: app.email,
          phone: app.phone,
          academicStream: app.academic_stream,
          preferredCourse: app.preferred_course,
          preferredIntakeYear: app.preferred_intake_year,
          questions: app.questions,
          documents: docsWithUrls,
          timestamp: new Date().toISOString(),
        }),
      })

      if (response.ok) {
        toast.success('Sent to n8n for processing!')
      } else {
        const text = await response.text().catch(() => '')
        toast.error(text || 'Failed to process')
      }
    } catch (err) {
      console.error('Process application error:', err)
      toast.error('Failed to process')
    } finally {
      setProcessingId(null)
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
            <Users className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Applications</h1>
            <p className="text-slate-400 text-sm">{total} application(s)</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <SlidersHorizontal className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-300">Filter & Search</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              suppressHydrationWarning
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0) }}
              placeholder="Search by name or email..."
              className="w-full bg-slate-700/50 border border-slate-600 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            />
          </div>
          <Select
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0) }}
          />
        </div>
        {(search || statusFilter !== 'all') && (
          <button
            onClick={() => { setSearch(''); setStatusFilter('all'); setPage(0) }}
            className="mt-3 text-xs text-violet-400 hover:text-violet-300 transition-colors"
          >
            Clear all filters
          </button>
        )}
      </Card>

      {/* Table */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700/50">
              <tr>
                {['Student', 'Stream', 'Course', 'Status', 'Docs', 'Applied', 'Last Active', 'Actions', ''].map(col => (
                  <th key={col} className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <Spinner />
                  </td>
                </tr>
              ) : applications.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400">
                    No applications found
                  </td>
                </tr>
              ) : (
                applications.map((app) => (
                  <tr
                    key={app.id}
                    className="hover:bg-slate-700/30 transition-colors cursor-pointer"
                    onClick={() => router.push(`/admin/students/${app.id}`)}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0">
                            {(app.full_name || app.email || app.student_id)?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                        </div>
                        <div>
                          <span className="text-white font-medium text-sm whitespace-nowrap block">
                            {app.full_name || app.email?.split('@')[0] || (app.student_id ? `Student ${app.student_id.slice(0, 8)}` : 'Student')}
                          </span>
                          <span className="text-slate-400 text-xs">{app.email || app.student_id || 'No identifier'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-slate-300 text-sm whitespace-nowrap">{app.academic_stream || '—'}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-slate-300 text-sm">{app.preferred_course || '—'}</span>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant="status" status={app.status || 'pending'}>
                        {app.status || 'pending'}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-blue-400" />
                        <span className="text-white text-sm">{app.documents_count}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-slate-400 text-xs whitespace-nowrap">{formatDate(app.created_at)}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-slate-400 text-xs whitespace-nowrap">
                        {formatDateTime(app.created_at)}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <Button
                        size="sm"
                        onClick={(e) => processApplication(e, app)}
                        loading={processingId === app.id}
                        disabled={app.documents_count === 0 || !app.student_id}
                        className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-xs px-3 py-1.5 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Cog className="w-3 h-3" />
                        Process
                      </Button>
                    </td>
                    <td className="px-5 py-4">
                      <ChevronRight className="h-4 w-4 text-slate-600" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-4 border-t border-slate-700/50 flex items-center justify-between">
            <p className="text-sm text-slate-400">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
                Previous
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
