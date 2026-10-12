precision highp float;

#define PI 3.141592653589793

uniform sampler2D texturePosition;
uniform sampler2D textureVelocity;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

uniform float cameraConstant;
uniform float density;
// uniform float uTime;

attribute vec2 uv;

varying vec4 vColor;

float hash( float n ) {
    return fract( sin( n ) * 43758.5453123 );
}

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

vec3 hsv2rgb( vec3 c ) {
    vec3 rgb = clamp( abs( mod( c.x * 6.0 + vec3( 0.0, 4.0, 2.0 ), 6.0 ) - 3.0 ) - 1.0, 0.0, 1.0 );
    return c.z * mix( vec3( 1.0 ), rgb, c.y );
}

float radiusFromMass( float mass ) {
    // Calculate radius of a sphere from mass and density
    return pow( ( 3.0 / ( 4.0 * PI ) ) * mass / density, 1.0 / 3.0 );
}

void main() {

    vec4 posTemp = texture2D( texturePosition, uv );
    vec3 pos = posTemp.xyz;

    vec4 velTemp = texture2D( textureVelocity, uv );
    float mass = velTemp.w;
    float radius = radiusFromMass(mass);

    vec4 mvPosition = modelViewMatrix * vec4( pos, 1.0 );

    // float hue = clamp(
    //     (
    //         length(pos) / simulationRadius) + 
    //         (((sin(uTime * 1.5) + 1.0) * 0.25) - 0.25
    //     ),
    //     0.0, 
    //     1.0
    // );

    // float alive = step( 0.0001, radius );
    // vColor = vec4( hsv2rgb( vec3( hue, (70.0 / 255.0), 1.0 ) ), 1.0 );

    vColor = vec4( vec3(1), 0.5 );

    // Apparent size in pixels
    if ( radius == 0.0 ) {
        gl_PointSize = 0.0;
    }
    else {
        gl_PointSize = radius * cameraConstant / ( - mvPosition.z );
    }

    gl_Position = projectionMatrix * mvPosition;

}