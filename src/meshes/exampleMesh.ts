import * as THREE from 'three'
import vertexShader from '../shaders/example.vert'
import fragmentShader from '../shaders/example.frag'

export function createExampleMesh(): THREE.Mesh {
  const geometry = new THREE.CircleGeometry(1, 8)
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
    },
  })
  return new THREE.Mesh(geometry, material)
}
