import { motion } from 'motion/react'
import { cn } from '../lib/cn'

/**
 * A progress bar that eases into place. Used for the study-mode progress
 * track and any other "how far along am I" indicator where the value grows
 * from 0 to the target with a springing overshoot rather than a hard clip.
 */
export function AnimatedLine({
  value,
  className,
  color = 'accent',
}: {
  value: number
  className?: string
  color?: 'accent' | 'success' | 'warning' | 'danger' | 'info'
}) {
  const hue = {
    accent: [205, 215],
    success: [140, 150],
    warning: [38, 45],
    danger: [0, 12],
    info: [190, 200],
  }
  const values = hue[color] ?? hue.accent
  const a = values[0]
  return (
    <motion.div
      className={cn('h-full overflow-hidden rounded-[2px] bg-raised', className)}
      style={{ width: '100%', flexBasis: '100%' }}
    >
      <motion.div
        className="h-full rounded-[2px]"
        style={{
          width: '0%',
          background: `hsl(${a}deg ${64}% 58%)`,
          offsetPath: `path('M0 0 C 60 60, 140 140, 200 200')`,
        }}
        initial={{ width: 0 }}
        animate={{ width: Math.min(100, Math.max(0, value)) }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      />
    </motion.div>
  )
}
