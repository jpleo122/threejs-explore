import * as THREE from 'three'

export function disposeScene(scene: THREE.Scene) {
  scene.traverse((object) => {
    const mesh = object as Partial<THREE.Mesh>
    mesh.geometry?.dispose()

    const material = mesh.material
    if (Array.isArray(material)) {
      material.forEach((m) => m.dispose())
    } else {
      material?.dispose()
    }
  })

  scene.clear()
}

/* Frees the GL context immediately instead of waiting on GC — browsers cap
   the number of live contexts, so a leak here breaks later projects. */
export function disposeRenderer(renderer: THREE.WebGLRenderer) {
  renderer.setAnimationLoop(null)
  renderer.dispose()
  renderer.forceContextLoss()
  renderer.domElement.remove()
}
