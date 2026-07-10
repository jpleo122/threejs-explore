#define delta ( 1.0 / 60.0 )

precision highp float;

// Injected by GPUComputationRenderer at runtime; guarded so editors resolve them.
#ifndef resolution
#define resolution vec2( 1.0 )
uniform sampler2D texturePosition;
uniform sampler2D textureVelocity;
#endif

void main() {

    vec2 uv = gl_FragCoord.xy / resolution.xy;

    vec4 tmpPos = texture2D( texturePosition, uv );
    vec3 pos = tmpPos.xyz;

    vec4 tmpVel = texture2D( textureVelocity, uv );
    vec3 vel = tmpVel.xyz;

    // Dynamics
    pos += vel * delta;

    gl_FragColor = vec4( pos, 1.0 );

}