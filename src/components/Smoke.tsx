import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createSmokeMaterial } from '../shaders/smoke';

interface SmokeProps {
  position?: [number, number, number];
  scale?: [number, number, number];
  opacity?: number;
}

const Smoke: React.FC<SmokeProps> = ({ 
  position = [0, -3, 0], 
  scale = [15, 4, 1],
  opacity = 0.35
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const material = useMemo(() => {
    return createSmokeMaterial(opacity);
  }, [opacity]);
  
  // Dispose material on unmount
  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);
  
  useFrame((state) => {
    if (material.uniforms) {
      material.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });
  
  return (
    <mesh ref={meshRef} position={position} scale={scale}>
      <planeGeometry args={[1, 1, 32, 32]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
};

export default Smoke;
