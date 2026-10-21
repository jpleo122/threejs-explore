precision highp float;

uniform sampler2D texturePosition;
uniform sampler2D textureVelocity;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

attribute vec3 position;
attribute vec3 normal;
attribute vec2 reference;

varying vec4 vColor;
varying vec3 vNormal;

vec3 hsv2rgb( vec3 c ) {
    vec3 rgb = clamp( abs( mod( c.x * 6.0 + vec3( 0.0, 4.0, 2.0 ), 6.0 ) - 3.0 ) - 1.0, 0.0, 1.0 );
    return c.z * mix( vec3( 1.0 ), rgb, c.y );
}

void main() {

    vec3 pos = texture2D( texturePosition, reference ).xyz;

    vec4 velTemp = texture2D( textureVelocity, reference );
    vec3 vel = velTemp.xyz;
    float radius = velTemp.w;

    // Rotate the cone's local +Z axis onto the velocity direction. The cone is
    // radially symmetric, so roll is irrelevant and the reference up-vector only
    // needs to avoid being parallel to the heading.
    vec3 forward = ( length( vel ) > 1e-6 ) ? normalize( vel ) : vec3( 0.0, 0.0, 1.0 );
    vec3 ref = abs( forward.y ) < 0.99 ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
    vec3 right = normalize( cross( ref, forward ) );
    vec3 up = cross( forward, right );
    mat3 orient = mat3( right, up, forward );

    vec3 world = orient * ( position * radius ) + pos;

    vColor = vec4( hsv2rgb( vec3( 100.0 / 255.0, 70.0 / 255.0, 1.0 ) ), 1.0 );
    vNormal = mat3( modelViewMatrix ) * ( orient * normal );

    gl_Position = projectionMatrix * modelViewMatrix * vec4( world, 1.0 );

}
