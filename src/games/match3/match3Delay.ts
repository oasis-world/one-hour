export const delay = (ms: number) => new Promise<void>((resolve) => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.setTimeout(resolve, reducedMotion ? 80 : ms)
})
