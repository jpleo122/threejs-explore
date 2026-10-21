precision highp float;

varying vec4 vColor;
varying vec3 vLightDir;

void main() {

    if ( vColor.a == 0.0 ) discard;

    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot( c, c );
    if ( r2 > 1.0 ) {
        discard;
    }

    vec3 normal = vec3( c.x, -c.y, sqrt( 1.0 - r2 ) );
    float key = max( dot( normal, vLightDir ), 0.0 );
    float back = max( dot( normal, -vLightDir ), 0.0 );

    gl_FragColor = vec4( vColor.rgb * ( 0.6 + 0.45 * key + 0.45 * back ), 1.0 );

}
