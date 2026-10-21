precision highp float;

varying vec4 vColor;
varying vec3 vNormal;

void main() {

    vec3 normal = normalize( vNormal );
    vec3 lightDir = normalize( vec3( 0.4, 0.7, 1.0 ) );

    float diffuse = max( dot( normal, lightDir ), 0.0 );
    float shade = 0.35 + 0.65 * diffuse;

    gl_FragColor = vec4( vColor.rgb * shade, vColor.a );

}
