import { useState } from 'react'
import { ChevronDown, RotateCcw } from 'lucide-react'
import type { ShellProps } from './ControlPanel'
import { ParamsContent } from './ParamsContent'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

export function DesktopPanel({ content, onRestart }: ShellProps) {
  const [open, setOpen] = useState(true)

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="fixed top-3 right-3 z-10 flex max-h-[calc(100dvh-1.5rem)] w-80 flex-col rounded-xl border bg-card/80 text-card-foreground shadow-lg backdrop-blur"
    >
      <CollapsibleTrigger asChild>
        <button className="flex h-12 shrink-0 items-center justify-between px-4 text-sm font-medium">
          Parameters
          <ChevronDown className={cn('size-4 transition-transform', !open && '-rotate-90')} />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="flex min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <ParamsContent
            {...content}
            footer={
              <Button variant="secondary" size="sm" className="w-full" onClick={onRestart}>
                <RotateCcw />
                Restart
                <kbd className="ml-auto rounded border px-1.5 font-mono text-[10px] text-muted-foreground">R</kbd>
              </Button>
            }
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
