precision highp float;

#define PI 3.141592653589793

uniform sampler2D texturePosition;
uniform sampler2D textureVelocity;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

uniform float cameraConstant;

attribute vec2 uv;

varying vec4 vColor;

float hash( float n ) {
    return fract( sin( n ) * 43758.5453123 );
}

vec3 hsv2rgb( vec3 c ) {
    vec3 rgb = clamp( abs( mod( c.x * 6.0 + vec3( 0.0, 4.0, 2.0 ), 6.0 ) - 3.0 ) - 1.0, 0.0, 1.0 );
    return c.z * mix( vec3( 1.0 ), rgb, c.y );
}

void main() {

    vec4 posTemp = texture2D( texturePosition, uv );
    vec3 pos = posTemp.xyz;

    vec4 velTemp = texture2D( textureVelocity, uv );
    vec3 vel = velTemp.xyz;
    float radius = velTemp.w;

    float alive = step( 0.0001, radius );
    vColor = vec4( hsv2rgb( vec3( hash( radius ), 0.85, 1.0 ) ), alive );

    vec4 mvPosition = modelViewMatrix * vec4( pos, 1.0 );

    // Apparent size in pixels
    if ( radius == 0.0 ) {
        gl_PointSize = 0.0;
    }
    else {
        gl_PointSize = radius * cameraConstant / ( - mvPosition.z );
    }

    gl_Position = projectionMatrix * mvPosition;

}