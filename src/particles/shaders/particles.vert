precision highp float;

#define PI 3.141592653589793

uniform sampler2D texturePosition;
uniform sampler2D textureVelocity;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

uniform float cameraConstant;

attribute vec2 uv;

varying vec4 vColor;


void main() {

    vec4 posTemp = texture2D( texturePosition, uv );
    vec3 pos = posTemp.xyz;

    vec4 velTemp = texture2D( textureVelocity, uv );
    vec3 vel = velTemp.xyz;
    float radius = velTemp.w;

    vColor = vec4( 1.0, radius / 250.0, 0.0, 1.0 );

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