import * as THREE from 'three'
import { GPUComputationRenderer, Variable } from 'three/addons/misc/GPUComputationRenderer.js';
import Stats from 'three/addons/libs/stats.module.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import particleFragmentShader from './shaders/particles.frag';
import particleVertexShader from './shaders/particles.vert';
import positionShader from './shaders/position.frag';
import velocityShader from './shaders/velocity.frag';
import { disposeRenderer, disposeScene } from '../dispose';
import { createTooltips, type Tooltips } from '../components/tooltip';
import type { Project } from '../projects';

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

type ParamSpec = {
    value: number,
    description: string,
    min?: number,
    max?: number,
    step?: number,
    name?: string
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

const PARAMS: Record<keyof FlockConfig, ParamSpec> = {
    K: {
        value: 5, min: 1, max: 100, step: 1,
        description: `${ WEIGHT }
            Scales how strongly each particle is pulled toward its neighbours' velocities. Larger values flock harder and faster.`
    },
    beta: {
        value: 0.45, min: 0.0, max: 2.0, step: 0.01,
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
    stats: Stats
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
    gpuCompute: GPUComputationRenderer,
    positionVariable: Variable,
    velocityVariable: Variable
}

type RestartSimulation = {
    texturePosition: THREE.DataTexture,
    textureVelocity: THREE.DataTexture
}

type InitGUIProps = {
    config: FlockConfig,
    gpuCompute: GPUComputationRenderer,
    positionVariable: Variable,
    velocityVariable: Variable
}

type InitGUI = {
    gui: GUI,
    tooltips: Tooltips
}

export function start(container: HTMLElement): Project {

    const CONFIG = Object.fromEntries(
        Object.entries( PARAMS ).map( ( [ key, spec ] ) => [ key, spec.value ] )
    ) as FlockConfig;

    const canvas = document.createElement('canvas');
    container.appendChild( canvas );

    const stats = new Stats();
    container.appendChild( stats.dom );

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

    const { scene, particleUniforms } = initParticles({ config: CONFIG, camera });

    const { gpuCompute, positionVariable, velocityVariable } = initComputeRenderer({ config:CONFIG, renderer});

    const { gui, tooltips } = initGUI({ config: CONFIG, gpuCompute, positionVariable, velocityVariable });
    dynamicValuesChanger({ config: CONFIG, positionVariable, velocityVariable });

    const listeners = new AbortController();

    window.addEventListener('resize', () => onResize({ renderer, camera, particleUniforms }), { signal: listeners.signal })

    window.addEventListener('keydown', ( event ) => {

        if ( event.key !== 'r' && event.key !== 'R' ) return;
        if ( event.metaKey || event.ctrlKey || event.altKey ) return;
        if ( event.target instanceof HTMLInputElement ) return;

        restartSimulation( { config: CONFIG, gpuCompute, positionVariable, velocityVariable } );

    }, { signal: listeners.signal })

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
        dispose() {
            listeners.abort();
            controls.dispose();
            tooltips.dispose();
            gui.destroy();
            gpuCompute.dispose();
            disposeScene( scene );
            disposeRenderer( renderer );
            stats.dom.remove();
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

function restartSimulation( { config, gpuCompute, positionVariable, velocityVariable }: RestartSimulationProps): RestartSimulation {

    const texturePosition = gpuCompute.createTexture();
    const textureVelocity = gpuCompute.createTexture();

    fillTextures( { config, texturePosition, textureVelocity } );

    gpuCompute.renderTexture( texturePosition, positionVariable.renderTargets[ 0 ] );
    gpuCompute.renderTexture( texturePosition, positionVariable.renderTargets[ 1 ] );
    gpuCompute.renderTexture( textureVelocity, velocityVariable.renderTargets[ 0 ] );
    gpuCompute.renderTexture( textureVelocity, velocityVariable.renderTargets[ 1 ] );

    const velocityUniforms = velocityVariable.material.uniforms;
    velocityUniforms[ 'simulationRadius' ].value = config.radius;
    velocityUniforms[ 'K' ].value = config.K;
    velocityUniforms[ 'beta' ].value = config.beta;
    velocityUniforms[ 'sigma' ].value = config.sigma;
    velocityUniforms[ 'sphericalBounds' ].value = config.radius * config.sphericalBoundMultiplier;

    return { texturePosition, textureVelocity };
}

const DYNAMIC_KEYS = [ 'deltaDenominator' ] as const;

const STATIC_KEYS = [
    'K', 'beta', 'sigma', 'width', 'particleRadius', 'radius', 'height', 'exponent',
    'initMaxVelocity', 'velocityExponent', 'randVelocity', 'sphericalBoundMultiplier'
] as const;

function initGUI( { config, gpuCompute, positionVariable, velocityVariable }: InitGUIProps): InitGUI {

    const gui = new GUI( { width: 280 } );
    const tooltips = createTooltips();

    const description = document.createElement( 'div' );
    description.style.cssText =
        'padding:8px 10px;border-bottom:1px solid var(--widget-color);' +
        'line-height:1.5;user-select:text;-webkit-user-select:text';
    description.innerHTML = `A simulation based on <a href="https://people.mpi-inf.mpg.de/~mehlhorn/SeminarEvolvability/CuckerSmale.pdf"><em>Cucker&#8211;Smale flocking.</em></a>. 
        Each particle steers toward a
        weighted average of its neighbours' velocities.
        Hover a parameter for its role; press <b>R</b> to restart.`;
    gui.$children.prepend( description );

    const addSlider = ( folder: GUI, key: keyof FlockConfig ) => {
        const { min, max, step, description, name } = PARAMS[ key ];
        const controller = folder.add( 
            config, key, min, max, step 
        ).name(name ?? key);

        tooltips.attach( controller.domElement, description );

        return controller;
    };

    const dynamicFolder = gui.addFolder( 'Dynamic parameters' );

    for ( const key of DYNAMIC_KEYS ) {
        addSlider( dynamicFolder, key )
            .onChange( () => dynamicValuesChanger( { config, positionVariable, velocityVariable } ) );
    }

    const staticFolder = gui.addFolder( 'Static parameters' );

    for ( const key of STATIC_KEYS ) addSlider( staticFolder, key );

    const restart = staticFolder.add(
        { restart: () => restartSimulation( { config, gpuCompute, positionVariable, velocityVariable } ) },
        'restart'
    ).name( 'restart (R)' );

    tooltips.attach( restart.domElement, 'Re-seed the simulation, applying any changed static parameters. (R)' );

    dynamicFolder.open();
    staticFolder.open();

    return { gui, tooltips };
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

function render({ renderer, scene, camera, gpuCompute, particleUniforms, positionVariable, velocityVariable }: RenderProps) {
    gpuCompute.compute();

    particleUniforms[ 'texturePosition' ].value = gpuCompute.getCurrentRenderTarget( positionVariable ).texture;
	particleUniforms[ 'textureVelocity' ].value = gpuCompute.getCurrentRenderTarget( velocityVariable ).texture;

    renderer.render(scene, camera)
}