import { projects, type Project } from './projects'

const stage = document.querySelector<HTMLDivElement>('#stage')!
const selector = document.querySelector<HTMLSelectElement>('#project')!

for (const [id, { title }] of Object.entries(projects)) {
  selector.add(new Option(title, id))
}

let current: Project | null = null
let mounted = 0

async function mount(id: string) {
  const token = ++mounted

  current?.dispose()
  current = null
  stage.replaceChildren()

  const { start } = await projects[id].load()

  /* A newer selection landed while this chunk was in flight. */
  if (token !== mounted) return

  current = start(stage)
}

function mountFromHash() {
  const hash = location.hash.slice(1)
  const id = hash in projects ? hash : Object.keys(projects)[0]

  selector.value = id
  mount(id)
}

selector.addEventListener('change', () => {
  location.hash = selector.value
})

window.addEventListener('hashchange', mountFromHash)

mountFromHash()
