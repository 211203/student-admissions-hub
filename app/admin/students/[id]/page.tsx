'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { formatDate, formatDateTime } from '@/lib/utils'
import { STUDENT_DOCUMENTS_BUCKET } from '@/lib/supabase/storage'
import {
  ArrowLeft, User, FileText, MessageSquare, CheckCircle,
  XCircle, CalendarDays, Mail, Download, Clock, Phone, BookOpen, Cog
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Application {
  id: string
  student_id: string
  student_name?: string | null
  student_email?: string | null
  student_phone?: string | null
  full_name: string
  email: string
  phone: string | null
  preferred_course: string | null
  academic_stream: string | null
  preferred_intake_year: string | null
  questions: string | null
  status: string
  admin_notes: string | null
  created_at: string
  updated_at: string
}

interface Document { id: string; document_type: string; file_name: string; file_path: string; uploaded_at: string }
interface ChatMessage { id: string; message: string; role: string; created_at: string }
//09042026 updated code
const DOC_LABELS: Record<string, string> = {
  '10th_marksheet': '10th Marksheet',
  '12th_marksheet': '12th Marksheet',
  'leaving_certificate': 'Leaving Certificate (LC/TC)',
  'mht_cet_scorecard': 'MHT-CET Scorecard',
  'jee_scorecard': 'JEE Scorecard',
  'neet_scorecard': 'NEET Scorecard',
  'id_proof': 'ID Proof (Aadhar/PAN)',
  'photo': 'Passport Photo',
  'caste_certificate': 'Caste Certificate',
  'income_certificate': 'Income Certificate',
  'gap_certificate': 'Gap Certificate',
}

export default function StudentDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [application, setApplication] = useState<Application | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)
  const [adminNotes, setAdminNotes] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()
      const { data: app } = await supabase.from('applications').select('*').eq('id', id as string).single()
      if (!app) { setLoading(false); return }
      setApplication({
        ...app,
        full_name: app.student_name || app.full_name || '',
        email: app.student_email || app.email || '',
        phone: app.student_phone || app.phone || null,
      })
      setAdminNotes(app.admin_notes || '')

      const [docsRes, chatRes] = await Promise.all([
        supabase.from('documents').select('*').eq('student_id', app.student_id).order('uploaded_at', { ascending: false }),
        supabase.from('chat_messages').select('*').eq('student_id', app.student_id).order('created_at', { ascending: true }).limit(20),
      ])
      setDocuments(docsRes.data || [])
      setChatHistory(chatRes.data || [])
      setLoading(false)
    }
    fetchData()
  }, [id])

  const updateStatus = async (status: 'approved' | 'rejected' | 'reviewing') => {
    setUpdating(status)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('applications')
        .update({ status, admin_notes: adminNotes, updated_at: new Date().toISOString() })
        .eq('id', id as string)

      if (error) throw error

      setApplication(prev => prev ? { ...prev, status } : null)
      toast.success(`Application ${status}!`)

      // Add notification for student
      await supabase.from('notifications').insert({
        student_id: application?.student_id,
        message: `Your application for ${application?.preferred_course} has been ${status}.`,
      })
    } catch {
      toast.error('Failed to update status')
    } finally {
      setUpdating(null)
    }
  }

  const sendEmail = async () => {
    setUpdating('email')
    try {
      await fetch('/api/webhook/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentEmail: application?.email,
          studentName: application?.full_name,
          status: application?.status,
          course: application?.preferred_course,
          adminNotes,
        }),
      })
      toast.success('Email sent to student!')
    } catch {
      toast.error('Failed to send email')
    } finally {
      setUpdating(null)
    }
  }

  const downloadDoc = async (doc: Document) => {
    try {
      const supabase = createClient()
      const { data } = await supabase.storage.from(STUDENT_DOCUMENTS_BUCKET).createSignedUrl(doc.file_path, 60)
      if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    } catch {
      toast.error('Failed to download document')
    }
  }

  const processDocuments = async () => {
    if (documents.length === 0) {
      toast.error('No documents to process')
      return
    }

    setProcessing(true)
    try {
      const supabase = createClient()
      
      // Generate signed URLs for all documents
      const docsWithUrls = await Promise.all(
        documents.map(async (doc) => {
          const { data } = await supabase.storage
            .from(STUDENT_DOCUMENTS_BUCKET)
            .createSignedUrl(doc.file_path, 3600) // 1 hour validity
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
          applicationId: application?.id,
          student_name: application?.full_name,
          student_email: application?.email,
          student_phone: application?.phone,
          student_id: application?.student_id,
          intake_year: application?.preferred_intake_year,
          preferred_stream: application?.academic_stream,
          studentId: application?.student_id,
          fullName: application?.full_name,
          email: application?.email,
          phone: application?.phone,
          academicStream: application?.academic_stream,
          preferredCourse: application?.preferred_course,
          preferredIntakeYear: application?.preferred_intake_year,
          questions: application?.questions,
          documents: docsWithUrls,
          timestamp: new Date().toISOString(),
        }),
      })

      if (response.ok) {
        toast.success('Sent to n8n for processing!')
      } else {
        const text = await response.text().catch(() => '')
        toast.error(text || 'Failed to process documents')
      }
    } catch (err) {
      console.error('Process documents error:', err)
      toast.error('Failed to process documents')
    } finally {
      setProcessing(false)
    }
  }

  if (loading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>
  if (!application) return <div className="text-center py-16 text-slate-400">Application not found</div>

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back + Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-2 p-2">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-full flex items-center justify-center text-white text-lg font-bold">
              {application.full_name?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{application.full_name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="status" status={application.status}>{application.status}</Badge>
                <span className="text-slate-400 text-xs">Applied {formatDate(application.created_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 p-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl">
        <Button
          onClick={() => updateStatus('approved')}
          loading={updating === 'approved'}
          className="gap-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 shadow-emerald-500/25"
        >
          <CheckCircle className="h-4 w-4" />
          Approve
        </Button>
        <Button
          onClick={() => updateStatus('rejected')}
          loading={updating === 'rejected'}
          variant="danger"
          className="gap-2"
        >
          <XCircle className="h-4 w-4" />
          Not Approved
        </Button>
        <Button
          onClick={() => updateStatus('reviewing')}
          loading={updating === 'reviewing'}
          variant="secondary"
          className="gap-2"
        >
          <Clock className="h-4 w-4" />
          Mark Reviewing
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <User className="h-4 w-4 text-violet-400" />
              <h2 className="text-lg font-semibold text-white">Application</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Email', value: application.email, icon: Mail },
                { label: 'Phone', value: application.phone || 'N/A', icon: Phone },
                { label: 'Academic Stream', value: application.academic_stream || 'N/A', icon: BookOpen },
                { label: 'Preferred Course', value: application.preferred_course || 'N/A', icon: BookOpen },
                { label: 'Intake Year', value: application.preferred_intake_year || 'N/A', icon: CalendarDays },
                { label: 'Last Updated', value: formatDateTime(application.updated_at), icon: Clock },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="space-y-1">
                  <p className="text-xs font-medium text-slate-500 flex items-center gap-1">
                    <Icon className="h-3 w-3" />{label}
                  </p>
                  <p className="text-white text-sm">{value}</p>
                </div>
              ))}
            </div>
            {application.questions && (
              <div className="mt-4 pt-4 border-t border-slate-700">
                <p className="text-xs font-medium text-slate-500 mb-1">Student Questions</p>
                <p className="text-slate-300 text-sm leading-relaxed">{application.questions}</p>
              </div>
            )}
          </Card>

          {/* Admin Notes */}
          <Card>
            <h2 className="text-lg font-semibold text-white mb-4">Admission Report / Admin Notes</h2>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Add notes about this application, admission decision rationale, or generate a report..."
              rows={5}
              className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none text-sm"
            />
            <div className="mt-3 flex justify-end">
              <Button
                size="sm"
                onClick={async () => {
                  const supabase = createClient()
                  await supabase.from('applications').update({ admin_notes: adminNotes }).eq('id', id as string)
                  toast.success('Notes saved!')
                }}
              >
                Save Notes
              </Button>
            </div>
          </Card>

          {/* Chat History */}
          {chatHistory.length > 0 && (
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="h-4 w-4 text-emerald-400" />
                <h2 className="text-lg font-semibold text-white">Conversation History</h2>
                <span className="text-xs text-slate-400 ml-auto">{chatHistory.length} messages</span>
              </div>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {chatHistory.map(msg => (
                  <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-xl px-3 py-2 text-xs ${
                      msg.role === 'user'
                        ? 'bg-violet-600/30 text-violet-200 border border-violet-500/30'
                        : 'bg-slate-700 text-slate-300'
                    }`}>
                      <p>{msg.message}</p>
                      <p className="opacity-50 mt-1">{formatDateTime(msg.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right: Documents */}
        <div>
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-4 w-4 text-blue-400" />
              <h2 className="text-lg font-semibold text-white">Documents</h2>
              <span className="text-xs text-slate-400 ml-auto">{documents.length}/10</span>
            </div>
            {documents.length === 0 ? (
              <p className="text-slate-400 text-sm">No documents uploaded yet</p>
            ) : (
              <>
                <div className="space-y-3">
                  {documents.map(doc => (
                    <div key={doc.id} className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-xl">
                      <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4 text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-300">{DOC_LABELS[doc.document_type] || doc.document_type}</p>
                        <p className="text-xs text-slate-500 truncate">{doc.file_name}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => downloadDoc(doc)}
                        className="p-2 shrink-0"
                      >
                        <Download className="h-3.5 w-3.5 text-slate-400 hover:text-white" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  onClick={processDocuments}
                  loading={processing}
                  className="w-full mt-4 gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500"
                >
                  <Cog className="h-4 w-4" />
                  Process Documents
                </Button>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
