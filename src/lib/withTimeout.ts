/**
 * Cap an await that might never settle (hung decode, stalled upload):
 * the loser still settles the race, so no unhandled rejection escapes.
 */
export function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const guard = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms)
  })
  return Promise.race([promise, guard]).finally(() => {
    if (timer !== undefined) clearTimeout(timer)
  })
}
