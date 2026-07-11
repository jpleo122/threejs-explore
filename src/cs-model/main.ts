import * as THREE from 'three'
import { GPUComputationRenderer, Variable } from 'three/addons/misc/GPUComputationRenderer.js';
import Stats from 'three/addons/libs/stats.module.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import particleFragmentShader from './shaders/particles.frag';
import particleVertexShader from './shaders/particles.vert';
import positionShader from './shaders/position.frag';
import velocityShader from './shaders/velocity.frag';

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
    randVelocity: number
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

init();

function init() {

    const CONFIG: FlockConfig = {
        K: 100,
        beta: 0.5,
        width: 64,
        particleRadius: 3,
        radius: 200,
        height: 50,
        exponent: 0.0001,
        initMaxVelocity: 70 * 2,
        velocityExponent: 0.001,
        randVelocity: 1
    }

    const canvas = document.querySelector<HTMLCanvasElement>('#app')!

    let stats = new Stats();
    document.body.appendChild( stats.dom );

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

    const { scene, particleUniforms } = initParticles({ config: CONFIG, camera });

    const { gpuCompute, positionVariable, velocityVariable } = initComputeRenderer({ config:CONFIG, renderer});

    window.addEventListener('resize', () => onResize({ renderer, camera, particleUniforms }))

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
}

function initParticles( { config, camera }: InitParticleProps): InitParticle {

    var geometry = new THREE.BufferGeometry();
    const width = config.width;
    const particleCount = width * width;
    const simulationRadius = config.radius

    const positions = new Float32Array( particleCount * 3 );
    let p = 0;

    for ( let i = 0; i < particleCount; i ++ ) {

        positions[ p ++ ] = ( Math.random() * 2 - 1 ) * simulationRadius;
        positions[ p ++ ] = 0; //( Math.random() * 2 - 1 ) * effectController.radius;
        positions[ p ++ ] = ( Math.random() * 2 - 1 ) * simulationRadius;

    }

    const uvs = new Float32Array( particleCount * 2 );
    p = 0;

    for ( let j = 0; j < width; j ++ ) {

        for ( let i = 0; i < width; i ++ ) {

            uvs[ p ++ ] = i / ( width - 1 );
            uvs[ p ++ ] = j / ( width - 1 );

        }

    }

    geometry.setAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
    geometry.setAttribute( 'uv', new THREE.BufferAttribute( uvs, 2 ) );

    const particleUniforms = {
        'texturePosition': { value: null },
        'textureVelocity': { value: null },
        'cameraConstant': { value: getCameraConstant( camera ) },

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

        const vx = vel * z + ( Math.random() * 2 - 1 ) * randVel;
        const vy = ( Math.random() * 2 - 1 ) * randVel;
        const vz = - vel * x + ( Math.random() * 2 - 1 ) * randVel;

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

    // velocityUniforms[ 'gravityConstant' ] = { value: 0.0 };
    velocityUniforms[ 'simulationRadius' ] = { value: config.radius };
    velocityUniforms[ 'K' ] = { value: config.K };
    velocityUniforms[ 'beta' ] = { value: config.beta };

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
    stats.update()
}

function render({ renderer, scene, camera, gpuCompute, particleUniforms, positionVariable, velocityVariable }: RenderProps) {
    gpuCompute.compute();

    particleUniforms[ 'texturePosition' ].value = gpuCompute.getCurrentRenderTarget( positionVariable ).texture;
	particleUniforms[ 'textureVelocity' ].value = gpuCompute.getCurrentRenderTarget( velocityVariable ).texture;

    renderer.render(scene, camera)
}