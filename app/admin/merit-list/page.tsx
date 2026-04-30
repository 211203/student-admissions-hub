import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

interface MeritStudent {
  state_merit_rank: number
  student_name: string
  total_percentile: number
  math_percentile: number
  physics_percentile: number
  chemistry_percentile: number
  hsc_aggregate: number
}

interface MeritListSearchParams {
  page?: string | string[]
  q?: string | string[]
}

interface RawMeritStudent {
  state_merit_rank: number | string | null
  student_name: string | null
  total_percentile?: number | string | null
  percentile?: number | string | null
  total_perc?: number | string | null
  math_percentile: number | string | null
  physics_percentile: number | string | null
  chemistry_percentile: number | string | null
  hsc_aggregate: number | string | null
}

interface RawApplicationStudent {
  student_name?: string | null
  full_name?: string | null
  total_percentile?: number | string | null
  percentile?: number | string | null
  total_perc?: number | string | null
  math_percentile?: number | string | null
  physics_percentile?: number | string | null
  chemistry_percentile?: number | string | null
  hsc_aggregate?: number | string | null
}

function asSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '')
}

function toNumber(value: number | string | null) {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

function buildPageHref(page: number, searchTerm: string) {
  const params = new URLSearchParams()

  if (searchTerm) params.set('q', searchTerm)
  if (page > 1) params.set('page', String(page))

  const queryString = params.toString()
  return queryString ? `/admin/merit-list?${queryString}` : '/admin/merit-list'
}

export default async function MeritListPage({
  searchParams,
}: {
  searchParams?: Promise<MeritListSearchParams> | MeritListSearchParams
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const searchTerm = asSingleValue(resolvedSearchParams.q).trim()
  const requestedPage = Number.parseInt(asSingleValue(resolvedSearchParams.page) || '1', 10)
  const currentPage = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const from = (currentPage - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const supabase = await createClient()

  let query = supabase
    .from('pcm_merit_list')
    .select('*', { count: 'exact' })
    .order('state_merit_rank', { ascending: true })

  if (searchTerm) {
    query = query.ilike('student_name', `%${searchTerm}%`)
  }

  const { data, error, count } = await query.range(from, to)

  let students: MeritStudent[] = ((data ?? []) as RawMeritStudent[]).map((student) => ({
    state_merit_rank: toNumber(student.state_merit_rank),
    student_name: student.student_name ?? 'Unknown Student',
    total_percentile: toNumber(student.total_percentile ?? student.percentile ?? student.total_perc ?? 0),
    math_percentile: toNumber(student.math_percentile),
    physics_percentile: toNumber(student.physics_percentile),
    chemistry_percentile: toNumber(student.chemistry_percentile),
    hsc_aggregate: toNumber(student.hsc_aggregate),
  }))

  let totalRows = count ?? 0
  let errorMessage = error?.message ?? null

  if (students.length === 0) {
    const {
      data: fallbackData,
      error: fallbackError,
      count: fallbackCount,
    } = await supabase
      .from('applications')
      .select('*', { count: 'exact' })
      .or('status.ilike.approved,verification_status.ilike.approved')
      .or('academic_stream.ilike.pcm,academic_stream.ilike.pcmb')
      .order('percentile', { ascending: false, nullsFirst: false })
      .order('math_percentile', { ascending: false, nullsFirst: false })
      .order('physics_percentile', { ascending: false, nullsFirst: false })
      .order('chemistry_percentile', { ascending: false, nullsFirst: false })
      .order('hsc_aggregate', { ascending: false, nullsFirst: false })
      .order('dob', { ascending: true, nullsFirst: false })
      .range(from, to)

    if (!fallbackError) {
      students = ((fallbackData ?? []) as RawApplicationStudent[]).map((student, index) => ({
        state_merit_rank: from + index + 1,
        student_name: student.student_name ?? student.full_name ?? 'Unknown Student',
        total_percentile: toNumber(student.total_percentile ?? student.percentile ?? student.total_perc ?? 0),
        math_percentile: toNumber(student.math_percentile ?? 0),
        physics_percentile: toNumber(student.physics_percentile ?? 0),
        chemistry_percentile: toNumber(student.chemistry_percentile ?? 0),
        hsc_aggregate: toNumber(student.hsc_aggregate ?? 0),
      }))
      totalRows = fallbackCount ?? 0
      errorMessage = null
    } else if (errorMessage) {
      errorMessage = `${errorMessage} | fallback failed: ${fallbackError.message}`
    } else {
      errorMessage = fallbackError.message
    }
  }

  if (errorMessage) {
    return (
      <div className="space-y-4 rounded-2xl border border-red-500/40 bg-gray-900 p-6">
        <h1 className="text-2xl font-bold text-white">PCM Merit List</h1>
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Failed to load merit list: {errorMessage}
        </p>
      </div>
    )
  }
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE))
  const hasPrevPage = currentPage > 1
  const hasNextPage = currentPage < totalPages

  return (
    <section className="space-y-6 rounded-2xl border border-gray-800 bg-gray-900 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">PCM Merit List</h1>
          <p className="text-sm text-gray-400">Approved students from PCM and PCMB streams</p>
        </div>

        <form method="get" className="flex w-full max-w-md gap-2">
          <input
            type="text"
            name="q"
            defaultValue={searchTerm}
            placeholder="Search by student name"
            className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-white placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            Search
          </button>
          {searchTerm && (
            <Link
              href="/admin/merit-list"
              className="rounded-xl border border-gray-700 px-4 py-2 text-sm font-semibold text-gray-300 transition hover:border-gray-600 hover:text-white"
            >
              Clear
            </Link>
          )}
        </form>
      </div>

      {students.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-800/50 px-4 py-8 text-center text-gray-300">
          No approved students yet
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="min-w-full bg-gray-900 text-sm">
            <thead className="sticky top-0 z-10 bg-gray-800">
              <tr>
                {['Rank', 'Student Name', 'Total Percentile', 'Maths', 'Physics', 'Chemistry', 'HSC %'].map((column) => (
                  <th
                    key={column}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-300"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {students.map((student, index) => (
                <tr
                  key={`${student.state_merit_rank}-${student.student_name}-${index}`}
                  className={`transition hover:bg-gray-800/80 ${
                    student.state_merit_rank <= 10 ? 'bg-blue-950/30' : 'bg-transparent'
                  }`}
                >
                  <td className="px-4 py-3 font-bold text-blue-400">{student.state_merit_rank}</td>
                  <td className="px-4 py-3 text-white">{student.student_name}</td>
                  <td className="px-4 py-3 text-gray-200">{student.total_percentile.toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-200">{student.math_percentile.toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-200">{student.physics_percentile.toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-200">{student.chemistry_percentile.toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-200">{student.hsc_aggregate.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-gray-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-400">
          Showing {students.length === 0 ? 0 : from + 1}-{Math.min(from + students.length, totalRows)} of {totalRows}
        </p>
        <div className="flex items-center gap-2">
          {hasPrevPage ? (
            <Link
              href={buildPageHref(currentPage - 1, searchTerm)}
              className="rounded-lg bg-gray-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-gray-700"
            >
              Previous
            </Link>
          ) : (
            <span className="cursor-not-allowed rounded-lg bg-gray-800/60 px-3 py-2 text-sm font-medium text-gray-500">
              Previous
            </span>
          )}
          <span className="text-sm text-gray-300">
            Page {Math.min(currentPage, totalPages)} of {totalPages}
          </span>
          {hasNextPage ? (
            <Link
              href={buildPageHref(currentPage + 1, searchTerm)}
              className="rounded-lg bg-gray-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-gray-700"
            >
              Next
            </Link>
          ) : (
            <span className="cursor-not-allowed rounded-lg bg-gray-800/60 px-3 py-2 text-sm font-medium text-gray-500">
              Next
            </span>
          )}
        </div>
      </div>
    </section>
  )
}
