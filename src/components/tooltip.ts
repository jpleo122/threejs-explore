export type Tooltips = {
  attach(el: HTMLElement, html: string): void
  dispose(): void
}

const GAP = 8

/* Parented to document.body, not to the project container: #stage is
   position:fixed and so forms a stacking context, which would trap the
   tooltip below lil-gui's body-level panel whatever its z-index. */
export function createTooltips(): Tooltips {
  const tip = document.createElement('div')

  tip.style.cssText =
    'position:fixed;z-index:1002;max-width:320px;padding:8px 10px;' +
    'background:#1a1a1a;color:#ebebeb;border:1px solid #444;border-radius:4px;' +
    'font:11px/1.5 system-ui;pointer-events:none;opacity:0;transition:opacity 120ms'

  document.body.appendChild(tip)

  const listeners = new AbortController()

  function show(el: HTMLElement, html: string) {
    tip.innerHTML = html

    const rect = el.getBoundingClientRect()

    /* Anchored to the left of the row, since the panel sits top-right. */
    const right = Math.min(
      window.innerWidth - rect.left + GAP,
      window.innerWidth - tip.offsetWidth - GAP,
    )
    const top = Math.min(rect.top, window.innerHeight - tip.offsetHeight - GAP)

    tip.style.right = `${Math.max(right, GAP)}px`
    tip.style.top = `${Math.max(top, GAP)}px`
    tip.style.opacity = '1'
  }

  return {
    attach(el, html) {
      el.addEventListener('mouseenter', () => show(el, html), { signal: listeners.signal })
      el.addEventListener('mouseleave', () => { tip.style.opacity = '0' }, { signal: listeners.signal })
    },

    dispose() {
      listeners.abort()
      tip.remove()
    },
  }
}
