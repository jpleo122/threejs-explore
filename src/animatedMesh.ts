import * as THREE from 'three'

export interface AnimatedMesh {
    mesh: THREE.Mesh;
    animate(time: number): void;
};