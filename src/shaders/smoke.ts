import * as THREE from 'three';

export const smokeVertexShader = `
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const smokeFragmentShader = `
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uColor;
  
  varying vec2 vUv;
  
  // Simplex 2D noise
  vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
             -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy) );
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
    + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
      dot(x12.zw,x12.zw)), 0.0);
    m = m*m ;
    m = m*m ;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
  
  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    
    for (int i = 0; i < 6; i++) {
      value += amplitude * (snoise(p * frequency) * 0.5 + 0.5);
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    
    return value;
  }
  
  void main() {
    vec2 uv = vUv;
    
    // Slow moving smoke layers
    float time = uTime * 0.08;
    
    vec2 movement1 = vec2(time * 0.3, time * 0.1);
    vec2 movement2 = vec2(-time * 0.2, time * 0.15);
    vec2 movement3 = vec2(time * 0.1, -time * 0.05);
    
    float smoke1 = fbm(uv * 2.0 + movement1);
    float smoke2 = fbm(uv * 3.0 + movement2 + 50.0);
    float smoke3 = fbm(uv * 1.5 + movement3 + 100.0);
    
    // Combine smoke layers
    float smoke = (smoke1 * 0.5 + smoke2 * 0.3 + smoke3 * 0.2);
    
    // Create billowing effect
    smoke = pow(smoke, 0.8);
    
    // Fade at edges
    float edgeFadeX = smoothstep(0.0, 0.25, uv.x) * smoothstep(1.0, 0.75, uv.x);
    float topFade = smoothstep(1.0, 0.3, uv.y);
    float bottomFade = smoothstep(0.0, 0.15, uv.y);
    
    // Apply fades
    smoke *= edgeFadeX * topFade * bottomFade;
    
    // Add some wispy tendrils rising up
    float wisps = snoise(vec2(uv.x * 8.0, uv.y * 2.0 - time * 2.0));
    wisps = max(0.0, wisps) * 0.3 * topFade * edgeFadeX;
    smoke += wisps;
    
    vec3 color = uColor;
    float alpha = smoke * uOpacity;
    
    gl_FragColor = vec4(color, alpha);
  }
`;

export const createSmokeMaterial = (opacity: number = 0.5) => {
  return new THREE.ShaderMaterial({
    vertexShader: smokeVertexShader,
    fragmentShader: smokeFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: opacity },
      uColor: { value: new THREE.Color(0.45, 0.5, 0.6) }
    }
  });
};
