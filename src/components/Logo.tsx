import React, { useRef, useEffect } from 'react';
import { useLoader } from '@react-three/fiber';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import * as THREE from 'three';
import gsap from 'gsap';

interface LogoProps {
  position?: [number, number, number];
  scale?: number;
  delay?: number;
}

// Using HTML overlay for SVG logo since Three.js SVG rendering is complex
const Logo: React.FC<LogoProps> = ({
  position = [0, 2, 0],
  scale = 1,
  delay = 0
}) => {
  // This is a placeholder - we'll use HTML overlay for the actual SVG
  return null;
};

// HTML-based logo component to be used outside Canvas
export const LogoOverlay: React.FC<{
  visible: boolean;
  delay?: number;
  top?: string;
  scale?: number;
}> = ({ visible, delay = 0, top = '15%', scale = 1 }) => {
  const logoRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!logoRef.current) return;
    
    if (visible) {
      gsap.fromTo(logoRef.current,
        { opacity: 0, scale: 0.5 },
        { 
          opacity: 1, 
          scale: scale, 
          duration: 0.8, 
          delay,
          ease: 'back.out(1.5)'
        }
      );
    } else {
      gsap.to(logoRef.current, {
        opacity: 0,
        duration: 0.3
      });
    }
  }, [visible, delay, scale]);
  
  return (
    <div
      ref={logoRef}
      style={{
        position: 'absolute',
        top,
        left: '50%',
        transform: 'translateX(-50%)',
        opacity: 0,
        pointerEvents: 'none',
        zIndex: 10
      }}
    >
      <img 
        src="/VV_Logo.svg" 
        alt="Victory Vault"
        style={{
          width: `${180 * scale}px`,
          height: 'auto'
        }}
      />
    </div>
  );
};

export default Logo;
