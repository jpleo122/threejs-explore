import { useState } from 'react'
import { ChevronUp, RotateCcw } from 'lucide-react'
import type { ShellProps } from './ControlPanel'
import { ParamsContent } from './ParamsContent'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

export function MobileSheet({ content, onRestart }: ShellProps) {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="fixed inset-x-0 bottom-0 z-10 flex max-h-[60dvh] flex-col rounded-t-xl border-t bg-card/85 pb-[env(safe-area-inset-bottom)] text-card-foreground shadow-lg backdrop-blur"
    >
      <div className="flex h-14 shrink-0 items-center gap-2 px-2">
        <CollapsibleTrigger asChild>
          <button className="flex h-full flex-1 items-center gap-2 px-2 text-sm font-medium">
            <ChevronUp className={cn('size-4 transition-transform', open && 'rotate-180')} />
            Parameters
          </button>
        </CollapsibleTrigger>
        <Button variant="secondary" onClick={onRestart}>
          <RotateCcw />
          Restart
        </Button>
      </div>

      <CollapsibleContent className="flex min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <ParamsContent {...content} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
