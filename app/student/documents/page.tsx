'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { DOCUMENT_TYPES } from '@/lib/utils'
import { Upload, FileText, CheckCircle, X, RefreshCw, Download } from 'lucide-react'
import toast from 'react-hot-toast'

interface UploadedDoc {
  id: string
  document_type: string
  file_name: string
  uploaded_at: string
  file_path: string
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<UploadedDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)

  const fetchDocuments = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('student_id', user.id)
      .order('uploaded_at', { ascending: false })

    setDocuments(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchDocuments() }, [fetchDocuments])

  const handleUpload = async (docType: string, file: File) => {
    setUploading(docType)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('Please login first'); return }

      const fileExt = file.name.split('.').pop()
      const filePath = `${user.id}/${docType}_${Date.now()}.${fileExt}`

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('student-documents')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      // Remove any existing doc of same type
      await supabase.from('documents').delete().eq('student_id', user.id).eq('document_type', docType)

      // Save record
      const { error: dbError } = await supabase.from('documents').insert({
        student_id: user.id,
        document_type: docType,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
      })

      if (dbError) throw dbError

      toast.success('Document uploaded successfully!')
      fetchDocuments()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      toast.error(msg)
    } finally {
      setUploading(null)
    }
  }

  const handleDelete = async (docId: string, filePath: string) => {
    try {
      const supabase = createClient()
      await supabase.storage.from('student-documents').remove([filePath])
      await supabase.from('documents').delete().eq('id', docId)
      toast.success('Document removed')
      fetchDocuments()
    } catch {
      toast.error('Failed to delete document')
    }
  }

  const getDocForType = (type: string) => documents.find(d => d.document_type === type)

  const uploadedCount = DOCUMENT_TYPES.filter(dt => getDocForType(dt.id)).length

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
            <p className="text-slate-400 text-sm">{uploadedCount} of {DOCUMENT_TYPES.length} documents uploaded</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchDocuments} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Upload Progress</span>
          <span className="text-white font-medium">{uploadedCount}/{DOCUMENT_TYPES.length}</span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-600 to-indigo-600 rounded-full transition-all duration-500"
            style={{ width: `${(uploadedCount / DOCUMENT_TYPES.length) * 100}%` }}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : (
        <div className="space-y-4">
          {DOCUMENT_TYPES.map(({ id, label }) => {
            const uploaded = getDocForType(id)
            const isUploading = uploading === id

            return (
              <Card key={id} className="p-0 overflow-hidden">
                <div className="p-5 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${uploaded ? 'bg-green-500/20' : 'bg-slate-700'}`}>
                    {uploaded
                      ? <CheckCircle className="h-5 w-5 text-green-400" />
                      : <FileText className="h-5 w-5 text-slate-400" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-medium text-sm">{label}</p>
                      {uploaded
                        ? <Badge variant="status" status="approved">Uploaded</Badge>
                        : <Badge variant="secondary">Required</Badge>
                      }
                    </div>
                    {uploaded && (
                      <p className="text-slate-400 text-xs mt-0.5 truncate">{uploaded.file_name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {uploaded && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(uploaded.id, uploaded.file_path)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-2"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        disabled={isUploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleUpload(id, file)
                          e.target.value = ''
                        }}
                      />
                      <span className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-xl transition-all duration-200 cursor-pointer ${
                        uploaded
                          ? 'border border-slate-600 hover:border-slate-500 text-slate-300 hover:text-white hover:bg-slate-800'
                          : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-500/25'
                      } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        {isUploading
                          ? <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                          : <Upload className="h-3.5 w-3.5" />
                        }
                        {uploaded ? 'Replace' : 'Upload'}
                      </span>
                    </label>
                  </div>
                </div>

                {/* Upload zone for drag and drop feel */}
                {!uploaded && (
                  <div className="mx-5 mb-5 border-2 border-dashed border-slate-600 rounded-xl p-4 text-center">
                    <label className="cursor-pointer block">
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        disabled={isUploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleUpload(id, file)
                          e.target.value = ''
                        }}
                      />
                      <p className="text-slate-400 text-xs">
                        Drag & drop or <span className="text-violet-400 hover:text-violet-300">click to browse</span>
                      </p>
                      <p className="text-slate-500 text-xs mt-1">PDF, JPG, PNG, DOC (max 10MB)</p>
                    </label>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {uploadedCount === DOCUMENT_TYPES.length && (
        <Card className="border-green-500/30 bg-green-500/5">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-green-400 shrink-0" />
            <div>
              <p className="text-green-400 font-medium">All documents submitted!</p>
              <p className="text-slate-400 text-sm">Your documents are under review by the admission team.</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
