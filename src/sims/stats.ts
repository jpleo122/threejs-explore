import Stats from 'three/addons/libs/stats.module.js'

export function createStats(container: HTMLElement) {
  if (!import.meta.env.DEV) return null

  const stats = new Stats()
  stats.dom.style.top = 'auto'
  stats.dom.style.bottom = '0'
  container.appendChild(stats.dom)
  return stats
}
