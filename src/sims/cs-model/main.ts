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

/* Cucker, F. & Smale, S. (2007), "Emergent Behavior in Flocks". */
type FlockConfig = {
    K: number,
    beta: number,
    sigma: number,
    width: number,
    particleRadius: number,
    radius: number,
    height: number,
    exponent: number,
    initMaxVelocity: number
    velocityExponent: number,
    randVelocity: number,
    deltaDenominator: number,
    sphericalBoundMultiplier: number
}

const WEIGHT = `
    <math display="block">
      <mi>a</mi><mo stretchy="false">(</mo><mi>y</mi><mo stretchy="false">)</mo><mo>=</mo>
      <mfrac>
        <mi>K</mi>
        <msup>
          <mrow>
            <mo>(</mo><msup><mi>σ</mi><mn>2</mn></msup><mo>+</mo><mi>y</mi><mo>)</mo>
          </mrow>
          <mi>&#946;</mi>
        </msup>
      </mfrac>
    </math>`

export const params: Record<keyof FlockConfig, ParamSpec> = {
    K: {
        value: 5, min: 1, max: 100, step: 1,
        description: `${ WEIGHT }
            Scales how strongly each particle is pulled toward its neighbours' velocities. Larger values flock harder and faster.`
    },
    beta: {
        value: 0.1, min: 0.0, max: 2.0, step: 0.01,
        name: "β",
        description: `Decay exponent <math><mi>&#946;</mi></math> in the interaction weight
            ${ WEIGHT }
            Sets how fast influence falls off with the distance <math><mi>r</mi></math> between two particles.`
    },
    sigma: {
        value: 1, min: 0.05, max: 10, step: 0.05,
        name: "σ",
        description: `Constant in the denominator of the interaction weight. ${ WEIGHT }`
    },
    width: {
        value: 64, min: 10, max: 80, step: 1,
        name: "GPU Texture Width",
        description: `<math display="block">
              <mi>particleCount</mi><mo>=</mo><msup><mi>GPU Texture Width</mi><mn>2</mn></msup>
            </math>`
    },
    particleRadius: {
        value: 3, min: 0.1, max: 20.0, step: 0.1,
        name: "Particle Radius",
        description: 'Used to size each cone.'
    },
    radius: {
        value: 100, min: 10.0, max: 1000.0, step: 1.0,
        name: "Seed Disc Radius",
        description: 'Radius of the disc particles are seeded into, and the base for the spherical bound below.'
    },
    height: {
        value: 50, min: 0.0, max: 200.0, step: 0.01,
        name: "Seed Disc Height",
        description: 'Vertical spread at startup. Each particle is seeded at a random height within plus or minus this.'
    },
    exponent: {
        value: 0.0001, min: 0.0, max: 2.0, step: 0.0001,
        name: "Seed Distribution Exponent",
        description: `Radial distribution of the starting positions. A particle sampled at normalised radius
            <math><mi>u</mi></math> is placed at <math><mi>radius</mi><mo>&#8901;</mo><msup><mi>u</mi><mi>exponent</mi></msup></math>.
            Near <math><mn>0</mn></math> every particle lands on the rim, forming a shell; larger values draw them inward.`
    },
    initMaxVelocity: {
        value: 140, min: 0.0, max: 500.0, step: 1,
        name: "Seed Max Velocity",
        description: 'Upper bound on initial speed, before the distance falloff and randomisation below are applied.'
    },
    velocityExponent: {
        value: 0.001, min: 0.0, max: 1.0, step: 0.001,
        name: "Seed Velocity Exponent",
        description: `Ties initial speed to distance from the centre:
            <math><mi>speed</mi><mo>=</mo><mi>initMaxVelocity</mi><mo>&#8901;</mo><msup><mi>u</mi><mi>velocityExponent</mi></msup></math>.
            Near <math><mn>0</mn></math> every particle starts at full speed wherever it sits.`
    },
    randVelocity: {
        value: 1, min: 0.0, max: 50.0, step: 0.1,
        name: "Direction Randomness",
        description: 'Scales the random direction each particle starts with.'
    },
    deltaDenominator: {
        value: 60, min: 10, max: 600, step: 1,
        live: true,
        name: "Integration Timestep",
        description: `<math><mi>&#948;</mi><mo>=</mo><mfrac><mn>1</mn><mi>Integration Timestep</mi></mfrac></math>.
            Higher means smaller steps: a slower but more stable simulation.`
    },
    sphericalBoundMultiplier: {
        value: 0, min: 0.0, max: 5.0, step: 1,
        name: "Sphere Bound Multiplier",
        description: `Optional reflecting sphere at <math><mi>radius</mi><mo>&#8901;</mo><mi>sphericalBoundMultiplier</mi></math>.
            Particles crossing it outward have their velocity reflected back inward. At 0 the bound is off and the
            flock is free to drift away.`
    }
}

export const description = `A simulation based on <a href="https://people.mpi-inf.mpg.de/~mehlhorn/SeminarEvolvability/CuckerSmale.pdf"><em>Cucker&#8211;Smale flocking</em></a>.
    Each particle steers toward a weighted average of its neighbours' velocities.
    <span class="pointer-coarse:hidden">Hover a parameter for its role; press <b>R</b> to restart.
    Scroll to zoom. Click and drag to move the camera around the center.</span>
    <span class="hidden pointer-coarse:inline">Tap a parameter for its role.
    Pinch to zoom. Drag to move the camera around the center.</span>`

type RenderProps = {
    renderer: THREE.WebGLRenderer
    gpuCompute: GPUComputationRenderer,
    positionVariable: Variable,
    velocityVariable: Variable
    camera: THREE.PerspectiveCamera,
    scene: THREE.Scene,
    particleUniforms: particleUniforms
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
    config: FlockConfig,
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
    config: FlockConfig,
    renderer: THREE.WebGLRenderer
}

type InitComputeRenderer = {
    gpuCompute: GPUComputationRenderer,
    positionVariable: Variable,
    velocityVariable: Variable
}

type FillTexturesProps = {
    config: FlockConfig,
    texturePosition: THREE.DataTexture,
    textureVelocity: THREE.DataTexture
}

type DynamicValuesChangerProps = {
    config: FlockConfig,
    positionVariable: Variable,
    velocityVariable: Variable
}

type DynamicValuesChanger = {
    deltaDenominator: number
}

type RestartSimulationProps = {
    config: FlockConfig,
    camera: THREE.PerspectiveCamera,
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    gpuCompute: GPUComputationRenderer
}

export function start(container: HTMLElement, values: Record<string, number>): Project {

    const CONFIG = { ...values } as FlockConfig;

    const canvas = document.createElement('canvas');
    container.appendChild( canvas );

    const stats = createStats( container );

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
        particleUniforms
    }) );

    return {
        setParam( key, value ) {
            if ( !( key in params ) ) return;
            CONFIG[ key as keyof FlockConfig ] = value;
            if ( params[ key as keyof FlockConfig ].live ) {
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

function initParticles( { config }: InitParticleProps): InitParticle {

    const width = config.width;
    const particleCount = width * width;

    const cone = new THREE.ConeGeometry( 0.5, 2.0, 8 );
    cone.rotateX( Math.PI / 2 ); // orient the tip along +Z (forward)
    cone.deleteAttribute( 'uv' );

    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = cone.index;
    geometry.setAttribute( 'position', cone.getAttribute( 'position' ) );
    geometry.setAttribute( 'normal', cone.getAttribute( 'normal' ) );

    // Per-instance uv into the simulation textures (one per particle).
    const references = new Float32Array( particleCount * 2 );
    let p = 0;

    for ( let j = 0; j < width; j ++ ) {

        for ( let i = 0; i < width; i ++ ) {

            references[ p ++ ] = i / ( width - 1 );
            references[ p ++ ] = j / ( width - 1 );

        }

    }

    geometry.setAttribute( 'reference', new THREE.InstancedBufferAttribute( references, 2 ) );
    geometry.instanceCount = particleCount;

    const particleUniforms = {
        'texturePosition': { value: null },
        'textureVelocity': { value: null },
    };

    const material = new THREE.RawShaderMaterial( {
        uniforms: particleUniforms,
        vertexShader: particleVertexShader,
        fragmentShader: particleFragmentShader
    } );

    const particles = new THREE.Mesh( geometry, material );
    particles.frustumCulled = false; // positions come from the texture, not the base geometry
    particles.matrixAutoUpdate = false;
    particles.updateMatrix();

    const scene = new THREE.Scene()
    scene.add( particles );

    return {
        scene,
        particleUniforms
    }
}

function fillTextures( { config, texturePosition, textureVelocity }: FillTexturesProps) {

    const posArray = texturePosition.image.data;
    const velArray = textureVelocity.image.data;

    const particleRadius = config.particleRadius
    const simulationRadius = config.radius;
    const height = config.height;
    const exponent = config.exponent;
    const maxVel = config.initMaxVelocity;
    const velExponent = config.velocityExponent;
    const randVel = config.randVelocity;

    for ( let k = 0, kl = posArray.length; k < kl; k += 4 ) {

        // Position
        let x, z, rr;

        do {

            x = ( Math.random() * 2 - 1 );
            z = ( Math.random() * 2 - 1 );
            rr = x * x + z * z;

        } while ( rr > 1 );

        rr = Math.sqrt( rr );

        const rExp = simulationRadius * Math.pow( rr, exponent );

        // Velocity
        const vel = maxVel * Math.pow( rr, velExponent );

        const vx = vel * ( Math.random() * 2 - 1 ) * randVel;
        const vy = vel * ( Math.random() * 2 - 1 ) * randVel;
        const vz = - vel * ( Math.random() * 2 - 1 ) * randVel;

        x *= rExp;
        z *= rExp;
        const y = ( Math.random() * 2 - 1 ) * height;

        // Fill in texture values
        posArray[ k + 0 ] = x;
        posArray[ k + 1 ] = y;
        posArray[ k + 2 ] = z;
        posArray[ k + 3 ] = 1;

        velArray[ k + 0 ] = vx;
        velArray[ k + 1 ] = vy;
        velArray[ k + 2 ] = vz;
        velArray[ k + 3 ] = particleRadius;

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

    velocityUniforms[ 'simulationRadius' ] = { value: config.radius };
    velocityUniforms[ 'K' ] = { value: config.K };
    velocityUniforms[ 'beta' ] = { value: config.beta };
    velocityUniforms[ 'sigma' ] = { value: config.sigma };
    velocityUniforms[ 'deltaDenominator' ] = { value: config.deltaDenominator };
    velocityUniforms[ 'sphericalBounds' ] = { value: config.radius * config.sphericalBoundMultiplier };

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

function dynamicValuesChanger( { config, positionVariable, velocityVariable }: DynamicValuesChangerProps): DynamicValuesChanger {

    velocityVariable.material.uniforms[ 'deltaDenominator' ].value = config.deltaDenominator;
    positionVariable.material.uniforms[ 'deltaDenominator' ].value = config.deltaDenominator;

    return { deltaDenominator: config.deltaDenominator };
}

function restartSimulation( { config, camera, renderer, scene, gpuCompute }: RestartSimulationProps): InitParticle & InitComputeRenderer {

    gpuCompute.dispose();
    disposeScene( scene );

    return {
        ...initParticles( { config, camera } ),
        ...initComputeRenderer( { config, renderer } )
    };
}

function onResize({ renderer, camera }: ResizeProps) {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

function animate({ stats, ...rest }: AnimateProps) {
    render(rest)
    stats?.update()
}

function render({ renderer, scene, camera, gpuCompute, particleUniforms, positionVariable, velocityVariable }: RenderProps) {
    gpuCompute.compute();

    particleUniforms[ 'texturePosition' ].value = gpuCompute.getCurrentRenderTarget( positionVariable ).texture;
	particleUniforms[ 'textureVelocity' ].value = gpuCompute.getCurrentRenderTarget( velocityVariable ).texture;

    renderer.render(scene, camera)
}