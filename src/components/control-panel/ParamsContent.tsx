import { useState, type ReactNode } from 'react'
import { ChevronDown, Info } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import type { ParamSpec, Params } from '@/projects'
import { cn } from '@/lib/utils'

export type ParamsContentProps = {
  params: Params
  description?: string
  values: Record<string, number>
  applied: Record<string, number>
  onChange: (key: string, value: number) => void
  footer?: ReactNode
}

export function ParamsContent({ params, description, values, applied, onChange, footer }: ParamsContentProps) {
  const entries = Object.entries(params)
  const live = entries.filter(([, spec]) => spec.live)
  const staged = entries.filter(([, spec]) => !spec.live)

  return (
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
            <ParamRow key={key} id={key} spec={spec} value={values[key]} onChange={onChange} />
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
              onChange={onChange}
            />
          ))}
          {footer}
        </Section>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
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
        <ParamHint description={description}>
          <button type="button" className="flex cursor-help items-center gap-1.5">
            {name}
            <Info className="size-3 text-muted-foreground" />
            {pending && <span className="size-1.5 rounded-full bg-amber-400" title="Restart to apply" />}
          </button>
        </ParamHint>
        <span className="font-mono text-muted-foreground tabular-nums">{value.toFixed(decimals)}</span>
      </div>
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={([next]) => onChange(id, next)} />
    </div>
  )
}

/* Hover has no touch equivalent, so coarse pointers get a tap-to-open popover. */
function ParamHint({ description, children }: { description: string; children: ReactNode }) {
  const finePointer = useMediaQuery('(pointer: fine)')
  const body = <div dangerouslySetInnerHTML={{ __html: description }} />

  if (finePointer) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="left" sideOffset={8} className="max-w-xs text-left leading-relaxed">
          {body}
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent side="top" className="w-auto max-w-[calc(100vw-2rem)] px-3 py-2 text-xs leading-relaxed">
        {body}
      </PopoverContent>
    </Popover>
  )
}
