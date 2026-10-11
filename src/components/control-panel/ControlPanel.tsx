import { useCallback, useEffect, useState } from 'react'
import { DesktopPanel } from './DesktopPanel'
import { MobileSheet } from './MobileSheet'
import type { ParamsContentProps } from './ParamsContent'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { defaultValues, type Params, type Project } from '@/projects'

type Props = {
  params: Params
  description?: string
  handle: Project
}

export type ShellProps = {
  content: Omit<ParamsContentProps, 'footer'>
  onRestart: () => void
}

export function ControlPanel({ params, description, handle }: Props) {
  const [values, setValues] = useState(() => defaultValues(params))
  const [applied, setApplied] = useState(values)
  const desktop = useMediaQuery('(min-width: 768px)')

  function change(key: string, value: number) {
    setValues((prev) => ({ ...prev, [key]: value }))
    handle.setParam?.(key, value)
  }

  const restart = useCallback(() => {
    handle.restart?.()
    setApplied(values)
  }, [handle, values])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'r' && event.key !== 'R') return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      restart()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [restart])

  const Shell = desktop ? DesktopPanel : MobileSheet

  return (
    <Shell
      content={{ params, description, values, applied, onChange: change }}
      onRestart={restart}
    />
  )
}
