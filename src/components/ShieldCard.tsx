import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';

// Shimmer shader for card border
const shimmerVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const shimmerFragmentShader = `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uShimmerSpeed;
  
  varying vec2 vUv;
  
  void main() {
    vec2 uv = vUv;
    
    // Create shimmer wave moving around the border
    float shimmer = sin((uv.x + uv.y) * 10.0 - uTime * uShimmerSpeed) * 0.5 + 0.5;
    shimmer = pow(shimmer, 3.0);
    
    // Bright spots
    vec3 color = uColor + vec3(shimmer * 0.4);
    
    gl_FragColor = vec4(color, 1.0);
  }
`;

interface ShieldCardProps {
  position?: [number, number, number];
  frontContent?: string;
  backContent?: string;
  scale?: number;
  isFlipped?: boolean;
  isSelected?: boolean;
  isWinner?: boolean;
  showSadEmoji?: boolean;
  onClick?: () => void;
  entranceDelay?: number;
  disabled?: boolean;
}

const ShieldCard: React.FC<ShieldCardProps> = ({
  position = [0, 0, 0],
  frontContent = '?',
  backContent = '1',
  scale = 1,
  isFlipped = false,
  isSelected = false,
  isWinner = false,
  showSadEmoji = false,
  onClick,
  entranceDelay = 0,
  disabled = false
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const shimmerMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  const [hovered, setHovered] = useState(false);
  
  const animState = useRef({
    rotationY: 0,
    scale: 0,
    positionZ: 0,
    hoverScale: 1
  });
  
  // Create shield shape
  const shieldShape = useMemo(() => {
    const shape = new THREE.Shape();
    const width = 1.35;
    const height = 1.65;
    
    shape.moveTo(-width/2 + 0.1, height/2);
    shape.lineTo(width/2 - 0.1, height/2);
    shape.quadraticCurveTo(width/2, height/2, width/2, height/2 - 0.1);
    shape.lineTo(width/2, -height/4);
    shape.quadraticCurveTo(width/2, -height/2 + 0.1, 0, -height/2 - 0.28);
    shape.quadraticCurveTo(-width/2, -height/2 + 0.1, -width/2, -height/4);
    shape.lineTo(-width/2, height/2 - 0.1);
    shape.quadraticCurveTo(-width/2, height/2, -width/2 + 0.1, height/2);
    
    return shape;
  }, []);
  
  const innerShieldShape = useMemo(() => {
    const shape = new THREE.Shape();
    const width = 1.18;
    const height = 1.48;
    
    shape.moveTo(-width/2 + 0.08, height/2);
    shape.lineTo(width/2 - 0.08, height/2);
    shape.quadraticCurveTo(width/2, height/2, width/2, height/2 - 0.08);
    shape.lineTo(width/2, -height/4);
    shape.quadraticCurveTo(width/2, -height/2 + 0.08, 0, -height/2 - 0.22);
    shape.quadraticCurveTo(-width/2, -height/2 + 0.08, -width/2, -height/4);
    shape.lineTo(-width/2, height/2 - 0.08);
    shape.quadraticCurveTo(-width/2, height/2, -width/2 + 0.08, height/2);
    
    return shape;
  }, []);
  
  // Shimmer material
  const shimmerMaterial = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: shimmerVertexShader,
      fragmentShader: shimmerFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color('#c9a648') },
        uShimmerSpeed: { value: 2.0 }
      }
    });
    shimmerMaterialRef.current = mat;
    return mat;
  }, []);
  
  // Entrance animation
  useEffect(() => {
    gsap.to(animState.current, {
      scale: 1,
      duration: 0.7,
      delay: entranceDelay,
      ease: 'back.out(1.4)'
    });
    
    return () => {
      gsap.killTweensOf(animState.current);
    };
  }, [entranceDelay]);
  
  // Flip and zoom animation when selected
  useEffect(() => {
    if (isSelected) {
      // Zoom towards camera then flip
      const tl = gsap.timeline();
      
      tl.to(animState.current, {
        positionZ: 2,
        scale: 1.3,
        duration: 0.4,
        ease: 'power2.out'
      })
      .to(animState.current, {
        rotationY: Math.PI,
        duration: 0.5,
        ease: 'power2.inOut'
      })
      .to(animState.current, {
        positionZ: 0,
        scale: 1,
        duration: 0.3,
        ease: 'power2.in'
      });
      
      return () => { tl.kill(); };
    }
  }, [isSelected]);
  
  // Hover effect
  useEffect(() => {
    if (disabled) return;
    
    gsap.to(animState.current, {
      hoverScale: hovered ? 1.06 : 1,
      duration: 0.2,
      ease: 'power2.out'
    });
  }, [hovered, disabled]);
  
  // Winner pulse animation
  useEffect(() => {
    if (isWinner) {
      gsap.to(animState.current, {
        scale: 1.15,
        duration: 0.25,
        ease: 'power2.out',
        yoyo: true,
        repeat: 2
      });
    }
  }, [isWinner]);
  
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = animState.current.rotationY;
      const s = animState.current.scale * scale * animState.current.hoverScale;
      groupRef.current.scale.set(s, s, s);
      groupRef.current.position.z = position[2] + animState.current.positionZ;
    }
    
    if (shimmerMaterialRef.current) {
      shimmerMaterialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });
  
  const handleClick = () => {
    if (!disabled && onClick) {
      onClick();
    }
  };
  
  // Determine what to show on back of card
  const backDisplay = showSadEmoji ? '😢' : backContent;
  
  return (
    <group 
      ref={groupRef} 
      position={position}
      onClick={handleClick}
      onPointerOver={() => !disabled && setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {/* Front face */}
      <group rotation={[0, 0, 0]}>
        {/* Gold shimmer border */}
        <mesh position={[0, 0, -0.02]}>
          <shapeGeometry args={[shieldShape]} />
          <primitive object={shimmerMaterial} attach="material" />
        </mesh>
        
        {/* Blue inner with gradient effect */}
        <mesh position={[0, 0, -0.01]}>
          <shapeGeometry args={[innerShieldShape]} />
          <meshBasicMaterial color="#1a3a5c" side={THREE.FrontSide} />
        </mesh>
        
        {/* Inner accent border */}
        <mesh position={[0, 0, 0]} scale={[0.94, 0.94, 1]}>
          <shapeGeometry args={[innerShieldShape]} />
          <meshBasicMaterial color="#2a5a8c" side={THREE.FrontSide} transparent opacity={0.6} />
        </mesh>
        
        {/* Inner glow line */}
        <mesh position={[0, 0, 0.005]} scale={[0.92, 0.92, 1]}>
          <shapeGeometry args={[innerShieldShape]} />
          <meshBasicMaterial color="#3da9fc" side={THREE.FrontSide} transparent opacity={0.15} />
        </mesh>
        
        {/* Front text */}
        <Text
          position={[0, -0.05, 0.02]}
          fontSize={0.95}
          color="#c9a648"
          anchorX="center"
          anchorY="middle"
          font="/fonts/BebasNeue-Regular.ttf"
        >
          {frontContent}
        </Text>
      </group>
      
      {/* Back face */}
      <group rotation={[0, Math.PI, 0]}>
        {/* Gold shimmer border */}
        <mesh position={[0, 0, -0.02]}>
          <shapeGeometry args={[shieldShape]} />
          <meshBasicMaterial color={isWinner ? '#ffd700' : (showSadEmoji ? '#666' : '#c9a648')} />
        </mesh>
        
        {/* Blue inner */}
        <mesh position={[0, 0, -0.01]}>
          <shapeGeometry args={[innerShieldShape]} />
          <meshBasicMaterial color={showSadEmoji ? '#2a2a3a' : '#1a3a5c'} side={THREE.FrontSide} />
        </mesh>
        
        {/* Back text/emoji */}
        <Text
          position={[0, -0.05, 0.02]}
          fontSize={showSadEmoji ? 0.7 : 0.95}
          color={isWinner ? '#ffd700' : (showSadEmoji ? '#888' : '#c9a648')}
          anchorX="center"
          anchorY="middle"
          font={showSadEmoji ? undefined : "/fonts/BebasNeue-Regular.ttf"}
        >
          {backDisplay}
        </Text>
      </group>
      
      {/* Glow effects for winner */}
      {isWinner && (
        <>
          <pointLight position={[0, 0, 0.5]} intensity={1} color="#ffd700" distance={3} />
        </>
      )}
    </group>
  );
};

export default ShieldCard;
