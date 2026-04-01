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
import { Users, Search, ChevronRight, SlidersHorizontal, Mail } from 'lucide-react'

interface Application {
  id: string
  student_id: string
  full_name: string
  email: string
  preferred_course: string
  academic_background: string
  entrance_exam_score: number
  budget_range: string
  status: string
  created_at: string
  updated_at: string
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

const PAGE_SIZE = 10

const needsFollowUp = (lastDateString: string | null) => {
  if (!lastDateString) return true;
  
  const lastDate = new Date(lastDateString);
  const today = new Date();
  
  const diffTime = Math.abs(today.getTime() - lastDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays >= 14;
}

const DUMMY_STUDENTS: Application[] = [
  {
    id: 'dummy-1',
    student_id: 'std-1',
    full_name: 'Alice Johnson',
    email: 'alice@example.com',
    preferred_course: 'B.Tech Computer Science',
    academic_background: 'High School Diploma with 92% in PCM',
    entrance_exam_score: 95,
    budget_range: '$20,000 - $30,000',
    status: 'pending',
    created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days ago -> needs follow-up
  },
  {
    id: 'dummy-2',
    student_id: 'std-2',
    full_name: 'Bob Smith',
    email: 'bob@example.com',
    preferred_course: 'B.Tech Information Technology',
    academic_background: 'Intermediate with 85%',
    entrance_exam_score: 82,
    budget_range: '$10,000 - $20,000',
    status: 'reviewing',
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago -> recently contacted
  },
  {
    id: 'dummy-3',
    student_id: 'std-3',
    full_name: 'Charlie Davis',
    email: 'charlie@example.com',
    preferred_course: 'B.Tech Electronics',
    academic_background: 'A-Levels in Physics, Math',
    entrance_exam_score: 88,
    budget_range: '$15,000 - $25,000',
    status: 'approved',
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(), // 28 days ago -> needs follow-up
  }
]

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

    if (!data || data.length === 0) {
      // Use dummy data if database is empty so frontend UI can be tested
      let filteredDummy = [...DUMMY_STUDENTS]
      if (search) filteredDummy = filteredDummy.filter(s => s.full_name.toLowerCase().includes(search.toLowerCase()))
      if (courseFilter) filteredDummy = filteredDummy.filter(s => s.preferred_course === courseFilter)
      if (statusFilter) filteredDummy = filteredDummy.filter(s => s.status === statusFilter)
      
      setApplications(filteredDummy)
      setTotal(filteredDummy.length)
    } else {
      setApplications(data)
      setTotal(count || 0)
    }
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
              suppressHydrationWarning
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
                {['Student Name', 'Preferred Course', 'Academic Background', 'Exam Score', 'Budget', 'Status', 'Applied', 'Follow-up', ''].map(col => (
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
                    <td className="px-5 py-4 whitespace-nowrap">
                      {needsFollowUp(app.updated_at) ? (
                        <Button 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            window.location.href = `mailto:${app.email}?subject=Checking in on your application`
                          }}
                          className="bg-amber-600/20 text-amber-500 hover:bg-amber-600/30 hover:text-amber-400 text-xs px-3 py-1 flex items-center gap-2 border border-amber-600/30"
                        >
                          <Mail className="w-3 h-3" />
                          Send Follow-up
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-500 px-3 py-1 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Recently Contacted
                        </span>
                      )}
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
