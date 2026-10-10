import { useCallback, useEffect, useState } from 'react'
import { projects } from '@/projects'

function readHash() {
  const hash = location.hash.slice(1)
  return hash in projects ? hash : Object.keys(projects)[0]
}

/* Hash routing, since GitHub Pages can't rewrite unknown paths to index.html. */
export function useHashRoute() {
  const [id, setId] = useState(readHash)

  useEffect(() => {
    const onChange = () => setId(readHash())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const navigate = useCallback((next: string) => {
    location.hash = next
  }, [])

  return [id, navigate] as const
}
