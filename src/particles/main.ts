import * as THREE from 'three'
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';
import Stats from 'three/addons/libs/stats.module.js';
import { createExampleMesh } from '../meshes/exampleMesh';

type RenderProps = {
    renderer: THREE.WebGLRenderer
    gpuCompute: GPUComputationRenderer,
    camera: THREE.PerspectiveCamera,
    scene: THREE.Scene
}

type AnimateProps = RenderProps & {
    stats: Stats
}

type ResizeProps = {
    renderer: THREE.WebGLRenderer
    camera: THREE.PerspectiveCamera,
    material: THREE.ShaderMaterial
}

init();

function init() {

    const CONFIG = {
        WIDTH: 64
    }

    const canvas = document.querySelector<HTMLCanvasElement>('#app')!

    let stats = new Stats();
    canvas.appendChild( stats.dom );

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(window.innerWidth, window.innerHeight)
    // renderer.setAnimationLoop( () );

    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      100,
    )
    camera.position.z = 3

    const scene = new THREE.Scene();
    const mesh = createExampleMesh()
    scene.add(mesh)

    const material = mesh.material as THREE.ShaderMaterial

    const gpuCompute = new GPUComputationRenderer(CONFIG.WIDTH, CONFIG.WIDTH, renderer)

    window.addEventListener('resize', () => onResize({ renderer, camera, material }))

    animate({ renderer, gpuCompute, camera, scene, stats })
}

function onResize({ renderer, camera }: ResizeProps) {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

function animate({ stats, ...rest }: AnimateProps) {
    render(rest)
    stats.update()
}

function render({ renderer, scene, camera }: RenderProps) {
    renderer.render(scene, camera)
}