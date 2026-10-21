import * as THREE from 'three'
import { GPUComputationRenderer, Variable } from 'three/addons/misc/GPUComputationRenderer.js';
import type Stats from 'three/addons/libs/stats.module.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import particleFragmentShader from './shaders/particles.frag';
import particleVertexShader from './shaders/particles.vert';
import positionShader from './shaders/position.frag';
import velocityShader from './shaders/velocity.frag';
import { disposeRenderer, disposeScene } from '../dispose';
import { createStats } from '../stats';
import type { ParamSpec, Project } from '@/projects';

type PendulumConfig = {
    width: number, /* width of gpu texture for particles, particle count = width ** 2 */
    // connectionCount
    maxParticleMass: number,
    randomWeightParticleMass: number,
    particleMassExponent: number,
    seedRadius: number,
    seedExponent: number,
    gravityConstant: number,
    density: number,
    deltaDenominator: number,
    dampingFactor: number
}

type RenderProps = {
    renderer: THREE.WebGLRenderer
    gpuCompute: GPUComputationRenderer,
    positionVariable: Variable,
    velocityVariable: Variable
    camera: THREE.PerspectiveCamera,
    scene: THREE.Scene,
    particleUniforms: particleUniforms,
    clock: THREE.Clock
}

type AnimateProps = RenderProps & {
    stats: Stats | null
}

type ResizeProps = {
    renderer: THREE.WebGLRenderer
    camera: THREE.PerspectiveCamera,
    particleUniforms: particleUniforms
}

type InitParticleProps = {
    config: PendulumConfig,
    camera: THREE.PerspectiveCamera
}

type particleUniforms = {
    [uniform: string]: THREE.IUniform<any>;
}

type InitParticle = {
    scene: THREE.Scene,
    particleUniforms: particleUniforms
}

type InitComputeRendererProps = {
    config: PendulumConfig,
    renderer: THREE.WebGLRenderer
}

type InitComputeRenderer = {
    gpuCompute: GPUComputationRenderer,
    positionVariable: Variable,
    velocityVariable: Variable
}

type FillTexturesProps = {
    config: PendulumConfig,
    texturePosition: THREE.DataTexture,
    textureVelocity: THREE.DataTexture
}

type RestartSimulationProps = {
    config: PendulumConfig,
    camera: THREE.PerspectiveCamera,
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    gpuCompute: GPUComputationRenderer
}

type DynamicValuesChangerProps = {
    config: PendulumConfig,
    positionVariable: Variable,
    velocityVariable: Variable
}

export const params: Partial<Record<keyof PendulumConfig, ParamSpec>> = {
    width: {
        value: 200, min: 1, max: 400, step: 1,
        name: "GPU Texture Width",
        description: `<math display="block">
              <mi>particleCount</mi><mo>=</mo><msup><mi>GPU Texture Width</mi><mn>2</mn></msup>
            </math>`
    },
    deltaDenominator: {
        value: 60, min: 10, max: 600, step: 1,
        live: true,
        name: "Integration Timestep",
        description: `<math><mi>&#948;</mi><mo>=</mo><mfrac><mn>1</mn><mi>Integration Timestep</mi></mfrac></math>.
            Higher means smaller steps: a slower but more stable simulation.`
    },
    gravityConstant: {
        value: 10, min: 1, max: 100, step: 1,
        live: true,
        name: "Gravity Constant",
        description: `A constant applied in the -y direction.`
    },
    dampingFactor: {
        value: 0, min: 0, max: 4, step: 0.1,
        live: true,
        name: "Damping",
        description: `The coefficient, d, of the drag on velocity defined by (-d / mass) * velocity`
    },
    maxParticleMass: {
        value: 100, min: 50, max: 1000, step: 50,
        live: false,
        name: "Max Particle Mass",
        description: `The max of the inital mass distribution.`
    },
    randomWeightParticleMass: {
        value: 0, min: 0, max: 0.9, step: 0.1,
        live: false,
        name: "Mass Randomness Weight",
        description: `The minimum bound of the inital mass distribution.`
    }
}

export const description = `A horde of simple gravity pendulums with optional parameters`;

export function start(container: HTMLElement, values: Record<string, number>): Project {

    const CONFIG: PendulumConfig = {
        width: 1,
        maxParticleMass: 100,
        randomWeightParticleMass: 1,
        particleMassExponent: 1,
        seedRadius: 300,
        seedExponent: 0.5,
        gravityConstant: 10,
        density: 10,
        deltaDenominator: 60,
        dampingFactor: 0,
        ...values
    }

    const canvas = document.createElement('canvas');
    container.appendChild( canvas );

    const stats = createStats( container );

    const clock = new THREE.Clock();

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(window.innerWidth, window.innerHeight)

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      5,
      15000,
    )
    camera.position.y = 120;
    camera.position.z = 400;

    const controls = new OrbitControls( camera, renderer.domElement );
    controls.minDistance = 0;
    controls.maxDistance = 1000;

    let { scene, particleUniforms } = initParticles({ config: CONFIG, camera });

    let { gpuCompute, positionVariable, velocityVariable } = initComputeRenderer({ config:CONFIG, renderer});

    const listeners = new AbortController();

    window.addEventListener('resize', () => onResize({ renderer, camera, particleUniforms }), { signal: listeners.signal })

    renderer.setAnimationLoop( () => animate({
        renderer,
        gpuCompute,
        positionVariable,
        velocityVariable,
        camera,
        scene,
        stats,
        particleUniforms,
        clock
    }) );

    return {
        setParam( key, value ) {
            if ( !( key in params ) ) return;
            CONFIG[ key as keyof PendulumConfig ] = value;
            if ( params[ key as keyof PendulumConfig ]?.live ) {
                dynamicValuesChanger( { config: CONFIG, positionVariable, velocityVariable } );
            }
        },
        restart() {
            ( { scene, particleUniforms, gpuCompute, positionVariable, velocityVariable } =
                restartSimulation( { config: CONFIG, camera, renderer, scene, gpuCompute } ) );
        },
        dispose() {
            listeners.abort();
            controls.dispose();
            gpuCompute.dispose();
            disposeScene( scene );
            disposeRenderer( renderer );
            stats?.dom.remove();
        }
    }
}

function initParticles( { config, camera }: InitParticleProps): InitParticle {

    var geometry = new THREE.BufferGeometry();
    const width = config.width;
    const particleCount = width * width;

    const positions = new Float32Array( particleCount * 3 );
    let p = 0;

    for ( let i = 0; i < particleCount * 3; i ++ ) {
        positions[ i ] = 0;
    }

    const uvs = new Float32Array( particleCount * 2 );
    p = 0;

    for ( let j = 0; j < width; j ++ ) {

        for ( let i = 0; i < width; i ++ ) {

            uvs[ p ++ ] = i / ( width );
            uvs[ p ++ ] = j / ( width );

        }

    }

    geometry.setAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
    geometry.setAttribute( 'uv', new THREE.BufferAttribute( uvs, 2 ) );

    const particleUniforms = {
        'texturePosition': { value: null },
        'textureVelocity': { value: null },
        'cameraConstant': { value: getCameraConstant( camera ) },
        'density': { value: config.density },
        'seedRadius': { value: config.seedRadius },
        'uTime': { value: 0.0 },
    };

    // THREE.ShaderMaterial
    const material = new THREE.RawShaderMaterial( {
        uniforms: particleUniforms,
        vertexShader: particleVertexShader,
        fragmentShader: particleFragmentShader
    } );

    const particles = new THREE.Points( geometry, material );
    particles.matrixAutoUpdate = false;
    particles.updateMatrix();

    const scene = new THREE.Scene()
    scene.add( particles );

    // // pivot point for reference and debugging
    // const pivotGeometry = new THREE.BufferGeometry();
    // pivotGeometry.setAttribute( 'position', new THREE.Float32BufferAttribute( [ 0, 0, 0 ], 3 ) );
    // const pivot = new THREE.Points(
    //     pivotGeometry,
    //     new THREE.ShaderMaterial( {
    //         uniforms: { size: { value: 8 * Math.min( window.devicePixelRatio, 2 ) } },
    //         vertexShader: `
    //             uniform float size;
    //             void main() {
    //                 gl_PointSize = size;
    //                 gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    //             }`,
    //         fragmentShader: `
    //             void main() {
    //                 if ( length( gl_PointCoord - 0.5 ) > 0.5 ) discard;
    //                 gl_FragColor = vec4( 1.0, 0.27, 0.27, 1.0 );
    //             }`
    //     } )
    // );
    // scene.add( pivot );

    return {
        scene,
        particleUniforms
    }
}

function fillTextures( { config, texturePosition, textureVelocity }: FillTexturesProps) {

    const posArray = texturePosition.image.data;
    const velArray = textureVelocity.image.data;

    const seedRadius = config.seedRadius;
    const seedExponent = config.seedExponent;
    const maxParticleMass = config.maxParticleMass;
    const particleMassExponent = config.particleMassExponent;
    const randomWeightParticleMass = config.randomWeightParticleMass;

    for ( let k = 0, kl = posArray.length; k < kl; k += 4 ) {

        // Position
        let x, z, rr;

        do {

            x = ( Math.random() * 2 - 1 );
            z = ( Math.random() * 2 - 1 );
            rr = x * x + z * z;

        } while ( rr > 1 || rr < 0.005 );

        rr = Math.sqrt( rr );

        const rExp = seedRadius * Math.pow( rr, seedExponent );

        x *= rExp;
        z *= rExp;

        const pMass = maxParticleMass * Math.pow((1-randomWeightParticleMass) + randomWeightParticleMass * Math.random(), particleMassExponent);

        // Fill in texture values
        posArray[ k + 0 ] = x;
        posArray[ k + 1 ] = 0;
        posArray[ k + 2 ] = z;
        posArray[ k + 3 ] = 1;

        velArray[ k + 0 ] = 0;
        velArray[ k + 1 ] = 0;
        velArray[ k + 2 ] = 0;
        velArray[ k + 3 ] = pMass;
    }

}

function initComputeRenderer( { config, renderer }: InitComputeRendererProps): InitComputeRenderer {

    let gpuCompute = new GPUComputationRenderer( config.width, config.width, renderer );

    const dtPosition = gpuCompute.createTexture();
    const dtVelocity = gpuCompute.createTexture();

    fillTextures( { config, texturePosition: dtPosition, textureVelocity: dtVelocity } );

    const velocityVariable = gpuCompute.addVariable( 'textureVelocity', velocityShader, dtVelocity );
    const positionVariable = gpuCompute.addVariable( 'texturePosition', positionShader, dtPosition );

    gpuCompute.setVariableDependencies( velocityVariable, [ positionVariable, velocityVariable ] );
    gpuCompute.setVariableDependencies( positionVariable, [ positionVariable, velocityVariable ] );

    var velocityUniforms = velocityVariable.material.uniforms;

    velocityUniforms[ 'deltaDenominator' ] = { value: config.deltaDenominator };
    velocityUniforms[ 'gravityConstant' ] = { value: config.gravityConstant };
    velocityUniforms[ 'density' ] = { value: config.density };
    velocityUniforms[ 'dampingFactor' ] = { value: config.dampingFactor };

    positionVariable.material.uniforms[ 'deltaDenominator' ] = { value: config.deltaDenominator };

    const error = gpuCompute.init();

    if ( error !== null ) {
        console.error( error );
    }

    return {
        gpuCompute,
        velocityVariable,
        positionVariable
    }
}


function dynamicValuesChanger( { config, positionVariable, velocityVariable }: DynamicValuesChangerProps) {

    positionVariable.material.uniforms[ 'deltaDenominator' ].value = config.deltaDenominator;
    velocityVariable.material.uniforms[ 'deltaDenominator' ].value = config.deltaDenominator;
    velocityVariable.material.uniforms[ 'gravityConstant' ].value = config.gravityConstant;
    velocityVariable.material.uniforms[ 'dampingFactor' ].value = config.dampingFactor;
}


function restartSimulation( { config, camera, renderer, scene, gpuCompute }: RestartSimulationProps): InitParticle & InitComputeRenderer {

    gpuCompute.dispose();
    disposeScene( scene );

    return {
        ...initParticles( { config, camera } ),
        ...initComputeRenderer( { config, renderer } )
    };
}

function getCameraConstant( camera: THREE.PerspectiveCamera ) {
    return window.innerHeight / ( Math.tan( THREE.MathUtils.DEG2RAD * 0.5 * camera.fov ) / camera.zoom );
}

function onResize({ renderer, camera, particleUniforms }: ResizeProps) {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  particleUniforms[ 'cameraConstant' ].value = getCameraConstant( camera );
}

function animate({ stats, ...rest }: AnimateProps) {
    render(rest)
    stats?.update()
}

function render({ renderer, scene, camera, gpuCompute, particleUniforms, positionVariable, velocityVariable, clock }: RenderProps) {
    gpuCompute.compute();

    particleUniforms[ 'uTime' ].value = clock.getElapsedTime();
    particleUniforms[ 'texturePosition' ].value = gpuCompute.getCurrentRenderTarget( positionVariable ).texture;
	particleUniforms[ 'textureVelocity' ].value = gpuCompute.getCurrentRenderTarget( velocityVariable ).texture;

    renderer.render(scene, camera)
}