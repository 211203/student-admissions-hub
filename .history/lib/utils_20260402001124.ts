import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(dateString: string) {
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  reviewing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  approved: 'bg-green-500/20 text-green-400 border-green-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
  scheduled: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
}

export const COURSES = [
  'Computer Science Engineering',
  'Data Science & AI',
  'Mechanical Engineering',
  'Civil Engineering',
  'Electrical Engineering',
  'Business Administration (MBA)',
  'Medical Sciences (MBBS)',
  'Law (LLB)',
  'Design & Architecture',
  'Biotechnology',
]

export const DOCUMENT_TYPES = [
  // Academic Documents (Required)
  { id: '10th_marksheet', label: '10th Marksheet', category: 'academic', required: true },
  { id: '12th_marksheet', label: '12th Marksheet', category: 'academic', required: true },
  { id: 'leaving_certificate', label: 'Leaving Certificate (LC/TC)', category: 'academic', required: true },
  
  // Entrance Exam Scorecards
  { id: 'mht_cet_scorecard', label: 'MHT-CET Scorecard', category: 'entrance', required: false },
  { id: 'jee_scorecard', label: 'JEE Scorecard', category: 'entrance', required: false },
  
  // Identity & Personal Documents (Required)
  { id: 'id_proof', label: 'ID Proof (Aadhar/PAN)', category: 'identity', required: true },
  { id: 'photo', label: 'Passport Photo', category: 'identity', required: true },
  
  // Category & Income Certificates (Optional)
  { id: 'caste_certificate', label: 'Caste Certificate', category: 'category', required: false },
  { id: 'income_certificate', label: 'Income Certificate', category: 'category', required: false },
  
  // Additional Documents (Optional)
  { id: 'gap_certificate', label: 'Gap Certificate', category: 'additional', required: false },
]

export const DOCUMENT_CATEGORIES = [
  { id: 'academic', label: 'Academic Documents', icon: 'GraduationCap' },
  { id: 'entrance', label: 'Entrance Exam Scores', icon: 'Award' },
  { id: 'identity', label: 'Identity Documents', icon: 'User' },
  { id: 'category', label: 'Category & Income Certificates', icon: 'FileCheck' },
  { id: 'additional', label: 'Additional Documents', icon: 'FolderPlus' },
]
