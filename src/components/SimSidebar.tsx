import { useEffect, useState } from 'react'
import { PanelLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { projects } from '@/projects'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'sidebar-open'

function readOpen() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'false'
  } catch {
    return true
  }
}

type Props = {
  current: string
  onSelect: (id: string) => void
}

export function SimSidebar({ current, onSelect }: Props) {
  const [open, setOpen] = useState(readOpen)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(open))
    } catch {}
  }, [open])

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-20 bg-card/80 backdrop-blur"
        aria-label={open ? 'Hide simulations' : 'Show simulations'}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <PanelLeft />
      </Button>

      <aside
        className={cn(
          'fixed top-3 left-3 z-10 flex w-60 flex-col rounded-xl border bg-card/80 text-card-foreground shadow-lg backdrop-blur transition-all duration-200',
          open ? 'translate-x-0 opacity-100' : 'pointer-events-none -translate-x-4 opacity-0',
        )}
      >
        <h2 className="flex h-12 items-center pl-14 text-sm font-medium">Simulations</h2>
        <ScrollArea className="max-h-[60vh]">
          <nav className="flex flex-col gap-1 p-2 pt-0">
            {Object.entries(projects).map(([id, { title }]) => (
              <Button
                key={id}
                variant="ghost"
                className={cn('justify-start', id === current && 'bg-accent text-accent-foreground')}
                aria-current={id === current ? 'page' : undefined}
                tabIndex={open ? 0 : -1}
                onClick={() => onSelect(id)}
              >
                {title}
              </Button>
            ))}
          </nav>
        </ScrollArea>
      </aside>
    </>
  )
}
