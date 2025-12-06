import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';

interface SpotlightBeamProps {
  position?: [number, number, number];
  targetPosition?: [number, number, number];
  intensity?: number;
  angle?: number;
  penumbra?: number;
  distance?: number;
  animationDelay?: number;
  visible?: boolean;
  color?: string;
  scale?: [number, number, number];
  spread?: number;
}

// 2D Spotlight cone shader - creates flat triangular beam
const spotlightVertexShader = `
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const spotlightFragmentShader = `
  uniform float uOpacity;
  uniform float uIntensity;
  uniform vec3 uColor;
  uniform float uTime;
  
  varying vec2 vUv;
  
  // Simple noise function
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  
  void main() {
    vec2 uv = vUv;
    
    // Flip Y so narrow end is at top of screen, wide at bottom
    float flippedY = 1.0 - uv.y;
    
    // Create cone shape: narrow at top (flippedY=0), wide at bottom (flippedY=1)
    float coneWidth = mix(0.02, 0.5, flippedY);
    float distFromCenter = abs(uv.x - 0.5);
    
    // Check if pixel is inside the cone
    float insideCone = 1.0 - smoothstep(coneWidth * 0.8, coneWidth, distFromCenter);
    
    // If outside cone, discard
    if (insideCone < 0.01) {
      discard;
    }
    
    // Soft edges
    float edgeSoftness = 1.0 - smoothstep(coneWidth * 0.3, coneWidth, distFromCenter);
    edgeSoftness = pow(edgeSoftness, 1.5);
    
    // Vertical gradient - brighter at source (top), fading strongly toward bottom
    float verticalGradient = 1.0 - flippedY * 0.8;
    verticalGradient = pow(verticalGradient, 1.2);
    
    // Fade out the bottom portion of the beam completely
    float bottomFade = 1.0 - smoothstep(0.6, 0.95, flippedY);
    verticalGradient *= bottomFade;
    
    // Center brightness falloff
    float centerBrightness = 1.0 - (distFromCenter / coneWidth) * 0.5;
    
    // Subtle animated fog/haze
    float fog = noise(uv * vec2(3.0, 8.0) + uTime * 0.05) * 0.15 + 0.85;
    
    // Very subtle light rays
    float rays = noise(vec2(uv.x * 20.0, flippedY * 4.0 + uTime * 0.03));
    rays = pow(rays, 3.0) * 0.08 * edgeSoftness;
    
    // Combine
    float beamIntensity = edgeSoftness * verticalGradient * centerBrightness * fog;
    beamIntensity += rays;
    beamIntensity *= uIntensity;
    
    // Color with slight blue-white tint
    vec3 beamColor = mix(uColor, vec3(0.9, 0.95, 1.0), 0.1);
    
    float alpha = beamIntensity * uOpacity * insideCone;
    alpha = clamp(alpha, 0.0, 0.25);
    
    gl_FragColor = vec4(beamColor, alpha);
  }
`;

const SpotlightBeam: React.FC<SpotlightBeamProps> = ({
  position = [0, 8, 0],
  targetPosition = [0, 0, 0],
  intensity = 0.5,
  angle = Math.PI / 6,
  penumbra = 0.5,
  distance = 15,
  animationDelay = 0,
  visible = true,
  color = '#ffffff',
  scale = [1, 1, 1],
  spread = 0.5
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const animationRef = useRef({ opacity: 0 });

  // Create shader material
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: spotlightVertexShader,
      fragmentShader: spotlightFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uOpacity: { value: 0 },
        uIntensity: { value: intensity },
        uColor: { value: new THREE.Color(color) },
        uTime: { value: 0 }
      }
    });
  }, [color, intensity]);

  // Dispose material on unmount to prevent GPU memory leaks
  useEffect(() => {
    return () => {
      shaderMaterial.dispose();
    };
  }, [shaderMaterial]);

  // Animate visibility
  useEffect(() => {
    if (visible) {
      gsap.to(animationRef.current, {
        opacity: 1,
        duration: 2.0,
        delay: animationDelay,
        ease: 'power2.inOut',
        onUpdate: () => {
          if (shaderMaterial.uniforms) {
            shaderMaterial.uniforms.uOpacity.value = animationRef.current.opacity;
          }
        }
      });
    } else {
      gsap.to(animationRef.current, {
        opacity: 0,
        duration: 1.0,
        ease: 'power2.inOut',
        onUpdate: () => {
          if (shaderMaterial.uniforms) {
            shaderMaterial.uniforms.uOpacity.value = animationRef.current.opacity;
          }
        }
      });
    }

    return () => {
      gsap.killTweensOf(animationRef.current);
    };
  }, [animationDelay, visible, shaderMaterial]);

  // Calculate plane size and orientation
  useEffect(() => {
    if (!meshRef.current) return;

    const start = new THREE.Vector3(...position);
    const end = new THREE.Vector3(...targetPosition);
    const direction = end.clone().sub(start);
    const beamLength = direction.length();
    
    // Calculate beam width at bottom based on angle and spread
    const beamWidth = Math.tan(angle) * beamLength * spread * 2;
    
    // Scale the plane
    meshRef.current.scale.set(beamWidth, beamLength, 1);
    
    // Position at midpoint between source and target
    const midpoint = start.clone().add(end).multiplyScalar(0.5);
    meshRef.current.position.copy(midpoint);
    
    // Rotate to face camera and point in beam direction
    const angleToTarget = Math.atan2(direction.x, -direction.y);
    meshRef.current.rotation.z = angleToTarget;
  }, [position, targetPosition, angle, spread]);

  // Update time uniform
  useFrame((state) => {
    if (shaderMaterial.uniforms) {
      shaderMaterial.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[1, 1, 1, 1]} />
      <primitive object={shaderMaterial} attach="material" />
    </mesh>
  );
};

export default SpotlightBeam;