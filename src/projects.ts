export type Project = {
  dispose: () => void
}

export type ProjectModule = {
  start: (container: HTMLElement) => Project
}

type ProjectEntry = {
  title: string
  load: () => Promise<ProjectModule>
}

export const projects: Record<string, ProjectEntry> = {
  'cs-model': {
    title: 'Cucker-Smale flocking',
    load: () => import('./cs-model/main'),
  },
  particles: {
    title: 'Particles',
    load: () => import('./particles/main'),
  },
}
