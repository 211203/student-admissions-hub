'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { formatDateTime } from '@/lib/utils'
import { MessageSquare, Bot, User, Trash2, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'

interface Message {
  id?: string
  role: 'user' | 'assistant'
  message: string
  created_at?: string
}

const WELCOME_MESSAGE: Message = {
  role: 'assistant',
  message: "👋 Hi! I'm your **Admission AI Assistant**. I can help you with:\n\n- Course information and eligibility\n- Application process and deadlines\n- Fee structure and scholarships\n- Document requirements\n- Counseling session guidance\n\nWhat would you like to know?",
  created_at: new Date().toISOString(),
}

export default function ChatPage() {
  const { profile } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [historLoading, setHistoryLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const persistMessage = async (role: 'user' | 'assistant', message: string) => {
    const res = await fetch('/api/chat/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, message }),
    })
    const data = await res.json().catch(() => ({} as { error?: string; message?: Message }))
    if (!res.ok || !data.message) {
      throw new Error(data.error || 'Failed to save chat message')
    }
    return data.message
  }

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch('/api/chat/messages', { cache: 'no-store' })
        const data = await res.json().catch(() => ({} as { messages?: Message[]; error?: string }))
        if (!res.ok) {
          setMessages([WELCOME_MESSAGE])
          setHistoryLoading(false)
          return
        }
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages)
        } else {
          setMessages([WELCOME_MESSAGE])
        }
      } catch {
        setMessages([WELCOME_MESSAGE])
      }
      setHistoryLoading(false)
    }
    fetchHistory()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    setLoading(true)

    try {
      const savedUserMessage = await persistMessage('user', userMessage)
      setMessages(prev => [...prev, savedUserMessage])

      const res = await fetch('/api/webhook/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          query: userMessage,
          studentName: profile?.full_name,
          studentEmail: profile?.email,
          history: [...messages, savedUserMessage].slice(-6).map(m => ({ role: m.role, content: m.message })),
        }),
      })

      const data = await res.json().catch(() => ({} as { reply?: string; message?: string; error?: string }))
      if (!res.ok) {
        throw new Error(data.error || 'AI webhook request failed')
      }

      const assistantReply = (data.reply || data.message || '').trim()
      if (!assistantReply) {
        throw new Error('AI webhook returned empty response')
      }

      const savedAssistantMessage = await persistMessage('assistant', assistantReply)
      setMessages(prev => [...prev, savedAssistantMessage])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send message. Please try again.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const clearChat = async () => {
    try {
      const res = await fetch('/api/chat/clear', { method: 'POST' })
      const data = await res.json().catch(() => ({} as { error?: string }))
      if (!res.ok) {
        throw new Error(data.error || 'Failed to clear chat history')
      }
      setMessages([WELCOME_MESSAGE])
      toast.success('Chat history cleared')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to clear chat history'
      toast.error(msg)
    }
  }

  const formatMessage = (text: string) => {
    return text.split('\n').map((line, i) => (
      <span key={i}>
        {line.split('**').map((part, j) =>
          j % 2 === 1 ? <strong key={j}>{part}</strong> : part
        )}
        {i < text.split('\n').length - 1 && <br />}
      </span>
    ))
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
            <MessageSquare className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">AI Admission Assistant</h1>
            <p className="text-slate-400 text-sm">Ask anything about admissions, courses, and more</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={clearChat} className="gap-2 text-slate-400 hover:text-red-400">
          <Trash2 className="h-4 w-4" />
          Clear
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {historLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-full flex items-center justify-center shrink-0 mt-1">
                  <Bot className="h-4 w-4 text-white" />
                </div>
              )}
              <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-tr-none'
                  : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-none'
              }`}>
                <p className="text-sm leading-relaxed">{formatMessage(msg.message)}</p>
                {msg.created_at && (
                  <p className="text-xs mt-1.5 opacity-50">{formatDateTime(msg.created_at)}</p>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-full flex items-center justify-center shrink-0 mt-1">
                  <User className="h-4 w-4 text-white" />
                </div>
              )}
            </div>
          ))
        )}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-full flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-tl-none px-4 py-3">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="mt-4 flex gap-3 bg-slate-800/80 border border-slate-700 rounded-2xl p-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
          placeholder="Ask about courses, fees, eligibility, deadlines..."
          className="flex-1 bg-transparent px-3 py-2 text-white placeholder-slate-400 focus:outline-none text-sm"
          disabled={loading}
        />
        <Button onClick={sendMessage} loading={loading} size="sm" className="shrink-0 gap-2">
          <Sparkles className="h-3.5 w-3.5" />
          Send
        </Button>
      </div>
      <p className="text-xs text-slate-500 text-center mt-2">Press Enter to send • AI responses may not be 100% accurate</p>
    </div>
  )
}
