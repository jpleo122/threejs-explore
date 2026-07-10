import * as THREE from 'three'
import { createExampleMesh } from './meshes/exampleMesh'
import { AnimatedMesh } from './animatedMesh'

const CONFIG = {
  PARTICLE_COUNT: 100
}

const canvas = document.querySelector<HTMLCanvasElement>('#app')!

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)

const scene = new THREE.Scene()

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
)
camera.position.z = 3

const mesh = createExampleMesh()
scene.add(mesh)

const material = mesh.material as THREE.ShaderMaterial

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

window.addEventListener('pointermove', (e) => {
  material.uniforms.uMouse.value.set(
    e.clientX / window.innerWidth,
    1.0 - e.clientY / window.innerHeight, // flip Y: DOM top-down → GL bottom-up
  )
})

const clock = new THREE.Clock()

function tick() {
  const elapsed = clock.getElapsedTime()
  material.uniforms.uTime.value = elapsed
  // mesh.rotation.x = elapsed * 0.3
  // mesh.rotation.y = elapsed * 0.5
  renderer.render(scene, camera)
  requestAnimationFrame(tick)
}

tick()
