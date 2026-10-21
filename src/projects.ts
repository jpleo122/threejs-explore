export type ParamSpec = {
  value: number
  description: string
  min?: number
  max?: number
  step?: number
  name?: string
  live?: boolean
}

export type Params = Record<string, ParamSpec>

export type Project = {
  dispose: () => void
  setParam?: (key: string, value: number) => void
  restart?: () => void
}

export type ProjectModule = {
  start: (container: HTMLElement, values: Record<string, number>) => Project
  params?: Params
  description?: string
}

type ProjectEntry = {
  title: string
  load: () => Promise<ProjectModule>
}

export const projects: Record<string, ProjectEntry> = {
  'cs-model': {
    title: 'Cucker-Smale flocking',
    load: () => import('./sims/cs-model/main'),
  },
  particles: {
    title: 'Particles',
    load: () => import('./sims/particles/main'),
  },
  'pendulums': {
    title: 'Pendulums',
    load: () => import('./sims/pendulums/main'),
  },
}

export function defaultValues(params: Params = {}) {
  return Object.fromEntries(
    Object.entries(params).map(([key, spec]) => [key, spec.value]),
  )
}
