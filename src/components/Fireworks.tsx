import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';

interface ParticleData {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
}

interface FireworksProps {
  position?: [number, number, number];
  delay?: number;
  count?: number;
  spread?: number;
  duration?: number;
}

const Fireworks: React.FC<FireworksProps> = ({
  position = [0, 0, 0],
  delay = 0,
  count = 100,
  spread = 3,
  duration = 2
}) => {
  const pointsRef = useRef<THREE.Points>(null);
  const particlesRef = useRef<ParticleData[]>([]);
  const activeRef = useRef(false);
  const startTimeRef = useRef(0);
  
  const { geometry, material } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        uniform float uPixelRatio;
        
        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * uPixelRatio * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        
        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;
          
          float alpha = 1.0 - smoothstep(0.2, 0.5, dist);
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    
    return { geometry: geo, material: mat };
  }, [count]);
  
  // Initialize particles
  useEffect(() => {
    particlesRef.current = [];
    
    const colors = [
      new THREE.Color('#ffd700'),
      new THREE.Color('#ffaa00'),
      new THREE.Color('#ffffff'),
      new THREE.Color('#ff6600'),
      new THREE.Color('#ffcc00')
    ];
    
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const elevation = (Math.random() - 0.5) * Math.PI;
      const speed = 0.5 + Math.random() * 2;
      
      particlesRef.current.push({
        position: new THREE.Vector3(0, 0, 0),
        velocity: new THREE.Vector3(
          Math.cos(angle) * Math.cos(elevation) * speed,
          Math.sin(elevation) * speed * 0.8 + 0.5,
          Math.sin(angle) * Math.cos(elevation) * speed
        ),
        life: 0,
        maxLife: 0.5 + Math.random() * 1.5,
        size: 0.05 + Math.random() * 0.15,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
    
    // Trigger animation after delay
    const timeout = setTimeout(() => {
      activeRef.current = true;
      startTimeRef.current = Date.now();
    }, delay * 1000);
    
    return () => clearTimeout(timeout);
  }, [count, delay]);
  
  useFrame((state, delta) => {
    if (!pointsRef.current || !activeRef.current) return;
    
    const positions = geometry.attributes.position.array as Float32Array;
    const colors = geometry.attributes.color.array as Float32Array;
    const sizes = geometry.attributes.size.array as Float32Array;
    
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    
    particlesRef.current.forEach((particle, i) => {
      if (elapsed < particle.maxLife) {
        // Update position
        particle.velocity.y -= delta * 1.5; // gravity
        particle.position.add(particle.velocity.clone().multiplyScalar(delta * spread));
        particle.life = elapsed;
        
        // Fade out
        const lifeRatio = 1 - (elapsed / particle.maxLife);
        
        positions[i * 3] = particle.position.x;
        positions[i * 3 + 1] = particle.position.y;
        positions[i * 3 + 2] = particle.position.z;
        
        colors[i * 3] = particle.color.r * lifeRatio;
        colors[i * 3 + 1] = particle.color.g * lifeRatio;
        colors[i * 3 + 2] = particle.color.b * lifeRatio;
        
        sizes[i] = particle.size * lifeRatio;
      } else {
        sizes[i] = 0;
      }
    });
    
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    geometry.attributes.size.needsUpdate = true;
  });
  
  return (
    <points ref={pointsRef} position={position}>
      <primitive object={geometry} attach="geometry" />
      <primitive object={material} attach="material" />
    </points>
  );
};

export default Fireworks;
