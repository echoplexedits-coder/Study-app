import { type ReactNode, type ElementType } from 'react'
import { motion } from 'motion/react'
import { cn } from '../lib/cn'

/**
 * A shared card with a lift and shadow transition on hover. Nothing
 * unfocused gets a spoiler — it is only a gentle raise so the eye knows this
 * element is interactive, plus a one-pixel lift that moves the shadow with it.
 */
export function HoverCard({
  children,
  className,
  as: Component = 'section',
  ...rest
}: {
  children: ReactNode
  className?: string
  as?: ElementType
  [key: string]: unknown
}) {
  return (
    <Component
      className={cn(
        'group rounded-card bg-surface shadow-card transition-shadow duration-300 hover:shadow-elevated',
        className
      )}
      {...rest}
    >
      {children}
    </Component>
  )
}

/**
 * Buttons that press down and fill on the tap, with a controlled hover fill
 * when the parent wants a richer interaction.
 */
export function PressButton({ children, className, variant = 'secondary', ...rest }: { children?: ReactNode; className?: string; variant?: 'primary' | 'secondary' } & Record<string, unknown>) {
  return (
    <motion.button
      whileTap={{ scale: 0.975 }}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center gap-1.5 rounded-control font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent',
        variant === 'primary' && 'bg-accent text-white hover:bg-accent-deep',
        variant === 'secondary' && 'border border-line-strong bg-surface text-fg hover:bg-surface-2',
        className
      )}
      type="button"
      {...{ ...rest, onDrag: undefined }}
    >
      {children}
    </motion.button>
  )
}

/**
 * A decorative cursor line that follows the pointer on desktop and becomes a
 * single thin track for touch. It only exists to make interactive islands
 * feel honest; it never hides content.
 */
export function CursorLine({ className }: { className?: string }) {
  return (
    <motion.div
      aria-hidden
      className={cn('pointer-events-none absolute bottom-[0.7rem] left-0 h-[1.4rem] w-[1.4rem] rounded-full bg-surface/80 shadow-[0_0_0_1px_var(--color-line-strong)_fade-in) ', className)}
      style={{
        translateY: '100%',
        transformOrigin: 'bottom left',
      }}
    />
  )
}
