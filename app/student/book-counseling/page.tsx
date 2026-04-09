'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CalendarDays, Clock, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { format, addDays, startOfDay, isBefore, isToday, isSameDay } from 'date-fns'

const TIME_SLOTS = [
  '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM', '02:00 PM', '02:30 PM',
  '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM',
]

export default function BookCounselingPage() {
  const { profile } = useAuth()
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [booked, setBooked] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)

  const today = startOfDay(new Date())

  // Generate next 14 days from today (excluding Sundays)
  const availableDays: Date[] = []
  let day = addDays(today, 0)
  let count = 0
  while (availableDays.length < 14 + weekOffset * 5) {
    if (day.getDay() !== 0) availableDays.push(day) // skip Sunday
    day = addDays(day, 1)
    count++
    if (count > 60) break
  }

  const weekDays = availableDays.slice(weekOffset * 5, weekOffset * 5 + 5)

  const handleBook = async () => {
    if (!selectedDate || !selectedTime) {
      toast.error('Please select a date and time')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const payload = {
        student_id: user.id,
        student_name: profile?.full_name,
        student_email: profile?.email,
        scheduled_date: format(selectedDate, 'yyyy-MM-dd'),
        scheduled_time: selectedTime,
        notes: notes,
        status: 'scheduled',
      }

      const { error } = await supabase.from('counseling_sessions').insert(payload)
      if (error) throw error

      // Send to n8n webhook
      try {
        await fetch('/api/webhook/counseling', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, timestamp: new Date().toISOString() }),
        })
      } catch {
        // non-blocking
      }

      setBooked(true)
      toast.success('Counseling session booked!')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Booking failed'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  if (booked) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-6">
        <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="h-10 w-10 text-amber-400" />
        </div>
        <h1 className="text-3xl font-bold text-white">Session Booked!</h1>
        <Card className="text-left">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-amber-400" />
              <div>
                <p className="text-slate-400 text-xs">Date</p>
                <p className="text-white font-medium">{selectedDate && format(selectedDate, 'EEEE, MMMM d, yyyy')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-400" />
              <div>
                <p className="text-slate-400 text-xs">Time</p>
                <p className="text-white font-medium">{selectedTime}</p>
              </div>
            </div>
          </div>
        </Card>
        <p className="text-slate-400 text-sm">A confirmation has been sent to your email. Our counselor will meet you at the scheduled time.</p>
        <Button onClick={() => { setBooked(false); setSelectedDate(null); setSelectedTime(null); setNotes('') }} variant="outline">
          Book Another Session
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center">
          <CalendarDays className="h-6 w-6 text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Book Counseling Session</h1>
          <p className="text-slate-400 text-sm">Select a convenient date and time to meet with a counselor</p>
        </div>
      </div>

      {/* Calendar */}
      <Card>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white">Pick a Date</h2>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
              disabled={weekOffset === 0}
              className="p-2"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWeekOffset(weekOffset + 1)}
              className="p-2"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {weekDays.map((d) => {
            const isPast = isBefore(d, today) && !isToday(d)
            const isSelected = selectedDate ? isSameDay(d, selectedDate) : false

            return (
              <button
                key={d.toISOString()}
                onClick={() => !isPast && setSelectedDate(d)}
                disabled={isPast}
                className={`p-3 rounded-xl text-center transition-all duration-200 ${
                  isSelected
                    ? 'bg-gradient-to-br from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-500/25'
                    : isPast
                    ? 'opacity-30 cursor-not-allowed'
                    : isToday(d)
                    ? 'border border-amber-500/50 text-amber-300 hover:bg-amber-500/10'
                    : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <p className="text-xs font-medium">{format(d, 'EEE')}</p>
                <p className="text-lg font-bold">{format(d, 'd')}</p>
                <p className="text-xs opacity-70">{format(d, 'MMM')}</p>
              </button>
            )
          })}
        </div>
      </Card>

      {/* Time Slots */}
      {selectedDate && (
        <Card>
          <h2 className="text-lg font-semibold text-white mb-5">
            Available Times for {format(selectedDate, 'MMMM d')}
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {TIME_SLOTS.map((slot) => (
              <button
                key={slot}
                onClick={() => setSelectedTime(slot)}
                className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border ${
                  selectedTime === slot
                    ? 'bg-gradient-to-br from-amber-600 to-orange-600 border-transparent text-white shadow-lg shadow-amber-500/25'
                    : 'border-slate-600 text-slate-300 hover:border-slate-500 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Clock className="h-3 w-3 inline mr-1 mb-0.5" />
                {slot}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Notes & Confirm */}
      {selectedDate && selectedTime && (
        <Card>
          <h2 className="text-lg font-semibold text-white mb-4">Additional Notes</h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything specific you'd like to discuss in the counseling session? (optional)"
            rows={3}
            className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none text-sm"
          />

          <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <p className="text-amber-300 text-sm font-medium mb-1">Booking Summary</p>
            <p className="text-slate-300 text-sm">{format(selectedDate, 'EEEE, MMMM d, yyyy')} at {selectedTime}</p>
          </div>

          <div className="mt-4 flex justify-end">
            <Button onClick={handleBook} loading={loading} size="lg" className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-lg shadow-amber-500/25 gap-2">
              <CalendarDays className="h-4 w-4" />
              Confirm Booking
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
