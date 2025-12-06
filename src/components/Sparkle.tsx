import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';

interface SparkleProps {
  position?: [number, number, number];
  color?: string;
  size?: number;
  delay?: number;
  duration?: number;
}

const Sparkle: React.FC<SparkleProps> = ({ 
  position = [0, 0, 0],
  color = '#3da9fc',
  size = 0.15,
  delay = 0,
  duration = 1
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const scaleRef = useRef({ value: 0 });
  const rotationRef = useRef({ value: 0 });
  
  // Create 4-pointed star shape - memoize to prevent recreation
  const starShape = useMemo(() => {
    const shape = new THREE.Shape();
    const points = 4;
    const outerRadius = size;
    const innerRadius = size * 0.15;
    
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      
      if (i === 0) {
        shape.moveTo(x, y);
      } else {
        shape.lineTo(x, y);
      }
    }
    shape.closePath();
    
    return shape;
  }, [size]);
  
  useEffect(() => {
    if (!groupRef.current) return;
    
    // Scale animation
    const tl = gsap.timeline({ delay });
    
    tl.to(scaleRef.current, {
      value: 1,
      duration: duration * 0.3,
      ease: 'back.out(2)'
    })
    .to(scaleRef.current, {
      value: 1.2,
      duration: duration * 0.4,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: 1
    })
    .to(scaleRef.current, {
      value: 0,
      duration: duration * 0.3,
      ease: 'power2.in'
    });
    
    // Rotation animation
    const rotationTween = gsap.to(rotationRef.current, {
      value: Math.PI * 0.5,
      duration: duration,
      delay,
      ease: 'sine.inOut'
    });
    
    return () => {
      tl.kill();
      rotationTween.kill();
    };
  }, [delay, duration]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      gsap.killTweensOf(scaleRef.current);
      gsap.killTweensOf(rotationRef.current);
    };
  }, []);
  
  useFrame(() => {
    if (groupRef.current) {
      const scale = scaleRef.current.value;
      groupRef.current.scale.set(scale, scale, scale);
      groupRef.current.rotation.z = rotationRef.current.value;
    }
  });
  
  return (
    <group ref={groupRef} position={position}>
      <mesh>
        <shapeGeometry args={[starShape]} />
        <meshBasicMaterial 
          color={color} 
          transparent 
          opacity={0.9}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Glow effect */}
      <mesh scale={[1.3, 1.3, 1]}>
        <shapeGeometry args={[starShape]} />
        <meshBasicMaterial 
          color={color} 
          transparent 
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
};

export default Sparkle;
