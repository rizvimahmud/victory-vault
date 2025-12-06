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

    // Create wide, visible cone
    float coneProgress = pow(uv.y, 0.4);
    float coneWidth = 0.15 + coneProgress * uSpread;
    float distFromCenter = abs(uv.x - 0.5);

    // Sharp, highly visible core beam
    float coreBeam = 1.0 - smoothstep(coneWidth * 0.25, coneWidth * 0.45, distFromCenter);
    coreBeam = pow(coreBeam, 3.0);

    // Wide inner glow for visibility
    float innerGlow = 1.0 - smoothstep(coneWidth * 0.4, coneWidth * 0.8, distFromCenter);
    innerGlow = pow(innerGlow, 2.0);

    // Broad outer atmosphere
    float outerGlow = 1.0 - smoothstep(coneWidth * 0.6, coneWidth * 1.4, distFromCenter);
    outerGlow = pow(outerGlow, 1.5);

    // Maintain brightness throughout - less fade
    float verticalFade = pow(1.0 - uv.y * 0.4, 0.2);

    // Very bright light source at top
    float sourceIntensity = smoothstep(0.2, 0.0, uv.y) * smoothstep(0.15, 0.0, distFromCenter);
    sourceIntensity = pow(sourceIntensity, 0.4) * 8.0;

    // Minimal fog interference
    float fog1 = snoise(uv * vec2(2.0, 4.0) + uTime * 0.03) * 0.5 + 0.5;
    float fog2 = snoise(uv * vec2(3.0, 5.0) - uTime * 0.02) * 0.5 + 0.5;
    float fog = mix(fog1, fog2, 0.5) * 0.1 + 0.9;

    // Visible god rays
    float rays = snoise(vec2(uv.x * 8.0, uv.y * 2.0 + uTime * 0.05)) * 0.5 + 0.5;
    rays = pow(rays, 2.0) * innerGlow * 0.5;

    // Subtle particles
    float particles = snoise(uv * 35.0 + uTime * 0.15);
    particles = smoothstep(0.75, 1.0, particles) * innerGlow * 0.3;

    // Build bright, visible beam
    float mainBeam = coreBeam * fog * verticalFade * 5.0;
    float midLayer = innerGlow * verticalFade * 3.0;
    float atmosphere = outerGlow * verticalFade * 1.5;

    // Combine with high intensity
    float intensity = mainBeam * uIntensity;
    intensity += midLayer * uIntensity;
    intensity += atmosphere * uIntensity;
    intensity += sourceIntensity;
    intensity += rays;
    intensity += particles;

    // Very strong target illumination
    float targetGlow = smoothstep(0.5, 1.0, uv.y) * (coreBeam + innerGlow * 0.5) * 4.0;
    intensity += targetGlow;

    // Bright hotspot at bottom
    float hotspot = smoothstep(0.8, 1.0, uv.y) * (coreBeam + innerGlow) * 5.0;
    intensity += hotspot;

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
      uOpacity: { value: 0.9 },
      uIntensity: { value: intensity },
      uColor: { value: new THREE.Color(1.0, 1.0, 1.0) },
      uTime: { value: 0 },
      uSpread: { value: spread }
    }
  });
};
