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
import type { Project } from '../projects';

type FlockConfig = {

    K: number, /* positive parameter */

    /* 
        Conclusion from paper:
        
        When β < 1/2: The system always achieves global flocking, meaning that all particles will 
        eventually move together at the same constant velocity, regardless of their initial positions and velocities.

        When β >= 1/2: Flocking is still possible, but only if the initial conditions meet specific requirements.
    */
    beta: number,

    width: number, /* width of gpu texture for particles, particle count = width ** 2 */
    particleRadius: number,
    radius: number, /* radius of bounding sphere */
    height: number, /* max start height of particles */
    exponent: number, /* controls distribution of particles from center */
    initMaxVelocity: number
    velocityExponent: number, /* controls distribution of initialvelocities based on distance from center */
    randVelocity: number,
    deltaDenominator: number, /* integration timestep denominator, delta = 1 / deltaDenominator */
    sphericalBoundMultiplier: number /* sphericalBounds = radius * sphericalBoundMultiplier */
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
    gui: GUI
}

export function start(container: HTMLElement): Project {

    const CONFIG: FlockConfig = {
        K: 10,
        beta: 0.45,
        width: 64,
        particleRadius: 3,
        radius: 100,
        height: 50,
        exponent: 0.0001,
        initMaxVelocity: 70 * 2,
        velocityExponent: 0.001,
        randVelocity: 1,
        deltaDenominator: 60,
        sphericalBoundMultiplier: 0
    }

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

    const { gui } = initGUI({ config: CONFIG, gpuCompute, positionVariable, velocityVariable });
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
    velocityUniforms[ 'sphericalBounds' ].value = config.radius * config.sphericalBoundMultiplier;

    return { texturePosition, textureVelocity };
}

function initGUI( { config, gpuCompute, positionVariable, velocityVariable }: InitGUIProps): InitGUI {

    const gui = new GUI( { width: 280 } );

    const dynamicFolder = gui.addFolder( 'Dynamic parameters' );

    dynamicFolder.add( config, 'deltaDenominator', 60, 6000, 1 ).onChange( () => dynamicValuesChanger( { config, positionVariable, velocityVariable } ) );

    const staticFolder = gui.addFolder( 'Static parameters' );

    staticFolder.add( config, 'K', 0.0, 1000.0, 0.05 );
    staticFolder.add( config, 'beta', 0.0, 2.0, 0.01 );
    staticFolder.add( config, 'particleRadius', 0.1, 20.0, 0.1 );
    staticFolder.add( config, 'radius', 10.0, 1000.0, 1.0 );
    staticFolder.add( config, 'height', 0.0, 200.0, 0.01 );
    staticFolder.add( config, 'exponent', 0.0, 2.0, 0.0001 );
    staticFolder.add( config, 'initMaxVelocity', 0.0, 500.0, 0.1 );
    staticFolder.add( config, 'velocityExponent', 0.0, 1.0, 0.001 );
    staticFolder.add( config, 'randVelocity', 0.0, 50.0, 0.1 );
    staticFolder.add( config, 'sphericalBoundMultiplier', 0.0, 5.0, 0.01 );

    staticFolder.add( { restart: () => restartSimulation( { config, gpuCompute, positionVariable, velocityVariable } ) }, 'restart' );

    dynamicFolder.open();
    staticFolder.open();

    return { gui };
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