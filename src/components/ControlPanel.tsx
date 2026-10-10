import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, Info, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { defaultValues, type ParamSpec, type Params, type Project } from '@/projects'
import { cn } from '@/lib/utils'

type Props = {
  params: Params
  description?: string
  handle: Project
}

export function ControlPanel({ params, description, handle }: Props) {
  const [values, setValues] = useState(() => defaultValues(params))
  const [applied, setApplied] = useState(values)
  const [open, setOpen] = useState(true)

  const entries = Object.entries(params)
  const live = entries.filter(([, spec]) => spec.live)
  const staged = entries.filter(([, spec]) => !spec.live)

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

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="fixed top-3 right-3 z-10 flex max-h-[calc(100vh-1.5rem)] w-80 flex-col rounded-xl border bg-card/80 text-card-foreground shadow-lg backdrop-blur"
    >
      <CollapsibleTrigger asChild>
        <button className="flex h-12 shrink-0 items-center justify-between px-4 text-sm font-medium">
          Parameters
          <ChevronDown className={cn('size-4 transition-transform', !open && '-rotate-90')} />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="flex min-h-0 flex-col">
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-4 px-4 pb-4">
            {description && (
              <p
                className="text-xs leading-relaxed text-muted-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2 [&_b]:text-foreground"
                dangerouslySetInnerHTML={{ __html: description }}
              />
            )}

            {live.length > 0 && (
              <Section title="Live">
                {live.map(([key, spec]) => (
                  <ParamRow key={key} id={key} spec={spec} value={values[key]} onChange={change} />
                ))}
              </Section>
            )}

            {staged.length > 0 && (
              <Section title="Applied on restart">
                {staged.map(([key, spec]) => (
                  <ParamRow
                    key={key}
                    id={key}
                    spec={spec}
                    value={values[key]}
                    pending={values[key] !== applied[key]}
                    onChange={change}
                  />
                ))}
                <Button variant="secondary" size="sm" className="w-full" onClick={restart}>
                  <RotateCcw />
                  Restart
                  <kbd className="ml-auto rounded border px-1.5 font-mono text-[10px] text-muted-foreground">R</kbd>
                </Button>
              </Section>
            )}
          </div>
        </ScrollArea>
      </CollapsibleContent>
    </Collapsible>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="space-y-3">
      <Separator />
      <CollapsibleTrigger className="flex w-full items-center justify-between text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
        <ChevronDown className={cn('size-3.5 transition-transform', !open && '-rotate-90')} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4">{children}</CollapsibleContent>
    </Collapsible>
  )
}

type ParamRowProps = {
  id: string
  spec: ParamSpec
  value: number
  pending?: boolean
  onChange: (key: string, value: number) => void
}

function ParamRow({ id, spec, value, pending, onChange }: ParamRowProps) {
  const { min = 0, max = 100, step = 1, name = id, description } = spec
  const decimals = String(step).split('.')[1]?.length ?? 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex cursor-help items-center gap-1.5">
              {name}
              <Info className="size-3 text-muted-foreground" />
              {pending && <span className="size-1.5 rounded-full bg-amber-400" title="Restart to apply" />}
            </span>
          </TooltipTrigger>
          <TooltipContent side="left" sideOffset={8} className="max-w-xs text-left leading-relaxed">
            <div dangerouslySetInnerHTML={{ __html: description }} />
          </TooltipContent>
        </Tooltip>
        <span className="font-mono text-muted-foreground tabular-nums">{value.toFixed(decimals)}</span>
      </div>
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={([next]) => onChange(id, next)} />
    </div>
  )
}
