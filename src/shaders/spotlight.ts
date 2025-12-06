import * as THREE from 'three';

export const spotlightVertexShader = `
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const spotlightFragmentShader = `
  uniform float uOpacity;
  uniform float uIntensity;
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uSpread;
  
  varying vec2 vUv;
  
  // Simplex noise
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
  
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
             -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m;
    m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
  
  void main() {
    vec2 uv = vUv;
    
    // Create wide cone - expands from top to bottom
    float coneExpand = pow(uv.y, 0.4) * uSpread;
    float distFromCenter = abs(uv.x - 0.5);
    
    // Main beam with very soft edges
    float beam = 1.0 - smoothstep(0.0, coneExpand, distFromCenter);
    beam = pow(beam, 0.6); // Softer falloff
    
    // Vertical gradient - bright at top, fading to center/bottom
    float verticalFade = pow(1.0 - uv.y * 0.7, 0.4);
    
    // Volumetric haze effect
    float haze1 = snoise(uv * vec2(2.0, 4.0) + uTime * 0.03) * 0.5 + 0.5;
    float haze2 = snoise(uv * vec2(3.0, 6.0) - uTime * 0.02) * 0.5 + 0.5;
    float haze = mix(haze1, haze2, 0.5) * 0.4 + 0.6;
    
    // Soft glow around the beam
    float glow = exp(-distFromCenter * 4.0 / coneExpand) * 0.4;
    glow *= verticalFade;
    
    // Light source at top
    float sourceY = smoothstep(0.12, 0.0, uv.y);
    float sourceX = smoothstep(0.08, 0.0, distFromCenter);
    float source = sourceY * sourceX * 3.0;
    
    // Combine everything
    float intensity = beam * verticalFade * haze * uIntensity;
    intensity += glow;
    intensity += source;
    
    // Subtle dust particles
    float dust = snoise(uv * 30.0 + uTime * 0.2);
    dust = smoothstep(0.6, 1.0, dust) * beam * verticalFade * 0.15;
    intensity += dust;
    
    vec3 color = uColor;
    float alpha = intensity * uOpacity;
    
    gl_FragColor = vec4(color, alpha);
  }
`;

export const createSpotlightMaterial = (intensity: number = 1.0, spread: number = 0.45) => {
  return new THREE.ShaderMaterial({
    vertexShader: spotlightVertexShader,
    fragmentShader: spotlightFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uOpacity: { value: 0.55 },
      uIntensity: { value: intensity },
      uColor: { value: new THREE.Color(0.85, 0.88, 0.95) },
      uTime: { value: 0 },
      uSpread: { value: spread }
    }
  });
};
