import { useEffect, useRef } from 'react'

/**
 * Marks every reveal group as visible once the document has finished loading,
 * so the initial batch of sections animates in rather than sitting invisible.
 *
 * The IntersectionObserver used by the child Reveal components then carries the
 * remaining sections through the page as the user scrolls. This two-stage
 * approach keeps the first screen feeling immediate and the rest feeling like
 * a continuous story.
 */
export function ScrollRevealRoot() {
  const root = useRef<HTMLDivElement | null>(null)
  const marked = useRef(new Set<string>())

  useEffect(() => {
    const el = document.querySelector<HTMLDivElement>('[data-reveal-root]')
    if (!el) return
    root.current = el

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const target = entry.target as HTMLElement
          const groups = target.querySelectorAll<HTMLElement>('.reveal-up, .reveal-right, .reveal-down, .reveal-left, .reveal-fade')
          for (const group of groups) {
            const id = group.dataset.revealId ?? ''
            if (!id) continue
            if (marked.current.has(id)) continue
            marked.current.add(id)
            group.classList.add('is-visible')
          }
          observer.unobserve(target)
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -6% 0px' }
    )

    el.querySelectorAll('.reveal-up, .reveal-right, .reveal-down, .reveal-left, .reveal-fade').forEach((el2) => {
      const target = el2 as HTMLElement
      const id = target.dataset.revealId ?? ''
      if (!id) return
      if (marked.current.has(id)) return
      marked.current.add(id)
      observer.observe(target)
    })

    return () => observer.disconnect()
  }, [])

  return <div data-reveal-root />
}
