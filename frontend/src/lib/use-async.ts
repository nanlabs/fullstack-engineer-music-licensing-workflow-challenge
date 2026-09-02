import { useEffect, useRef, useState } from 'react'
import { ApiError } from '@/api'

interface AsyncState<T> {
  data: T | undefined
  error: ApiError | Error | undefined
  loading: boolean
}

/** Runs `fn` whenever `deps` change and tracks loading/data/error state.
 *  Re-fetches automatically when the API mode is toggled (mock/real)
 *  since `deps` should include values that change on mode switch. */
export function useAsync<T>(fn: () => Promise<T>, deps: React.DependencyList): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ data: undefined, error: undefined, loading: true })
  const fnRef = useRef(fn)
  fnRef.current = fn
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState(s => ({ ...s, loading: true, error: undefined }))
    fnRef.current()
      .then(data => {
        if (!cancelled) setState({ data, error: undefined, loading: false })
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ data: undefined, error: error as ApiError, loading: false })
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  return { ...state, reload: () => setTick(t => t + 1) }
}
