precision highp float;

varying vec4 vColor;
varying float vAngle;

const vec3 edgeColor = vec3( 1.0 );
const float edgeWidth = 0.06;

void main() {

    if ( vColor.a == 0.0 ) discard;

    vec2 p = gl_PointCoord - 0.5;
    p.y = -p.y;
    float c = cos( vAngle ), s = sin( vAngle );
    p = mat2( c, -s, s, c ) * p;

    if ( p.x > 0.5 || p.x < -0.3 ) discard;
    float halfW = ( 0.5 - p.x ) * 0.4;
    if ( abs( p.y ) > halfW ) discard;

    float dBack = p.x + 0.3;
    float dSide = ( halfW - abs( p.y ) ) / 1.077;
    float edge  = min( dBack, dSide );

    float t = smoothstep( 0.0, edgeWidth, edge );
    gl_FragColor = vec4( mix( edgeColor, vColor.rgb, t ), vColor.a );

}