'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { COURSES } from '@/lib/utils'
import {
  Users, Clock, CalendarDays, CheckCircle,
  TrendingUp, ArrowUpRight
} from 'lucide-react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

const CHART_COLORS = ['#8b5cf6', '#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#a855f7']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface Stats {
  total: number
  pending: number
  counselingScheduled: number
  admitted: number
}

interface CourseData { name: string; value: number }
interface MonthData { month: string; count: number }

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [courseData, setCourseData] = useState<CourseData[]>([])
  const [monthData, setMonthData] = useState<MonthData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()

      const [appsRes, counselingRes] = await Promise.all([
        supabase.from('applications').select('status, preferred_course, created_at'),
        supabase.from('counseling_sessions').select('status', { count: 'exact' }).eq('status', 'scheduled'),
      ])

      const apps = appsRes.data || []

      // Stats
      setStats({
        total: apps.length,
        pending: apps.filter(a => a.status === 'pending' || a.status === 'reviewing').length,
        counselingScheduled: counselingRes.count || 0,
        admitted: apps.filter(a => a.status === 'approved').length,
      })

      // By course
      const courseCounts: Record<string, number> = {}
      apps.forEach(a => {
        const c = a.preferred_course || 'Other'
        const shortName = c.split(' ')[0] + ' ' + (c.split(' ')[1] || '')
        courseCounts[shortName] = (courseCounts[shortName] || 0) + 1
      })
      setCourseData(Object.entries(courseCounts).map(([name, value]) => ({ name, value })))

      // By month (last 6 months)
      const monthCounts: Record<number, number> = {}
      apps.forEach(a => {
        const month = new Date(a.created_at).getMonth()
        monthCounts[month] = (monthCounts[month] || 0) + 1
      })
      const currentMonth = new Date().getMonth()
      const last6 = Array.from({ length: 6 }, (_, i) => (currentMonth - 5 + i + 12) % 12)
      setMonthData(last6.map(m => ({ month: MONTHS[m], count: monthCounts[m] || 0 })))

      setLoading(false)
    }
    fetchData()
  }, [])

  const statCards = [
    { label: 'Total Applications', value: stats?.total || 0, icon: Users, color: 'from-violet-600 to-indigo-600', shadow: 'shadow-violet-500/25', change: '+12% this month' },
    { label: 'Pending Review', value: stats?.pending || 0, icon: Clock, color: 'from-amber-600 to-orange-600', shadow: 'shadow-amber-500/25', change: 'Needs attention' },
    { label: 'Counseling Scheduled', value: stats?.counselingScheduled || 0, icon: CalendarDays, color: 'from-blue-600 to-cyan-600', shadow: 'shadow-blue-500/25', change: 'Upcoming sessions' },
    { label: 'Admitted Students', value: stats?.admitted || 0, icon: CheckCircle, color: 'from-emerald-600 to-teal-600', shadow: 'shadow-emerald-500/25', change: 'Offer letters sent' },
  ]

  const CustomTooltip = ({ active, payload, label }: { active?: boolean, payload?: { name: string; value: number }[], label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-600 rounded-xl p-3 text-sm">
          <p className="text-slate-300 font-medium">{label}</p>
          <p className="text-violet-400">{payload[0].value} applications</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
        <p className="text-slate-400 mt-1">Overview of all admission activities and metrics</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            {statCards.map(({ label, value, icon: Icon, color, shadow, change }) => (
              <Card key={label} className="relative overflow-hidden">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center shadow-lg ${shadow}`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-slate-500" />
                </div>
                <p className="text-4xl font-bold text-white mb-1">{value}</p>
                <p className="text-slate-400 text-sm font-medium">{label}</p>
                <p className="text-slate-500 text-xs mt-1">{change}</p>
              </Card>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar chart */}
            <Card>
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="h-5 w-5 text-violet-400" />
                <h2 className="text-lg font-semibold text-white">Applications by Month</h2>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Applications" fill="url(#violetGradient)" radius={[6, 6, 0, 0]} />
                  <defs>
                    <linearGradient id="violetGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.9} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.7} />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Pie chart */}
            <Card>
              <div className="flex items-center gap-2 mb-6">
                <Users className="h-5 w-5 text-emerald-400" />
                <h2 className="text-lg font-semibold text-white">Applications by Course</h2>
              </div>
              {courseData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={courseData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {courseData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: '12px' }}
                      labelStyle={{ color: '#e2e8f0' }}
                      itemStyle={{ color: '#a78bfa' }}
                    />
                    <Legend
                      formatter={(value) => <span style={{ color: '#94a3b8', fontSize: '11px' }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-60 text-slate-500">
                  <p className="text-sm">No application data yet</p>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
