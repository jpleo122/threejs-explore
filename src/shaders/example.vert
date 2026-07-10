precision highp float;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uTime;

attribute vec3 position;
attribute vec2 uv;

varying vec2 vUv;

void main() {
  vUv = uv;
  // vec3 newPos = vec3(cos(uTime) * position.x, position.yz);
  vec3 newPos = vec3(position.x * cos(uTime), position.y,position.z);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
}
