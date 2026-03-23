'use client'

import { AdminSidebar } from '@/components/layout/AdminSidebar'
import { AuthProvider } from '@/lib/hooks/useAuth'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="flex min-h-screen bg-slate-950">
        <AdminSidebar />
        <main className="flex-1 ml-64 min-h-screen overflow-y-auto">
          <div className="p-8">
            {children}
          </div>
        </main>
      </div>
    </AuthProvider>
  )
}
