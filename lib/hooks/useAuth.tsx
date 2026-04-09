'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

export interface StudentProfile {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  avatar_url: string | null
  last_login_at: string | null
}

export interface AdminProfile {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  avatar_url: string | null
  department: string | null
  last_login_at: string | null
}

export interface Profile {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  role: 'student' | 'admin'
  avatar_url: string | null
}

export interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

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

  const fetchProfile = async (userId: string) => {
    // Try to get admin profile first (ignore errors - user might not have access)
    try {
      const { data: adminRows, error: adminError } = await supabase
        .from('admin_profiles')
        .select('*')
        .eq('id', userId)
        .limit(1)

      const adminData = adminRows?.[0]
      if (adminData && !adminError) {
        // Update last_login_at for admin
        await supabase
          .from('admin_profiles')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', userId)

        return { ...adminData, role: 'admin' as const }
      }
    } catch (e) {
      // Ignore - user is not an admin
    }

    // Try student profile
    try {
      const { data: studentRows, error: studentError } = await supabase
        .from('student_profiles')
        .select('*')
        .eq('id', userId)
        .limit(1)

      const studentData = studentRows?.[0]
      if (studentData && !studentError) {
        // Update last_login_at for student
        await supabase
          .from('student_profiles')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', userId)

        return { ...studentData, role: 'student' as const }
      }
    } catch (e) {
      // Ignore
    }

    // Try generic profiles table as fallback
    try {
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .limit(1)

      const profileData = profileRows?.[0]
      if (profileData) {
        return { ...profileData, role: 'student' as const }
      }
    } catch (e) {
      // Ignore
    }

    return null
  }

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user } } = await withTimeout(supabase.auth.getUser(), 8000)
        setUser(user)
        if (user) {
          const profileData = await fetchProfile(user.id)
          setProfile(profileData)
        }
      } catch {
        setUser(null)
        setProfile(null)
      } finally {
        setLoading(false)
      }
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        const profileData = await fetchProfile(session.user.id)
        setProfile(profileData)
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
