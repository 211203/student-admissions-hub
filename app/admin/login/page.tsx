'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Shield, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const schema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type FormData = z.infer<typeof schema>

export default function AdminLoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { error, data: authData } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      if (error) {
        toast.error(error.message)
        return
      }

      // Check admin role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authData.user.id)
        .single()

      if (!profile || profile.role !== 'admin') {
        await supabase.auth.signOut()
        toast.error('Access denied. This portal is for admins only.')
        return
      }

      toast.success('Welcome back, Admin!')
      router.push('/admin/dashboard')
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-emerald-900/40 via-slate-900 to-teal-900/40 p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMxMGI5ODEiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoLTZ2LTZoNnptMC0zMHY2aC02di02aDZ6bS0zMCAzMHY2SDZ2LTZoNnptMC0zMHY2SDZ2LTZoNnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <span className="text-white font-bold text-lg">Admin Portal</span>
          </div>
          <h1 className="text-5xl font-bold text-white leading-tight mb-6">
            Manage admissions with <span className="gradient-text-emerald">full control</span>
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            Review applications, schedule counseling sessions, approve students, and track analytics — all in one powerful dashboard.
          </p>
        </div>
        <div className="relative z-10 grid grid-cols-2 gap-4">
          {[
            { label: 'Applications', value: 'Manage All' },
            { label: 'Analytics', value: 'Real-time' },
            { label: 'Counseling', value: 'Schedule' },
            { label: 'Decisions', value: 'Instant' },
          ].map(stat => (
            <div key={stat.label} className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-4">
              <p className="text-lg font-bold text-emerald-400">{stat.value}</p>
              <p className="text-slate-400 text-sm">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <span className="text-white font-bold">Admin Portal</span>
          </div>

          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Admin Sign In</h2>
            <p className="text-slate-400">Restricted to authorized admission team members</p>
          </div>

          {/* Warning box */}
          <div className="flex gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-amber-300 text-sm leading-relaxed">
              This portal is restricted to admin users only. Regular student accounts will be denied access.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Input
              label="Admin Email"
              type="email"
              placeholder="admin@institution.edu"
              icon={<Mail className="h-4 w-4" />}
              error={errors.email?.message}
              {...register('email')}
            />
            <div>
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                icon={<Lock className="h-4 w-4" />}
                error={errors.password?.message}
                {...register('password')}
              />
              <button
                suppressHydrationWarning
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="mt-2 text-xs text-slate-400 hover:text-slate-300 flex items-center gap-1"
              >
                {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {showPassword ? 'Hide' : 'Show'} password
              </button>
            </div>

            <Button
              type="submit"
              loading={loading}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-500/25"
              size="lg"
            >
              Sign In to Admin Panel
            </Button>
          </form>

          <div className="border-t border-slate-800 pt-6 space-y-4">
            <p className="text-center text-xs text-slate-500">
              Need an admin account?{' '}
              <Link suppressHydrationWarning href="/admin/register" className="text-emerald-400 hover:text-emerald-300 transition-colors">
                Create one →
              </Link>
            </p>
            <p className="text-center text-xs text-slate-500">
              Are you a student?{' '}
              <Link suppressHydrationWarning href="/login" className="text-violet-400 hover:text-violet-300 transition-colors">
                Student Login →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
