// For PI declaration:
// #include <common>

#define PI 3.141592653589793

// Injected by GPUComputationRenderer / three at runtime; guarded so editors resolve them.
#ifndef resolution
#define resolution vec2( 1.0 )
uniform sampler2D texturePosition;
uniform sampler2D textureVelocity;
precision highp float;
#endif

uniform float deltaDenominator;
uniform float gravityConstant;
uniform float density;
uniform float dampingFactor;

// const float width = resolution.x;
// const float height = resolution.y;

float radiusFromMass( float mass ) {
    // Calculate radius of a sphere from mass and density
    return pow( ( 3.0 / ( 4.0 * PI ) ) * mass / density, 1.0 / 3.0 );
}

mat4 rotationMatrix(vec3 axis, float angle)
{
    axis = normalize(axis);
    float s = sin(angle);
    float c = cos(angle);
    float oc = 1.0 - c;
    
    return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
                oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
                oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
                0.0,                                0.0,                                0.0,                                1.0);
}

void main()	{

    float delta = 1.0 / deltaDenominator;

    vec2 uv = gl_FragCoord.xy / resolution.xy;
    float idParticle = uv.y * resolution.x + uv.x;

    vec4 tmpPos = texture2D( texturePosition, uv );
    vec3 pos = tmpPos.xyz;

    vec4 tmpVel = texture2D( textureVelocity, uv );
    vec3 vel = tmpVel.xyz;
    float mass = tmpVel.w;

    if ( mass > 0.0 ) {

        vec3 neg_y = vec3 ( 0.0, -1.0, 0.0);

        vec3 normlized_pos = (pos / length(pos));

        vec3 axis = cross(normlized_pos, neg_y);
        vec3 tangent = normalize(cross(axis, normlized_pos));

        float sin_theta = length(axis);

        // float angle = acos(dot(pos, acceleration) / (length(pos) * length(acceleration)));

        // // SPHERICAL BOUNDS
        // float distFromCenter = length(pos);
        // if ( distFromCenter > simulationRadius) {
        //     vec3 normal = pos / distFromCenter;

        //     if (dot(vel, normal) > 0.0) {
        //         vel = reflect(vel, normal);
        //     }
        // }

        // // PARTICLE INTERACTION
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

        //         if ( distance < mass + radius2 ) {

        //             vec3 normal1 = dPos / distance;

        //             if (dot(vel, normal1) > 0.0) {
        //                 vel = reflect(vel, normal1);
        //             }
        //         }
        //     }

        //     if ( mass == 0.0 ) {
        //         break;
        //     }
        // }

        // Dynamics
        // vec3 accel_gravity = gravityConstant * sin_theta * tangent;
        // position.frag is moving pos by the old vel this frame; aim the following step back onto the circle
        vec3 posNext = pos + vel * delta;
        vec3 rNext = normalize(posNext);
        float rodLength = length(posNext);

        vec3 accel_gravity = (neg_y * gravityConstant) - dot(neg_y * gravityConstant, rNext) * rNext;
        vec3 accel_rod = (dot(vel, vel) / rodLength) * rNext;
        vec3 acceleration = accel_gravity - accel_rod;

        vel += delta * acceleration;

        vec3 velTangent = vel - dot(vel, rNext) * rNext;
        float radialStep = sqrt(max(rodLength * rodLength - dot(velTangent, velTangent) * delta * delta, 0.0)) - length(posNext);
        vel = velTangent + (radialStep / delta) * rNext;

        vel -= (dampingFactor / mass) * vel;
    }

    gl_FragColor = vec4( vel, mass );
}