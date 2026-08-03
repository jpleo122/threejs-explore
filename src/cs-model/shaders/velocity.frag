// For PI declaration:
// #include <common>

// Injected by GPUComputationRenderer / three at runtime; guarded so editors resolve them.
#ifndef resolution
#define resolution vec2( 1.0 )
#define PI 3.141592653589793
uniform sampler2D texturePosition;
uniform sampler2D textureVelocity;
precision highp float;
#endif

uniform float K;
uniform float beta;
uniform float sigma;
uniform float deltaDenominator;
uniform float sphericalBounds;

const float width = resolution.x;
const float height = resolution.y;

float weight(float r) {
    return K / pow((pow(sigma, 2.0) + r), beta);
}

float communication_coef( vec3 pos_i, vec3 pos_j ) {
    vec3 diff = pos_i - pos_j;
    return weight(dot(diff, diff));
}

void main()	{

    float delta = 1.0 / deltaDenominator;

    vec2 uv = gl_FragCoord.xy / resolution.xy;

    vec4 tmpPos = texture2D( texturePosition, uv );
    vec3 pos_i = tmpPos.xyz;

    vec4 tmpVel = texture2D( textureVelocity, uv );
    vec3 vel_i = tmpVel.xyz;
    float radius = tmpVel.w;

    vec3 acceleration = vec3( 1 );

    float distFromCenter = length(pos_i);
    if ( distFromCenter > sphericalBounds && sphericalBounds != 0.0) {
        vec3 normal = pos_i / distFromCenter;

        if (dot(vel_i, normal) > 0.0) {
            vel_i = reflect(vel_i, normal);
        }
    }

    // Bird interaction
    for ( float y = 0.0; y < height; y++ ) {

        for ( float x = 0.0; x < width; x++ ) {

            vec2 secondParticleCoords = vec2( x + 0.5, y + 0.5 ) / resolution.xy;
            vec3 pos_j = texture2D( texturePosition, secondParticleCoords ).xyz;
            vec4 velTemp2 = texture2D( textureVelocity, secondParticleCoords );
            vec3 vel_j = velTemp2.xyz;

            acceleration += communication_coef(pos_i, pos_j) * (vel_j - vel_i);
        }
    }

    acceleration = acceleration / (height * width);

    // Dynamics
    vel_i += delta * acceleration;

    gl_FragColor = vec4( vel_i, radius );
}