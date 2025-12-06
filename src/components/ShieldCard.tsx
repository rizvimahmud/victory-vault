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
  uniform float uLightFromLeft;
  
  varying vec2 vUv;
  varying vec3 vPosition;
  
  void main() {
    vec2 uv = vUv;
    
    // For left card (light from left): bright on left (low uv.x)
    // For right card (light from right): bright on right (high uv.x)
    // We want gradient to go from bright (light side) to dark (shadow side)
    float lightX = uLightFromLeft > 0.5 ? uv.x : (1.0 - uv.x);
    
    // Gold gradient - lightX 0 = light side, lightX 1 = shadow side
    float gradient = (lightX * 0.7 + (1.0 - uv.y) * 0.3);
    
    // Base gold colors
    vec3 goldLight = vec3(0.95, 0.85, 0.55);  // Light gold (bright side)
    vec3 goldMid = vec3(0.80, 0.65, 0.35);    // Mid gold
    vec3 goldDark = vec3(0.50, 0.35, 0.18);   // Dark gold/bronze (shadow side)
    
    // Create smooth gradient for 3D metallic look - bright to dark
    vec3 color;
    if (gradient < 0.35) {
      color = mix(goldLight, goldMid, gradient / 0.35);
    } else if (gradient < 0.7) {
      color = mix(goldMid, goldDark, (gradient - 0.35) / 0.35);
    } else {
      color = goldDark;
    }
    
    // Subtle shimmer
    float shimmer = sin((uv.x * 8.0 + uv.y * 8.0) - uTime * 1.5) * 0.5 + 0.5;
    shimmer = pow(shimmer, 4.0) * 0.12;
    color += vec3(shimmer);
    
    // Add highlight on the light side edge
    float edgeGlow = uLightFromLeft > 0.5 
      ? smoothstep(0.3, 0.0, uv.x) 
      : smoothstep(0.7, 1.0, uv.x);
    color += goldLight * edgeGlow * 0.15;
    
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
  const [showRectShape, setShowRectShape] = useState(false);
  
  const animState = useRef({
    rotationY: 0,
    scale: 0,
    positionZ: 0,
    positionX: 0,
    hoverScale: 1,
    shapeBlend: 0 // 0 = shield, 1 = rectangle
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
  
  // Rectangular card shape - outer border (for revealed state)
  const rectShape = useMemo(() => {
    const shape = new THREE.Shape();
    const width = 1.5;
    const height = 2.0;
    const radius = 0.08;
    
    shape.moveTo(-width/2 + radius, height/2);
    shape.lineTo(width/2 - radius, height/2);
    shape.quadraticCurveTo(width/2, height/2, width/2, height/2 - radius);
    shape.lineTo(width/2, -height/2 + radius);
    shape.quadraticCurveTo(width/2, -height/2, width/2 - radius, -height/2);
    shape.lineTo(-width/2 + radius, -height/2);
    shape.quadraticCurveTo(-width/2, -height/2, -width/2, -height/2 + radius);
    shape.lineTo(-width/2, height/2 - radius);
    shape.quadraticCurveTo(-width/2, height/2, -width/2 + radius, height/2);
    
    return shape;
  }, []);
  
  // Inner rectangular shape for blue area
  const innerRectShape = useMemo(() => {
    const shape = new THREE.Shape();
    const width = 1.32;
    const height = 1.82;
    const radius = 0.06;
    
    shape.moveTo(-width/2 + radius, height/2);
    shape.lineTo(width/2 - radius, height/2);
    shape.quadraticCurveTo(width/2, height/2, width/2, height/2 - radius);
    shape.lineTo(width/2, -height/2 + radius);
    shape.quadraticCurveTo(width/2, -height/2, width/2 - radius, -height/2);
    shape.lineTo(-width/2 + radius, -height/2);
    shape.quadraticCurveTo(-width/2, -height/2, -width/2, -height/2 + radius);
    shape.lineTo(-width/2, height/2 - radius);
    shape.quadraticCurveTo(-width/2, height/2, -width/2 + radius, height/2);
    
    return shape;
  }, []);
  
  // Gold inner frame line for rectangle
  const goldFrameShape = useMemo(() => {
    const shape = new THREE.Shape();
    const width = 1.20;
    const height = 1.70;
    const radius = 0.05;
    
    shape.moveTo(-width/2 + radius, height/2);
    shape.lineTo(width/2 - radius, height/2);
    shape.quadraticCurveTo(width/2, height/2, width/2, height/2 - radius);
    shape.lineTo(width/2, -height/2 + radius);
    shape.quadraticCurveTo(width/2, -height/2, width/2 - radius, -height/2);
    shape.lineTo(-width/2 + radius, -height/2);
    shape.quadraticCurveTo(-width/2, -height/2, -width/2, -height/2 + radius);
    shape.lineTo(-width/2, height/2 - radius);
    shape.quadraticCurveTo(-width/2, height/2, -width/2 + radius, height/2);
    
    return shape;
  }, []);
  
  // Determine if light comes from left based on card position
  const lightFromLeft = position[0] < 0;
  
  // Gold border material
  const goldMaterial = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: goldBorderVertexShader,
      fragmentShader: goldBorderFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uLightFromLeft: { value: lightFromLeft ? 1.0 : 0.0 }
      }
    });
    goldMaterialRef.current = mat;
    return mat;
  }, [lightFromLeft]);
  
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
      // Calculate how much to move toward center (negative of original x position)
      const moveToCenter = -position[0] * 0.7; // Move 70% toward center
      
      // Zoom towards camera, move to center, flip, and change shape
      const tl = gsap.timeline();
      
      // Phase 1: Zoom forward and start moving to center
      tl.to(animState.current, {
        positionZ: 2.5,
        positionX: moveToCenter,
        scale: 1.4,
        duration: 0.5,
        ease: 'power2.out'
      })
      // Phase 2: Flip the card
      .to(animState.current, {
        rotationY: Math.PI,
        duration: 0.6,
        ease: 'power2.inOut',
        onStart: () => {
          // Switch to rectangular shape at midpoint of flip
          setTimeout(() => setShowRectShape(true), 300);
        }
      })
      // Phase 3: Settle back slightly but stay forward and centered
      .to(animState.current, {
        positionZ: 1.5,
        scale: 1.25,
        duration: 0.4,
        ease: 'power2.out'
      });
      
      return () => { tl.kill(); };
    }
  }, [isSelected, position]);
  
  // Handle flip for non-selected card (when other card is selected)
  useEffect(() => {
    if (isFlipped && !isSelected) {
      // Flip the non-selected card (staying in place, maybe moving back slightly)
      const tl = gsap.timeline({ delay: 0.8 }); // Delay to start after selected card animation
      
      tl.to(animState.current, {
        positionZ: -0.5, // Move back slightly
        scale: 0.9, // Slightly smaller
        duration: 0.3,
        ease: 'power2.out'
      })
      .to(animState.current, {
        rotationY: Math.PI,
        duration: 0.5,
        ease: 'power2.inOut',
        onStart: () => {
          setTimeout(() => setShowRectShape(true), 250);
        }
      });
      
      return () => { tl.kill(); };
    }
  }, [isFlipped, isSelected]);
  
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
      groupRef.current.position.x = position[0] + animState.current.positionX;
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
  
  return (
    <group 
      ref={groupRef} 
      position={position}
      onClick={handleClick}
      onPointerOver={() => !disabled && setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {/* Front face - Shield shape */}
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
        
        {/* Horizontal cyan glow line across the card */}
        <mesh position={[0, 0.05, 0.005]}>
          <planeGeometry args={[1.1, 0.02]} />
          <meshBasicMaterial color="#4dd0e1" transparent opacity={0.9} />
        </mesh>
        {/* Glow effect for the line */}
        <mesh position={[0, 0.05, 0.004]}>
          <planeGeometry args={[1.15, 0.06]} />
          <meshBasicMaterial color="#4dd0e1" transparent opacity={0.3} />
        </mesh>
        
        {/* Vertical cyan line - position based on card side */}
        <mesh position={[position[0] < 0 ? -0.48 : 0.48, 0.35, 0.005]}>
          <planeGeometry args={[0.015, 0.5]} />
          <meshBasicMaterial color="#4dd0e1" transparent opacity={0.8} />
        </mesh>
        
        {/* Small Victory Vault text at top - inside the blue area */}
        <Text
          position={[0, 0.58, 0.02]}
          fontSize={0.09}
          color="#aabbcc"
          anchorX="center"
          anchorY="middle"
          font="/fonts/BebasNeue-Regular.ttf"
          letterSpacing={0.05}
        >
          VICTORY VAULT
        </Text>
        
        {/* Main question mark - large gold with shadow */}
        <Text
          position={[0.015, -0.18, 0.015]}
          fontSize={0.95}
          color="#3a3520"
          anchorX="center"
          anchorY="middle"
          font="/fonts/BebasNeue-Regular.ttf"
          fillOpacity={0.5}
        >
          {frontContent}
        </Text>
        <Text
          position={[0, -0.15, 0.02]}
          fontSize={0.95}
          color="#d4a84b"
          anchorX="center"
          anchorY="middle"
          font="/fonts/BebasNeue-Regular.ttf"
        >
          {frontContent}
        </Text>
        
        {/* FINAL FLIP text at bottom - inside the blue area */}
        <Text
          position={[0, -0.62, 0.02]}
          fontSize={0.09}
          color="#aabbcc"
          anchorX="center"
          anchorY="middle"
          font="/fonts/BebasNeue-Regular.ttf"
          letterSpacing={0.08}
        >
          FINAL FLIP
        </Text>
      </group>
      
      {/* Back face - Rectangular shape when revealed */}
      <group rotation={[0, Math.PI, 0]}>
        {/* Outer cyan glow border */}
        <mesh position={[0, 0, -0.03]}>
          <shapeGeometry args={[showRectShape ? rectShape : shieldShape]} />
          <meshBasicMaterial color="#4aa8d8" transparent opacity={0.8} />
        </mesh>
        
        {/* Gold border - slightly larger for revealed rect */}
        <mesh position={[0, 0, -0.02]}>
          <shapeGeometry args={[showRectShape ? rectShape : shieldShape]} />
          <meshBasicMaterial color={isWinner ? '#d4a84b' : (showSadEmoji ? '#5577aa' : '#d4a84b')} />
        </mesh>
        
        {/* Blue interior */}
        <mesh position={[0, 0, -0.01]}>
          <shapeGeometry args={[showRectShape ? innerRectShape : innerShieldShape]} />
          <primitive object={blueMaterial} attach="material" />
        </mesh>
        
        {/* Gold inner frame line for revealed cards */}
        {showRectShape && (
          <mesh position={[0, 0, 0.001]}>
            <shapeGeometry args={[goldFrameShape]} />
            <meshBasicMaterial color="#b89840" transparent opacity={0.5} wireframe />
          </mesh>
        )}
        
        {/* Back content - Number or Sad Face */}
        {showSadEmoji ? (
          /* Sad face graphic instead of emoji */
          <group position={[0, 0.05, 0.02]}>
            {/* Left eye */}
            <mesh position={[-0.22, 0.15, 0]}>
              <planeGeometry args={[0.15, 0.12]} />
              <meshBasicMaterial color="#b89840" />
            </mesh>
            {/* Right eye */}
            <mesh position={[0.22, 0.15, 0]}>
              <planeGeometry args={[0.15, 0.12]} />
              <meshBasicMaterial color="#b89840" />
            </mesh>
            {/* Sad mouth - curved line made with thin box */}
            <group position={[0, -0.25, 0]}>
              {/* Create curved sad mouth with multiple segments */}
              <mesh position={[-0.3, 0.08, 0]} rotation={[0, 0, -0.3]}>
                <planeGeometry args={[0.18, 0.04]} />
                <meshBasicMaterial color="#b89840" />
              </mesh>
              <mesh position={[0, 0, 0]}>
                <planeGeometry args={[0.25, 0.04]} />
                <meshBasicMaterial color="#b89840" />
              </mesh>
              <mesh position={[0.3, 0.08, 0]} rotation={[0, 0, 0.3]}>
                <planeGeometry args={[0.18, 0.04]} />
                <meshBasicMaterial color="#b89840" />
              </mesh>
            </group>
          </group>
        ) : (
          /* Number display */
          <Text
            position={[0, 0.05, 0.02]}
            fontSize={1.1}
            color="#d4a84b"
            anchorX="center"
            anchorY="middle"
            font="/fonts/BebasNeue-Regular.ttf"
          >
            {backContent}
          </Text>
        )}
      </group>
      
      {/* Shadow plane behind selected card */}
      {isSelected && (
        <mesh position={[-0.15, -0.1, -0.2]} rotation={[0, 0, 0]}>
          <shapeGeometry args={[showRectShape ? rectShape : shieldShape]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.3} />
        </mesh>
      )}
      
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
