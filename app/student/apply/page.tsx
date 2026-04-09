'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/lib/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { COURSES, ACADEMIC_STREAMS } from '@/lib/utils'
import { FileText, SendHorizonal, Info } from 'lucide-react'
import toast from 'react-hot-toast'

const schema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(10, 'Valid phone number is required'),
  preferredCourse: z.string().min(1, 'Please select a course'),
  academicStream: z.string().min(1, 'Please select your academic stream'),
  preferredIntakeYear: z.string().min(1, 'Please select an intake year'),
  questions: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const INTAKE_YEARS = [
  { value: '2025', label: '2025' },
  { value: '2026', label: '2026' },
  { value: '2027', label: '2027' },
]

export default function ApplyPage() {
  const router = useRouter()
  const { profile, user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(false)
  const [checkingApplication, setCheckingApplication] = useState(true)
  const [mounted, setMounted] = useState(false)

  const { register, handleSubmit, watch, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: profile?.full_name || '',
      email: profile?.email || '',
      phone: profile?.phone || '',
      academicStream: '',
    },
  })

  const selectedStream = watch('academicStream')

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || authLoading) return
    
    // Check if there's a pending application in session storage
    const pending = sessionStorage.getItem('pendingApplication')
    if (pending) {
      try {
        const data = JSON.parse(pending)
        reset({
          fullName: data.student_name || '',
          email: data.student_email || '',
          phone: data.student_phone || '',
          preferredCourse: data.preferred_course || '',
          academicStream: data.academic_stream || '',
          preferredIntakeYear: data.preferred_intake_year || '',
          questions: data.questions || '',
        })
      } catch {
        // ignore parse errors
      }
    }
    
    setCheckingApplication(false)
  }, [mounted, authLoading, reset])

  const getRequiredExams = (stream: string) => {
    const examMap: Record<string, string[]> = {
      PCM: ['JEE', 'MHT-CET'],
      PCB: ['NEET', 'MHT-CET'],
      PCMB: ['JEE', 'NEET', 'MHT-CET'],
    }
    return examMap[stream] || []
  }

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    
    try {
      if (!user) { 
        toast.error('Please login first')
        return 
      }

      // Store form data in sessionStorage for documents page to use
      const applicationData = {
        student_id: user.id,
        student_name: data.fullName,
        student_email: data.email,
        student_phone: data.phone || null,
        preferred_course: data.preferredCourse,
        academic_stream: data.academicStream,
        preferred_intake_year: data.preferredIntakeYear || null,
        questions: data.questions || null,
      }
      
      sessionStorage.setItem('pendingApplication', JSON.stringify(applicationData))
      
      toast.success('Proceeding to document upload...')
      router.push('/student/documents')
      
    } catch (err: unknown) {
      console.error('[apply] Error:', err)
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!mounted || checkingApplication) {
    return (
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-400">Checking your application status...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-violet-500/20 rounded-2xl flex items-center justify-center">
          <FileText className="h-6 w-6 text-violet-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Apply for Course</h1>
          <p className="text-slate-400 text-sm">Fill in the details below and proceed to document upload</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <h2 className="text-lg font-semibold text-white mb-5">Personal Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Input label="Full Name *" placeholder="John Doe" error={errors.fullName?.message} {...register('fullName')} />
            <Input label="Email Address *" type="email" placeholder="you@example.com" error={errors.email?.message} {...register('email')} />
            <Input label="Phone Number *" type="tel" placeholder="+91 9876543210" error={errors.phone?.message} {...register('phone')} />
            <Select
              label="Preferred Intake Year *"
              options={INTAKE_YEARS}
              error={errors.preferredIntakeYear?.message}
              {...register('preferredIntakeYear')}
            />
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-white mb-5">Academic Information</h2>
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Select
                label="Academic Stream *"
                options={ACADEMIC_STREAMS}
                error={errors.academicStream?.message}
                {...register('academicStream')}
              />
              <Select
                label="Preferred Course *"
                options={COURSES.map(c => ({ value: c, label: c }))}
                error={errors.preferredCourse?.message}
                {...register('preferredCourse')}
              />
            </div>

            {selectedStream && (
              <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <Info className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-blue-400 font-medium">Required Entrance Exam Documents</p>
                  <p className="text-slate-300 mt-1">
                    Based on your {selectedStream} stream, you will need to upload:{' '}
                    <strong className="text-white">{getRequiredExams(selectedStream).join(', ')}</strong> scorecards in the next step.
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-white mb-5">Additional Questions</h2>
          <Textarea
            label="Any questions or notes for the admission team?"
            placeholder="Feel free to ask any questions about the course, fees, scholarships, etc..."
            rows={4}
            {...register('questions')}
          />
        </Card>

        <div className="flex justify-end gap-3">
          <Button
            type="submit"
            loading={loading}
            size="lg"
            className="gap-2"
          >
            <SendHorizonal className="h-4 w-4" />
            Continue to Documents
          </Button>
        </div>
      </form>
    </div>
  )
}
