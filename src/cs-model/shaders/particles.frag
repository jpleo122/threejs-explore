precision highp float;

varying vec4 vColor;
varying float vAngle;

void main() {

    if ( vColor.a == 0.0 ) discard;

    vec2 p = gl_PointCoord - 0.5;
    p.y = -p.y;
    float c = cos( vAngle ), s = sin( vAngle );
    p = mat2( c, -s, s, c ) * p;

    if ( p.x > 0.5 || p.x < -0.3 ) discard;
    float halfW = ( 0.5 - p.x ) * 0.4;
    if ( abs( p.y ) > halfW ) discard;

    gl_FragColor = vColor;

}