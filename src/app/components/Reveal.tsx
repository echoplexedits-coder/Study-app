import { useEffect, useState, useRef, type ReactElement, type ReactNode, default as React } from 'react'
import { motion } from 'motion/react'
import { cn } from '../lib/cn'

/**
 * After page load the router swaps sections instantly. This tiny harness keeps
 * every major screen alive with a short fade/slide: it plays once, then
 * leaves the element in its final state so the router's own animations take
 * over the entrance where they belong.
 */
export function ScreenFade({ children, className }: { children: ReactNode; className?: string }) {
  const [done, setDone] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setDone(true), 60)
    return () => window.clearTimeout(id)
  }, [])
  if (!done) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className={cn('select-none', className)}
      >
        {children}
      </motion.div>
    )
  }
  return <div className={cn('select-none', className)}>{children}</div>
}

/**
 * A lightweight reveal that uses the browser's IntersectionObserver when it is
 * available and falls back to immediate render otherwise. The entry fades and
 * slides up a small, consistent distance; nothing bounces.
 */
export function Reveal({
  children,
  delay = 0,
  duration = 0.55,
  direction = 'up',
  className,
}: {
  children: ReactNode
  delay?: number
  duration?: number
  direction?: 'up' | 'right' | 'down' | 'left' | 'fade'
  className?: string
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <div
        className={cn(
          'transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
          direction !== 'fade' && `translate-y-[calc(100%)]`,
          className
        )}
      >
        {children}
      </div>
    )
  }

  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { threshold: 0.25 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <motion.div
      ref={ref}
      initial={!inView}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
      transition={{ duration, ease: [0.22, 1, 0.36, 1], delay }}
      className={cn(
        'transition-[opacity,transform] duration-500',
        direction === 'up' && 'translate-y-12',
        direction === 'right' && 'translate-x-12',
        direction === 'down' && 'translate-y-12',
        direction === 'left' && 'translate-x-12',
        direction === 'fade' && 'translate-y-0',
        className
      )}
    >
      {children}
    </motion.div>
  )
}

/**
 * A staggered sibling stack. Give it an array of children and every
 * descendant that renders a Reveal gets a small increment so content lands
 * progressively instead of all at once.
 */
export function Stagger({ children, start = 0 }: { children: ReactNode; start?: number }) {
  const items = React.Children.toArray(children)
  return (
    <div className="flex flex-col gap-6">
      {items.map((child, i) => {
        if (child === null || child === undefined) return null
        const element = child as ReactElement
        const delay = element && 'props' in element && typeof (element.props as Record<string, unknown>).delay !== 'undefined' ? (element.props as Record<string, unknown>).delay : undefined
        return (
          <Reveal key={i} delay={delay !== undefined ? (delay as number) : i * 0.08 + start}>
            {element}
          </Reveal>
        )
      })}
    </div>
  )
}
