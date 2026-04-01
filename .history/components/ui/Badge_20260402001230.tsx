import { cn, STATUS_COLORS } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'status' | 'primary' | 'secondary' | 'ghost'
  status?: string
  className?: string
}

export function Badge({ children, variant = 'secondary', status, className }: BadgeProps) {
  if (variant === 'status' && status) {
    return (
      <span className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize',
        STATUS_COLORS[status] || STATUS_COLORS.pending,
        className
      )}>
        {children}
      </span>
    )
  }

  const variants = {
    primary: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
    secondary: 'bg-slate-700 text-slate-300 border-slate-600',
    ghost: 'bg-slate-800/50 text-slate-500 border-slate-700',
  }

  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
      variants[variant as keyof typeof variants],
      className
    )}>
      {children}
    </span>
  )
}
