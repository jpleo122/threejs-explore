// For PI declaration:
#include <common>

#define delta ( 1.0 / 60.0 )

// Injected by GPUComputationRenderer / three at runtime; guarded so editors resolve them.
#ifndef resolution
#define resolution vec2( 1.0 )
#define PI 3.141592653589793
uniform sampler2D texturePosition;
uniform sampler2D textureVelocity;
precision highp float;
#endif

// uniform float gravityConstant;
// uniform float density;
uniform float simulationRadius;

const float width = resolution.x;
const float height = resolution.y;

void main()	{

    vec2 uv = gl_FragCoord.xy / resolution.xy;
    float idParticle = uv.y * resolution.x + uv.x;

    vec4 tmpPos = texture2D( texturePosition, uv );
    vec3 pos = tmpPos.xyz;

    vec4 tmpVel = texture2D( textureVelocity, uv );
    vec3 vel = tmpVel.xyz;
    float radius = tmpVel.w;

    if ( radius > 0.0 ) {

        vec3 direction = vec3( 1 );

        float distFromCenter = length(pos);

        if ( distFromCenter > simulationRadius) {
            vec3 normal = pos / distFromCenter;

            if (dot(vel, normal) > 0.0) {
                vel = reflect(vel, normal);
            }
        }

        // // Gravity interaction
        // for ( float y = 0.0; y < height; y++ ) {

        //     for ( float x = 0.0; x < width; x++ ) {

        //         vec2 secondParticleCoords = vec2( x + 0.5, y + 0.5 ) / resolution.xy;
        //         vec3 pos2 = texture2D( texturePosition, secondParticleCoords ).xyz;
        //         vec4 velTemp2 = texture2D( textureVelocity, secondParticleCoords );
        //         vec3 vel2 = velTemp2.xyz;
        //         float radius2 = velTemp2.w;

        //         float idParticle2 = secondParticleCoords.y * resolution.x + secondParticleCoords.x;

        //         if ( idParticle == idParticle2 ) {
        //             continue;
        //         }

        //         if ( radius2 == 0.0 ) {
        //             continue;
        //         }

        //         vec3 dPos = pos2 - pos;
        //         float distance = length( dPos );

        //         if ( distance == 0.0 ) {
        //             continue;
        //         }

        //         // Checks collision

        //         if ( distance < radius + radius2 ) {

        //             if ( idParticle < idParticle2 ) {



        //                 // This particle is aggregated by the other
        //                 vel = ( vel * mass + vel2 * mass2 ) / ( mass + mass2 );
        //                 mass += mass2;
        //                 radius = radiusFromMass( mass );

        //             }
        //             else {

        //                 // This particle dies
        //                 mass = 0.0;
        //                 radius = 0.0;
        //                 vel = vec3( 0.0 );
        //                 break;

        //             }

        //         }

        //         float distanceSq = distance * distance;

        //         float gravityField = gravityConstant * mass2 / distanceSq;

        //         gravityField = min( gravityField, 1000.0 );

        //         acceleration += gravityField * normalize( dPos );

        //     }

        //     if ( radius == 0.0 ) {
        //         break;
        //     }
        // }

        // Dynamics
        vel += delta * direction;

    }

    gl_FragColor = vec4( vel, radius );
}