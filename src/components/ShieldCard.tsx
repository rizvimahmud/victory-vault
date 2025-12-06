import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';

// Gold gradient shader for border
const goldBorderVertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  void main() {
    vUv = uv;
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const goldBorderFragmentShader = `
  uniform float uTime;
  
  varying vec2 vUv;
  varying vec3 vPosition;
  
  void main() {
    vec2 uv = vUv;
    
    // Gold gradient from top-left to bottom-right
    float gradient = (uv.x + uv.y) * 0.5;
    
    // Base gold colors
    vec3 goldLight = vec3(0.95, 0.85, 0.55);  // Light gold
    vec3 goldMid = vec3(0.80, 0.65, 0.35);    // Mid gold
    vec3 goldDark = vec3(0.55, 0.40, 0.20);   // Dark gold/bronze
    
    // Create banded gradient for 3D metallic look
    vec3 color;
    if (gradient < 0.3) {
      color = mix(goldDark, goldMid, gradient / 0.3);
    } else if (gradient < 0.6) {
      color = mix(goldMid, goldLight, (gradient - 0.3) / 0.3);
    } else {
      color = mix(goldLight, goldMid, (gradient - 0.6) / 0.4);
    }
    
    // Subtle shimmer
    float shimmer = sin((uv.x * 8.0 + uv.y * 8.0) - uTime * 1.5) * 0.5 + 0.5;
    shimmer = pow(shimmer, 4.0) * 0.15;
    color += vec3(shimmer);
    
    // Edge highlight
    float edgeHighlight = smoothstep(0.0, 0.15, uv.x) * smoothstep(1.0, 0.85, uv.x);
    edgeHighlight *= smoothstep(0.0, 0.15, uv.y) * smoothstep(1.0, 0.85, uv.y);
    color = mix(color * 0.7, color, edgeHighlight);
    
    gl_FragColor = vec4(color, 1.0);
  }
`;

// Blue gradient shader for card interior
const blueInteriorFragmentShader = `
  uniform float uTime;
  
  varying vec2 vUv;
  
  void main() {
    vec2 uv = vUv;
    
    // Vertical gradient - lighter at top, darker at bottom
    vec3 colorTop = vec3(0.30, 0.50, 0.70);     // Light blue
    vec3 colorBottom = vec3(0.12, 0.25, 0.42);  // Dark blue
    
    float gradientY = uv.y * 0.7 + 0.15;
    vec3 color = mix(colorBottom, colorTop, gradientY);
    
    // Subtle diagonal pattern/texture
    float pattern = sin(uv.x * 40.0 + uv.y * 40.0) * 0.5 + 0.5;
    pattern = pattern * 0.03;
    color += vec3(pattern);
    
    // Center glow
    float centerGlow = 1.0 - length((uv - vec2(0.5, 0.45)) * vec2(1.2, 1.0));
    centerGlow = max(0.0, centerGlow);
    centerGlow = pow(centerGlow, 2.0) * 0.15;
    color += vec3(centerGlow * 0.5, centerGlow * 0.7, centerGlow);
    
    gl_FragColor = vec4(color, 1.0);
  }
`;

// Cyan glow line shader
const glowLineFragmentShader = `
  uniform float uTime;
  
  varying vec2 vUv;
  
  void main() {
    vec2 uv = vUv;
    
    // Distance from edge (for line effect)
    float distFromEdge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
    
    // Create thin line near edge
    float line = smoothstep(0.0, 0.02, distFromEdge) * smoothstep(0.06, 0.02, distFromEdge);
    
    // Animated pulse
    float pulse = sin(uTime * 2.0) * 0.3 + 0.7;
    
    // Cyan glow color
    vec3 glowColor = vec3(0.2, 0.7, 1.0);
    
    float alpha = line * pulse * 0.8;
    
    gl_FragColor = vec4(glowColor, alpha);
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
  const goldMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  const blueMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  const glowMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  const [hovered, setHovered] = useState(false);
  
  const animState = useRef({
    rotationY: 0,
    scale: 0,
    positionZ: 0,
    hoverScale: 1
  });
  
  // Create shield shape - outer border
  const shieldShape = useMemo(() => {
    const shape = new THREE.Shape();
    const width = 1.4;
    const height = 1.75;
    
    // More pronounced shield shape
    shape.moveTo(-width/2 + 0.12, height/2);
    shape.lineTo(width/2 - 0.12, height/2);
    shape.quadraticCurveTo(width/2, height/2, width/2, height/2 - 0.12);
    shape.lineTo(width/2, -height/4);
    shape.quadraticCurveTo(width/2, -height/2 + 0.15, 0, -height/2 - 0.25);
    shape.quadraticCurveTo(-width/2, -height/2 + 0.15, -width/2, -height/4);
    shape.lineTo(-width/2, height/2 - 0.12);
    shape.quadraticCurveTo(-width/2, height/2, -width/2 + 0.12, height/2);
    
    return shape;
  }, []);
  
  // Inner shield shape for blue area
  const innerShieldShape = useMemo(() => {
    const shape = new THREE.Shape();
    const width = 1.22;
    const height = 1.55;
    
    shape.moveTo(-width/2 + 0.10, height/2);
    shape.lineTo(width/2 - 0.10, height/2);
    shape.quadraticCurveTo(width/2, height/2, width/2, height/2 - 0.10);
    shape.lineTo(width/2, -height/4);
    shape.quadraticCurveTo(width/2, -height/2 + 0.12, 0, -height/2 - 0.20);
    shape.quadraticCurveTo(-width/2, -height/2 + 0.12, -width/2, -height/4);
    shape.lineTo(-width/2, height/2 - 0.10);
    shape.quadraticCurveTo(-width/2, height/2, -width/2 + 0.10, height/2);
    
    return shape;
  }, []);
  
  // Glow line shield shape (slightly smaller)
  const glowLineShape = useMemo(() => {
    const shape = new THREE.Shape();
    const width = 1.16;
    const height = 1.48;
    
    shape.moveTo(-width/2 + 0.09, height/2);
    shape.lineTo(width/2 - 0.09, height/2);
    shape.quadraticCurveTo(width/2, height/2, width/2, height/2 - 0.09);
    shape.lineTo(width/2, -height/4);
    shape.quadraticCurveTo(width/2, -height/2 + 0.11, 0, -height/2 - 0.18);
    shape.quadraticCurveTo(-width/2, -height/2 + 0.11, -width/2, -height/4);
    shape.lineTo(-width/2, height/2 - 0.09);
    shape.quadraticCurveTo(-width/2, height/2, -width/2 + 0.09, height/2);
    
    return shape;
  }, []);
  
  // Gold border material
  const goldMaterial = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: goldBorderVertexShader,
      fragmentShader: goldBorderFragmentShader,
      uniforms: {
        uTime: { value: 0 }
      }
    });
    goldMaterialRef.current = mat;
    return mat;
  }, []);
  
  // Blue interior material
  const blueMaterial = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: goldBorderVertexShader,
      fragmentShader: blueInteriorFragmentShader,
      uniforms: {
        uTime: { value: 0 }
      }
    });
    blueMaterialRef.current = mat;
    return mat;
  }, []);
  
  // Cyan glow line material
  const glowMaterial = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: goldBorderVertexShader,
      fragmentShader: glowLineFragmentShader,
      uniforms: {
        uTime: { value: 0 }
      },
      transparent: true,
      blending: THREE.AdditiveBlending
    });
    glowMaterialRef.current = mat;
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
    
    const time = state.clock.elapsedTime;
    if (goldMaterialRef.current) {
      goldMaterialRef.current.uniforms.uTime.value = time;
    }
    if (blueMaterialRef.current) {
      blueMaterialRef.current.uniforms.uTime.value = time;
    }
    if (glowMaterialRef.current) {
      glowMaterialRef.current.uniforms.uTime.value = time;
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
        {/* Gold gradient border */}
        <mesh position={[0, 0, -0.02]}>
          <shapeGeometry args={[shieldShape]} />
          <primitive object={goldMaterial} attach="material" />
        </mesh>
        
        {/* Blue gradient interior */}
        <mesh position={[0, 0, -0.01]}>
          <shapeGeometry args={[innerShieldShape]} />
          <primitive object={blueMaterial} attach="material" />
        </mesh>
        
        {/* Cyan glow line */}
        <mesh position={[0, 0, 0.001]}>
          <shapeGeometry args={[glowLineShape]} />
          <primitive object={glowMaterial} attach="material" />
        </mesh>
        
        {/* Small Victory Vault logo placeholder at top */}
        <Text
          position={[0, 0.55, 0.02]}
          fontSize={0.12}
          color="#8899aa"
          anchorX="center"
          anchorY="middle"
          font="/fonts/BebasNeue-Regular.ttf"
        >
          VICTORY VAULT
        </Text>
        
        {/* Main question mark - large gold with shadow */}
        <Text
          position={[0.02, -0.08, 0.015]}
          fontSize={1.0}
          color="#554422"
          anchorX="center"
          anchorY="middle"
          font="/fonts/BebasNeue-Regular.ttf"
          fillOpacity={0.4}
        >
          {frontContent}
        </Text>
        <Text
          position={[0, -0.05, 0.02]}
          fontSize={1.0}
          color="#d4a84b"
          anchorX="center"
          anchorY="middle"
          font="/fonts/BebasNeue-Regular.ttf"
        >
          {frontContent}
        </Text>
        
        {/* FINAL FLIP text at bottom */}
        <Text
          position={[0, -0.72, 0.02]}
          fontSize={0.11}
          color="#8899aa"
          anchorX="center"
          anchorY="middle"
          font="/fonts/BebasNeue-Regular.ttf"
          letterSpacing={0.1}
        >
          FINAL FLIP
        </Text>
      </group>
      
      {/* Back face */}
      <group rotation={[0, Math.PI, 0]}>
        {/* Gold gradient border */}
        <mesh position={[0, 0, -0.02]}>
          <shapeGeometry args={[shieldShape]} />
          <meshBasicMaterial color={isWinner ? '#ffd700' : (showSadEmoji ? '#555' : '#c9a648')} />
        </mesh>
        
        {/* Blue interior */}
        <mesh position={[0, 0, -0.01]}>
          <shapeGeometry args={[innerShieldShape]} />
          <meshBasicMaterial color={showSadEmoji ? '#1a1a2a' : '#1a3a5c'} side={THREE.FrontSide} />
        </mesh>
        
        {/* Victory Vault text on back */}
        <Text
          position={[0, 0.55, 0.02]}
          fontSize={0.12}
          color="#8899aa"
          anchorX="center"
          anchorY="middle"
          font="/fonts/BebasNeue-Regular.ttf"
        >
          VICTORY VAULT
        </Text>
        
        {/* Back content */}
        <Text
          position={[0, -0.05, 0.02]}
          fontSize={showSadEmoji ? 0.75 : 1.0}
          color={isWinner ? '#ffd700' : (showSadEmoji ? '#666' : '#d4a84b')}
          anchorX="center"
          anchorY="middle"
          font={showSadEmoji ? undefined : "/fonts/BebasNeue-Regular.ttf"}
        >
          {backDisplay}
        </Text>
        
        {/* FINAL FLIP text at bottom */}
        <Text
          position={[0, -0.72, 0.02]}
          fontSize={0.11}
          color="#8899aa"
          anchorX="center"
          anchorY="middle"
          font="/fonts/BebasNeue-Regular.ttf"
          letterSpacing={0.1}
        >
          FINAL FLIP
        </Text>
      </group>
      
      {/* Glow effects for winner */}
      {isWinner && (
        <>
          <pointLight position={[0, 0, 0.5]} intensity={1.5} color="#ffd700" distance={3} />
        </>
      )}
    </group>
  );
};

export default ShieldCard;
