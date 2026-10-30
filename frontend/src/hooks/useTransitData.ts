import { useEffect, useState } from 'react'
import { loadTransitData } from '../services/transit'
import type { TransitData } from '../types/transit'

export function useTransitData(onLoaded?: (data: TransitData) => void) {
  const [data, setData] = useState<TransitData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    loadTransitData(controller.signal).then((result) => {
      if (controller.signal.aborted) return
      setData(result)
      setLoading(false)
      onLoaded?.(result)
    }).catch((reason: unknown) => {
      if (controller.signal.aborted) return
      setError(reason instanceof Error ? reason.message : 'No se pudieron cargar las rutas.')
      setLoading(false)
    })
    return () => controller.abort()
  }, [attempt, onLoaded])
  const retry = () => {
    setError(null)
    setLoading(true)
    setAttempt((value) => value + 1)
  }
  return { data, error, loading, retry }
}
