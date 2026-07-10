import * as THREE from 'three'
import vertexShader from '../shaders/example.vert'
import fragmentShader from '../shaders/example.frag'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export function createExampleMesh(): THREE.Mesh {

  const geometry = new THREE.CircleGeometry(0.5, 8)
  const geo2 = new THREE.CircleGeometry(0.5, 8);
  geo2.translate(1, 1, 0);
  const material = new THREE.RawShaderMaterial({
    vertexShader,
    fragmentShader,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) }
    },
  })

  const mergedGeos = mergeGeometries([geometry, geo2]);
  return new THREE.Mesh(mergedGeos, material)
}
