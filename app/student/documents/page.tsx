'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { DOCUMENT_CATEGORIES, getDocumentTypesForStream } from '@/lib/utils'
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


export default function DocumentsPage() {
  const [documents, setDocuments] = useState<UploadedDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File>>({})
  const [uploading, setUploading] = useState(false)
  const isFetchingRef = useRef(false)
  const lastSilentFetchAtRef = useRef(0)
  const docTypes = getDocumentTypesForStream('PCM')

  const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`timeout:${label}`)), ms)
    })
    try {
      return await Promise.race([promise, timeoutPromise])
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }


  const fetchDocuments = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true
    const now = Date.now()

    if (silent && now - lastSilentFetchAtRef.current < 30000) {
      return
    }
    if (isFetchingRef.current) {
      return
    }

    isFetchingRef.current = true
    if (!silent) {
      setLoading(true)
    }
    try {
      const listRes = await withTimeout(fetch('/api/storage/list', { cache: 'no-store' }), 20000, 'storage list')
      if (!listRes.ok) {
        throw new Error(await listRes.text())
      }
      const listJson = (await listRes.json()) as { documents: UploadedDoc[] }
      setDocuments(listJson.documents || [])
      if (silent) {
        lastSilentFetchAtRef.current = now
      }
    } catch {
      setDocuments([])
      if (!silent) {
        toast.error('Unable to load documents right now. Please try again.')
      }
    } finally {
      isFetchingRef.current = false
      if (!silent) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => { fetchDocuments() }, [fetchDocuments])

  useEffect(() => {
    const onFocus = () => {
      fetchDocuments({ silent: true })
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchDocuments({ silent: true })
      }
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [fetchDocuments])

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

  // Upload all selected files (DB + Storage only). Processing is admin-only.
  const handleUploadAndExtract = async () => {
    const filesToUpload = Object.entries(selectedFiles)
    if (filesToUpload.length === 0) {
      toast.error('Please select at least one document')
      return
    }

    setUploading(true)
    try {
      console.log('[upload] Starting upload for', filesToUpload.length, 'files')

      // Upload goes through /api/storage/upload which writes Storage + documents table.

      // Upload files to Supabase storage + documents table
      const uploadedDocs: { docType: string; filePath: string; fileName: string; signedUrl: string }[] = []

      for (const [docType, file] of filesToUpload) {
        console.log('[upload] Uploading:', docType, 'size:', file.size)

        const formData = new FormData()
        formData.set('docType', docType)
        formData.set('file', file)

        const uploadRes = await withTimeout(
          fetch('/api/storage/upload', { method: 'POST', body: formData }),
          90000,
          `storage upload (${docType})`
        )

        console.log('[upload] Upload finished for', docType)

        if (!uploadRes.ok) {
          const errText = await uploadRes.text()
          console.error('[upload] Storage upload error:', errText)
          throw new Error(errText || `Upload failed for ${docType}`)
        }

        const uploadJson = (await uploadRes.json()) as {
          docType: string
          filePath: string
          fileName: string
          signedUrl: string
        }

        const meta = {
          docType: uploadJson.docType,
          filePath: uploadJson.filePath,
          fileName: uploadJson.fileName,
          signedUrl: uploadJson.signedUrl,
        }

        uploadedDocs.push(meta)
      }

      toast.success(`${uploadedDocs.length} document(s) uploaded successfully!`)

      // Reflect uploaded state immediately in UI
      setSelectedFiles({})
      try {
        await fetchDocuments()
      } catch {
        // keep UI responsive even if refresh fails
      }

      toast.success('Documents uploaded successfully!')

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      const isAbort = err instanceof Error && err.name === 'AbortError'
      const isTimeout = msg.startsWith('timeout:')

      // Avoid console.error for expected timeout/abort cases (Next shows scary overlays)
      if (!isAbort && !isTimeout) {
        console.error('[upload] Error:', err)
      }

      if (isAbort) {
        toast.error('Request timed out. Please try again.')
      } else if (isTimeout) {
        toast.error(`Timed out: ${msg.replace('timeout:', '')}`)
      } else {
        toast.error(msg || 'Submission failed. Please try again.')
      }
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (docId: string, filePath: string) => {
    try {
      const docType = documents.find((d) => d.id === docId)?.document_type
      const res = await fetch('/api/storage/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docIds: [docId], filePaths: [filePath] }),
      })
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string
        deletedIds?: string[]
      }
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to delete document')
      }
      if (!Array.isArray(payload.deletedIds) || !payload.deletedIds.includes(docId)) {
        throw new Error('Document delete did not persist')
      }
      if (docType) {
        setSelectedFiles((prev) => {
          const updated = { ...prev }
          delete updated[docType]
          return updated
        })
      }
      setDocuments((prev) => prev.filter((doc) => doc.id !== docId))
      toast.success('Document removed')
      fetchDocuments({ silent: true })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete document'
      toast.error(msg)
    }
  }

  const getDocForType = (type: string) => documents.find(d => d.document_type === type)

  const requiredDocs = docTypes.filter(dt => dt.required)
  const uploadedRequiredCount = requiredDocs.filter(dt => getDocForType(dt.id)).length
  const uploadedTotalCount = docTypes.filter(dt => getDocForType(dt.id)).length

  const getDocsForCategory = (categoryId: string) =>
    docTypes.filter(dt => dt.category === categoryId)

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
            style={{ width: `${requiredDocs.length ? (uploadedRequiredCount / requiredDocs.length) * 100 : 0}%` }}
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
                  Ready to upload
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

            {/* Upload Button */}
            <Button
              onClick={handleUploadAndExtract}
              disabled={uploading}
              className="w-full gap-2"
            >
              {uploading ? (
                <>
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload Documents
                </>
              )}
            </Button>
          </div>
        </Card>
      )}

      {requiredDocs.length > 0 && uploadedRequiredCount === requiredDocs.length && (
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
