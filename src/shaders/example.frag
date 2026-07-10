precision highp float;

uniform float uTime;
uniform vec2 uMouse;

varying vec2 vUv;

void main() {
  float d = distance(vUv, uMouse);
  vec3 color = 0.5 + 0.5 * cos(d + vUv.xyx + vec3(0.0, 2.0, 4.0));
  // vec3 color = mix(vec3(1.0), vUv.xyx, smoothstep(0.0, 0.3, d));
  gl_FragColor = vec4(color, 1.0);
}
