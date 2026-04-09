'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { DOCUMENT_CATEGORIES, getDocumentTypesForStream } from '@/lib/utils'
import { STUDENT_DOCUMENTS_BUCKET } from '@/lib/supabase/storage'
import { Upload, FileText, CheckCircle, X, RefreshCw, GraduationCap, Award, User, FileCheck, FolderPlus, File, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  academic: <GraduationCap className="h-5 w-5" />,
  entrance: <Award className="h-5 w-5" />,
  identity: <User className="h-5 w-5" />,
  category: <FileCheck className="h-5 w-5" />,
  additional: <FolderPlus className="h-5 w-5" />,
}

interface UploadedDoc {
  id: string
  document_type: string
  file_name: string
  uploaded_at: string
  file_path: string
}

interface PendingApplication {
  student_id: string
  student_name: string
  student_email: string
  student_phone: string | null
  preferred_course: string
  academic_stream: string
  preferred_intake_year: string | null
  questions: string | null
}

export default function DocumentsPage() {
  const router = useRouter()
  const [documents, setDocuments] = useState<UploadedDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File>>({})
  const [uploading, setUploading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [hasApplication, setHasApplication] = useState<boolean | null>(null)
  const [academicStream, setAcademicStream] = useState<string | null>(null)
  const [pendingApplication, setPendingApplication] = useState<PendingApplication | null>(null)

  const docTypes = getDocumentTypesForStream(academicStream)

  const withTimeout = async <T,>(promise: Promise<T>, ms: number): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('timeout')), ms)
    })
    try {
      return await Promise.race([promise, timeoutPromise])
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    try {
      // First check for pending application in sessionStorage
      const pendingData = sessionStorage.getItem('pendingApplication')
      if (pendingData) {
        try {
          const parsed = JSON.parse(pendingData) as PendingApplication
          setPendingApplication(parsed)
          setHasApplication(true)
          setAcademicStream(parsed.academic_stream || 'PCM')
          setDocuments([])
          return
        } catch {
          // ignore parse errors
        }
      }

      // Fallback: check Supabase for existing application
      const supabase = createClient()
      const { data: { user } } = await withTimeout(supabase.auth.getUser(), 8000)
      if (!user) {
        setHasApplication(false)
        setDocuments([])
        return
      }

      const { data: appData } = await withTimeout(
        supabase
          .from('applications')
          .select('academic_stream')
          .eq('student_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        10000
      )

      if (!appData) {
        setHasApplication(false)
        setDocuments([])
        return
      }

      setHasApplication(true)
      setAcademicStream(appData.academic_stream || 'PCM')

      const { data } = await withTimeout(
        supabase
          .from('documents')
          .select('*')
          .eq('student_id', user.id)
          .order('uploaded_at', { ascending: false }),
        10000
      )

      setDocuments(data || [])
    } catch {
      // If we have pending application, use that
      const pendingData = sessionStorage.getItem('pendingApplication')
      if (pendingData) {
        try {
          const parsed = JSON.parse(pendingData) as PendingApplication
          setPendingApplication(parsed)
          setHasApplication(true)
          setAcademicStream(parsed.academic_stream || 'PCM')
          setDocuments([])
          return
        } catch {
          // ignore
        }
      }
      setHasApplication(false)
      setDocuments([])
      toast.error('Unable to load documents right now. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchDocuments() }, [fetchDocuments])

  // Select a file locally (not uploaded yet)
  const handleSelectFile = (docType: string, file: File) => {
    setSelectedFiles(prev => ({ ...prev, [docType]: file }))
  }

  // Remove a selected file
  const handleRemoveSelected = (docType: string) => {
    setSelectedFiles(prev => {
      const updated = { ...prev }
      delete updated[docType]
      return updated
    })
  }

  // Upload all selected files and trigger n8n webhook for text extraction
  const handleUploadAndExtract = async () => {
    const filesToUpload = Object.entries(selectedFiles)
    if (filesToUpload.length === 0) {
      toast.error('Please select at least one document')
      return
    }

    setUploading(true)
    try {
      // Get student ID from pending application or try to get user
      let studentId = pendingApplication?.student_id
      let studentName = pendingApplication?.student_name || 'Unknown'
      let studentEmail = pendingApplication?.student_email || ''
      let studentPhone = pendingApplication?.student_phone || 'N/A'
      let preferredCourse = pendingApplication?.preferred_course || 'N/A'
      let streamValue = pendingApplication?.academic_stream || academicStream || 'N/A'
      let preferredIntakeYear = pendingApplication?.preferred_intake_year || 'N/A'
      let questions = pendingApplication?.questions || ''

      const supabase = createClient()
      
      // If no pending application, try to get user from Supabase
      if (!studentId) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { 
          toast.error('Please login first')
          setUploading(false)
          return 
        }
        studentId = user.id
        studentEmail = user.email || ''
      }

      console.log('[upload] Starting upload for', filesToUpload.length, 'files')
      console.log('[upload] Student ID:', studentId)

      // Upload files to Supabase storage and collect metadata
      const uploadedDocs: { docType: string; filePath: string; fileName: string; signedUrl: string }[] = []

      for (const [docType, file] of filesToUpload) {
        const fileExt = file.name.split('.').pop()
        const filePath = `${studentId}/${docType}_${Date.now()}.${fileExt}`

        console.log('[upload] Uploading:', docType, '->', filePath, 'size:', file.size)

        const { error: uploadError, data: uploadData } = await supabase.storage
          .from(STUDENT_DOCUMENTS_BUCKET)
          .upload(filePath, file, { upsert: true })

        if (uploadError) {
          console.error('[upload] Storage upload error:', uploadError)
          toast.error(`Upload failed: ${uploadError.message}`)
          throw uploadError
        }

        console.log('[upload] Upload success:', uploadData)

        // Get signed URL (valid for 1 hour)
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from(STUDENT_DOCUMENTS_BUCKET)
          .createSignedUrl(filePath, 3600)

        if (signedUrlError) {
          console.error('Signed URL error:', signedUrlError)
        }

        // Remove any existing doc of same type and save new record
        await supabase.from('documents').delete().eq('student_id', studentId).eq('document_type', docType)
        
        const { error: dbError } = await supabase.from('documents').insert({
          student_id: studentId,
          document_type: docType,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
        })

        if (dbError) {
          console.error('[upload] DB insert error:', dbError)
        }

        uploadedDocs.push({
          docType,
          filePath,
          fileName: file.name,
          signedUrl: signedUrlData?.signedUrl || '',
        })
      }

      toast.success(`${uploadedDocs.length} document(s) uploaded successfully!`)

      // Send to n8n webhook with signed URLs
      setExtracting(true)
      
      const webhookUrl = process.env.NEXT_PUBLIC_N8N_DOCUMENT_WEBHOOK_URL || '/api/extract-documents'
      console.log('[upload] Sending to webhook:', webhookUrl)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)

      const webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          studentName,
          studentEmail,
          studentPhone,
          preferredCourse,
          academicStream: streamValue,
          preferredIntakeYear,
          questions,
          documents: uploadedDocs,
          timestamp: new Date().toISOString(),
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      console.log('[upload] Webhook response status:', webhookResponse.status)

      if (webhookResponse.ok) {
        toast.success('Documents sent for processing!')
        sessionStorage.removeItem('pendingApplication')
        setSelectedFiles({})
        router.push('/student/dashboard')
      } else {
        const errorText = await webhookResponse.text()
        console.error('[upload] Webhook error:', errorText)
        toast.error('Upload successful, but processing request failed')
      }

    } catch (err: unknown) {
      console.error('[upload] Error:', err)
      if (err instanceof Error && err.name === 'AbortError') {
        toast.error('Request timed out. Please try again.')
      } else {
        toast.error('Submission failed. Please try again.')
      }
    } finally {
      setUploading(false)
      setExtracting(false)
    }
  }

  const handleDelete = async (docId: string, filePath: string) => {
    try {
      const supabase = createClient()
      await supabase.storage.from(STUDENT_DOCUMENTS_BUCKET).remove([filePath])
      await supabase.from('documents').delete().eq('id', docId)
      toast.success('Document removed')
      fetchDocuments()
    } catch {
      toast.error('Failed to delete document')
    }
  }

  const getDocForType = (type: string) => documents.find(d => d.document_type === type)

  const requiredDocs = docTypes.filter(dt => dt.required)
  const uploadedRequiredCount = requiredDocs.filter(dt => getDocForType(dt.id)).length
  const uploadedTotalCount = docTypes.filter(dt => getDocForType(dt.id)).length

  const getDocsForCategory = (categoryId: string) =>
    docTypes.filter(dt => dt.category === categoryId)

  if (hasApplication === false) {
    return (
      <div className="max-w-3xl mx-auto space-y-8">
        <Card className="border-amber-500/30 bg-amber-500/5">
          <div className="space-y-3">
            <p className="text-amber-300 font-medium">Submit your application first</p>
            <p className="text-slate-300 text-sm">
              You can upload documents only after you submit the “Apply for Course” form.
            </p>
            <div className="flex gap-3">
              <Button onClick={() => router.push('/student/apply')}>Go to Apply Form</Button>
              <Button variant="ghost" onClick={fetchDocuments} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center">
            <Upload className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Upload Documents</h1>
            <p className="text-slate-400 text-sm">
              {uploadedRequiredCount} of {requiredDocs.length} required documents uploaded
              {uploadedTotalCount > uploadedRequiredCount && ` • ${uploadedTotalCount - uploadedRequiredCount} optional`}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchDocuments} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Progress bar - Required documents */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Required Documents Progress</span>
          <span className="text-white font-medium">{uploadedRequiredCount}/{requiredDocs.length}</span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-600 to-indigo-600 rounded-full transition-all duration-500"
            style={{ width: `${(uploadedRequiredCount / requiredDocs.length) * 100}%` }}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : (
        <div className="space-y-6">
          {DOCUMENT_CATEGORIES.map((category) => {
            const categoryDocs = getDocsForCategory(category.id)
            if (categoryDocs.length === 0) return null

            return (
              <div key={category.id} className="space-y-3">
                {/* Category Header */}
                <div className="flex items-center gap-2 px-1">
                  <div className="text-violet-400">
                    {CATEGORY_ICONS[category.id]}
                  </div>
                  <h2 className="text-lg font-semibold text-white">{category.label}</h2>
                  <span className="text-slate-500 text-sm">
                    ({categoryDocs.filter(dt => getDocForType(dt.id) || selectedFiles[dt.id]).length}/{categoryDocs.length})
                  </span>
                </div>

                {/* Documents in Category */}
                <div className="space-y-3">
                  {categoryDocs.map(({ id, label, required }) => {
                    const uploaded = getDocForType(id)
                    const selected = selectedFiles[id]

                    return (
                      <Card key={id} className="p-0 overflow-hidden">
                        <div className="p-5 flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            uploaded ? 'bg-green-500/20' : selected ? 'bg-blue-500/20' : 'bg-slate-700'
                          }`}>
                            {uploaded
                              ? <CheckCircle className="h-5 w-5 text-green-400" />
                              : selected
                                ? <File className="h-5 w-5 text-blue-400" />
                                : <FileText className="h-5 w-5 text-slate-400" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-white font-medium text-sm">{label}</p>
                              {uploaded
                                ? <Badge variant="status" status="approved">Uploaded</Badge>
                                : selected
                                  ? <Badge variant="primary">Selected</Badge>
                                  : required 
                                    ? <Badge variant="secondary">Required</Badge>
                                    : <Badge variant="ghost">Optional</Badge>
                              }
                            </div>
                            {uploaded && (
                              <p className="text-slate-400 text-xs mt-0.5 truncate">{uploaded.file_name}</p>
                            )}
                            {selected && !uploaded && (
                              <p className="text-blue-400 text-xs mt-0.5 truncate">{selected.name}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {/* Delete uploaded document */}
                            {uploaded && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(uploaded.id, uploaded.file_path)}
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-2"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                            {/* Remove selected file */}
                            {selected && !uploaded && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveSelected(id)}
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-2"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                            {/* Choose File button */}
                            <label className="cursor-pointer">
                              <input
                                type="file"
                                className="hidden"
                                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                disabled={uploading}
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) handleSelectFile(id, file)
                                  e.target.value = ''
                                }}
                              />
                              <span className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-xl transition-all duration-200 cursor-pointer ${
                                uploaded || selected
                                  ? 'border border-slate-600 hover:border-slate-500 text-slate-300 hover:text-white hover:bg-slate-800'
                                  : 'border border-violet-500/50 hover:border-violet-400 text-violet-400 hover:text-violet-300 hover:bg-violet-500/10'
                              } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                <File className="h-3.5 w-3.5" />
                                {uploaded ? 'Replace' : selected ? 'Change' : 'Choose File'}
                              </span>
                            </label>
                          </div>
                        </div>

                        {/* Drop zone hint for empty documents */}
                        {!uploaded && !selected && (
                          <div className="mx-5 mb-5 border-2 border-dashed border-slate-600 rounded-xl p-4 text-center">
                            <label className="cursor-pointer block">
                              <input
                                type="file"
                                className="hidden"
                                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                disabled={uploading}
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) handleSelectFile(id, file)
                                  e.target.value = ''
                                }}
                              />
                              <p className="text-slate-400 text-xs">
                                <span className="text-violet-400 hover:text-violet-300">Click to browse</span> or drag & drop
                              </p>
                              <p className="text-slate-500 text-xs mt-1">PDF, JPG, PNG, DOC (max 10MB)</p>
                            </label>
                          </div>
                        )}
                      </Card>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Selected Files Summary & Upload Button */}
      {Object.keys(selectedFiles).length > 0 && (
        <Card className="border-violet-500/30 bg-violet-500/5">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">
                  {Object.keys(selectedFiles).length} file(s) selected
                </p>
                <p className="text-slate-400 text-sm">
                  Ready to upload and extract text
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedFiles({})}
                className="text-slate-400 hover:text-white"
              >
                Clear All
              </Button>
            </div>
            
            {/* List selected files */}
            <div className="flex flex-wrap gap-2">
              {Object.entries(selectedFiles).map(([docType, file]) => {
                const docLabel = docTypes.find(d => d.id === docType)?.label || docType
                return (
                  <span
                    key={docType}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 rounded-lg text-xs text-slate-300"
                  >
                    <File className="h-3 w-3 text-violet-400" />
                    {docLabel}
                    <button
                      onClick={() => handleRemoveSelected(docType)}
                      className="ml-1 text-slate-500 hover:text-red-400"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )
              })}
            </div>

            {/* Upload & Extract Button */}
            <Button
              onClick={handleUploadAndExtract}
              disabled={uploading || extracting}
              className="w-full gap-2"
            >
              {uploading ? (
                <>
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Uploading...
                </>
              ) : extracting ? (
                <>
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Extracting Text...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload & Extract Text
                </>
              )}
            </Button>
          </div>
        </Card>
      )}

      {uploadedRequiredCount === requiredDocs.length && (
        <Card className="border-green-500/30 bg-green-500/5">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-green-400 shrink-0" />
            <div>
              <p className="text-green-400 font-medium">All required documents submitted!</p>
              <p className="text-slate-400 text-sm">
                Your documents are under review. You may also upload optional documents like entrance exam scores or certificates.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
