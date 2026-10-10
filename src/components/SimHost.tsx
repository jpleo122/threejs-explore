import { useEffect, useRef, useState } from 'react'
import { ControlPanel } from '@/components/ControlPanel'
import { defaultValues, projects, type Project, type ProjectModule } from '@/projects'

type Loaded = {
  module: ProjectModule
  handle: Project
}

export function SimHost({ id }: { id: string }) {
  const stage = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  useEffect(() => {
    let cancelled = false
    let handle: Project | null = null

    projects[id].load().then((module) => {
      /* Unmounted while this chunk was in flight. */
      if (cancelled) return

      handle = module.start(stage.current!, defaultValues(module.params))
      setLoaded({ module, handle })
    })

    return () => {
      cancelled = true
      handle?.dispose()
    }
  }, [id])

  return (
    <>
      <div ref={stage} className="fixed inset-0" />
      {loaded?.module.params && (
        <ControlPanel
          params={loaded.module.params}
          description={loaded.module.description}
          handle={loaded.handle}
        />
      )}
    </>
  )
}
