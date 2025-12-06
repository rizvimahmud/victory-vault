import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';
import { createSpotlightMaterial } from '../shaders/spotlight';

interface SpotlightBeamProps {
  position?: [number, number, number];
  targetPosition?: [number, number, number];
  scale?: [number, number, number];
  intensity?: number;
  spread?: number;
  animationDelay?: number;
  visible?: boolean;
}

const SpotlightBeam: React.FC<SpotlightBeamProps> = ({ 
  position = [0, 5, 0],
  targetPosition = [0, 0, 0],
  scale = [8, 10, 1],
  intensity = 0.8,
  spread = 0.45,
  animationDelay = 0,
  visible = true
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const opacityRef = useRef({ value: 0 });
  
  const material = useMemo(() => {
    const mat = createSpotlightMaterial(intensity, spread);
    materialRef.current = mat;
    return mat;
  }, [intensity, spread]);
  
  // Calculate rotation to point at target
  const rotation = useMemo(() => {
    const dx = targetPosition[0] - position[0];
    const dy = targetPosition[1] - position[1];
    const angle = Math.atan2(dx, -dy);
    return [0, 0, -angle] as [number, number, number];
  }, [position, targetPosition]);
  
  useEffect(() => {
    if (!materialRef.current) return;
    
    const mat = materialRef.current;
    
    if (visible) {
      gsap.to(opacityRef.current, {
        value: 0.55,
        duration: 1.2,
        delay: animationDelay,
        ease: 'power2.out',
        onUpdate: () => {
          mat.uniforms.uOpacity.value = opacityRef.current.value;
        }
      });
    } else {
      gsap.to(opacityRef.current, {
        value: 0,
        duration: 0.5,
        onUpdate: () => {
          mat.uniforms.uOpacity.value = opacityRef.current.value;
        }
      });
    }
    
    return () => {
      gsap.killTweensOf(opacityRef.current);
    };
  }, [animationDelay, visible]);
  
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });
  
  return (
    <mesh 
      ref={meshRef} 
      position={position} 
      rotation={rotation}
      scale={scale}
    >
      <planeGeometry args={[1, 1, 1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
};

export default SpotlightBeam;
