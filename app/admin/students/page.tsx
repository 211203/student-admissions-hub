'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { Input, Select } from '@/components/ui/Input'
import { formatDate, COURSES } from '@/lib/utils'
import { Users, Search, ChevronRight, SlidersHorizontal } from 'lucide-react'

interface Application {
  id: string
  student_id: string
  full_name: string
  preferred_course: string
  academic_background: string
  entrance_exam_score: number
  budget_range: string
  status: string
  created_at: string
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

const PAGE_SIZE = 10

export default function StudentsPage() {
  const router = useRouter()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [courseFilter, setCourseFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    fetchApplications()
  }, [search, courseFilter, statusFilter, page])

  const fetchApplications = async () => {
    setLoading(true)
    const supabase = createClient()

    let query = supabase
      .from('applications')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (search) query = query.ilike('full_name', `%${search}%`)
    if (courseFilter) query = query.eq('preferred_course', courseFilter)
    if (statusFilter) query = query.eq('status', statusFilter)

    const { data, count } = await query
    setApplications(data || [])
    setTotal(count || 0)
    setLoading(false)
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
            <h1 className="text-2xl font-bold text-white">Students</h1>
            <p className="text-slate-400 text-sm">{total} total applications</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <SlidersHorizontal className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-300">Filter & Search</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0) }}
              placeholder="Search by name..."
              className="w-full bg-slate-700/50 border border-slate-600 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            />
          </div>
          <Select
            options={COURSES.map(c => ({ value: c, label: c }))}
            value={courseFilter}
            onChange={(e) => { setCourseFilter(e.target.value); setPage(0) }}
          />
          <Select
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0) }}
          />
        </div>
        {(search || courseFilter || statusFilter) && (
          <button
            onClick={() => { setSearch(''); setCourseFilter(''); setStatusFilter(''); setPage(0) }}
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
                {['Student Name', 'Preferred Course', 'Academic Background', 'Exam Score', 'Budget', 'Status', 'Applied', ''].map(col => (
                  <th key={col} className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <Spinner />
                  </td>
                </tr>
              ) : applications.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
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
                        <div className="w-8 h-8 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {app.full_name?.charAt(0)?.toUpperCase()}
                        </div>
                        <span className="text-white font-medium text-sm whitespace-nowrap">{app.full_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-slate-300 text-sm whitespace-nowrap">
                        {app.preferred_course?.split(' ').slice(0, 3).join(' ')}...
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-slate-400 text-sm truncate max-w-[160px] block">
                        {app.academic_background?.substring(0, 50)}...
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-white font-medium text-sm">{app.entrance_exam_score}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-slate-300 text-sm whitespace-nowrap">{app.budget_range}</span>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant="status" status={app.status}>{app.status}</Badge>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-slate-400 text-xs whitespace-nowrap">{formatDate(app.created_at)}</span>
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
