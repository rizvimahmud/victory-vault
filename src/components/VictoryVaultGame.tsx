import React, { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text, Line } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import Smoke from './Smoke';
import SpotlightBeam from './SpotlightBeam';
import ShieldCard from './ShieldCard';
import Sparkle from './Sparkle';
import Fireworks from './Fireworks';
import { LogoOverlay } from './Logo';

type GamePhase = 
  | 'intro'
  | 'cardSelection'
  | 'cardReveal'
  | 'result'
  | 'celebration'
  | 'reset';

interface GameState {
  phase: GamePhase;
  selectedCard: number | null;
  winningCard: number;
  prizeAmount: number;
  isWinner: boolean;
}

// Gradient background plane
const GradientBackground: React.FC = () => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  
  const material = React.useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uColorTop: { value: new THREE.Color('#0a1628') },
        uColorMiddle: { value: new THREE.Color('#0d2240') },
        uColorBottom: { value: new THREE.Color('#061018') }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColorTop;
        uniform vec3 uColorMiddle;
        uniform vec3 uColorBottom;
        varying vec2 vUv;
        
        void main() {
          vec3 color;
          if (vUv.y > 0.5) {
            color = mix(uColorMiddle, uColorTop, (vUv.y - 0.5) * 2.0);
          } else {
            color = mix(uColorBottom, uColorMiddle, vUv.y * 2.0);
          }
          
          // Add subtle vignette
          float vignette = 1.0 - length((vUv - 0.5) * 1.2);
          vignette = smoothstep(0.0, 0.7, vignette);
          color *= 0.7 + vignette * 0.3;
          
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      depthWrite: false
    });
  }, []);
  
  return (
    <mesh position={[0, 0, -10]}>
      <planeGeometry args={[30, 20]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
};

// Animated Text
const FadeInText: React.FC<{
  children: string;
  position: [number, number, number];
  fontSize: number;
  color: string;
  delay?: number;
  letterSpacing?: number;
  visible?: boolean;
}> = ({ children, position, fontSize, color, delay = 0, letterSpacing = 0.1, visible = true }) => {
  const [opacity, setOpacity] = useState(0);
  const [currentY, setCurrentY] = useState(position[1]);
  const opacityRef = useRef({ value: 0 });
  const yRef = useRef({ value: position[1] });
  const initializedRef = useRef(false);
  
  // Initialize position on mount
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      yRef.current.value = position[1] - 0.3;
      setCurrentY(position[1] - 0.3);
    }
  }, []);
  
  useEffect(() => {
    if (!visible) {
      gsap.to(opacityRef.current, {
        value: 0,
        duration: 0.3,
        onUpdate: () => setOpacity(opacityRef.current.value)
      });
      return;
    }
    
    // Animate in
    const tl = gsap.timeline({ delay });
    
    tl.to(opacityRef.current, {
      value: 1,
      duration: 0.5,
      ease: 'power2.out',
      onUpdate: () => setOpacity(opacityRef.current.value)
    })
    .to(yRef.current, {
      value: position[1],
      duration: 0.5,
      ease: 'power2.out',
      onUpdate: () => setCurrentY(yRef.current.value)
    }, 0);
    
    return () => { tl.kill(); };
  }, []); 
  
  if (!visible && opacity === 0) return null;
  
  return (
    <Text
      position={[position[0], currentY, position[2]]}
      fontSize={fontSize}
      color={color}
      anchorX="center"
      anchorY="middle"
      letterSpacing={letterSpacing}
      fillOpacity={opacity}
      font="/fonts/BebasNeue-Regular.ttf"
    >
      {children}
    </Text>
  );
};

// 3D Glossy Amount Text
const GlossyAmount: React.FC<{
  amount: number;
  position: [number, number, number];
  visible: boolean;
  animate?: boolean;
}> = ({ amount, position, visible, animate = false }) => {
  const [displayAmount, setDisplayAmount] = useState(animate ? amount / 2 : amount);
  const groupRef = useRef<THREE.Group>(null);
  const scaleRef = useRef({ value: 0 });
  
  useEffect(() => {
    if (!visible) {
      scaleRef.current.value = 0;
      return;
    }
    
    setDisplayAmount(animate ? amount / 2 : amount);
    
    // Slower, smoother scale-in animation
    gsap.to(scaleRef.current, {
      value: 1,
      duration: 1.2,
      ease: 'elastic.out(1, 0.5)'
    });
    
    if (animate) {
      // Slower number counting animation
      gsap.to({ val: amount / 2 }, {
        val: amount,
        duration: 2.5,
        delay: 1.0,
        ease: 'power1.inOut',
        onUpdate: function() {
          setDisplayAmount(Math.round(this.targets()[0].val));
        }
      });
    }
  }, [amount, animate, visible]);
  
  useFrame(() => {
    if (groupRef.current) {
      const s = scaleRef.current.value;
      groupRef.current.scale.set(s, s, s);
    }
  });
  
  if (!visible) return null;
  
  return (
    <group ref={groupRef} position={position}>
      {/* Shadow/depth layer */}
      <Text
        position={[0.03, -0.03, -0.05]}
        fontSize={2}
        color="#000000"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.02}
        font="/fonts/BebasNeue-Regular.ttf"
        fillOpacity={0.4}
      >
        {`$${displayAmount.toLocaleString()}`}
      </Text>
      {/* Main gold text */}
      <Text
        fontSize={2}
        color="#d4a84b"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.02}
        font="/fonts/BebasNeue-Regular.ttf"
      >
        {`$${displayAmount.toLocaleString()}`}
      </Text>
      {/* Highlight layer */}
      <Text
        position={[-0.02, 0.02, 0.02]}
        fontSize={2}
        color="#f5d78e"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.02}
        font="/fonts/BebasNeue-Regular.ttf"
        fillOpacity={0.3}
      >
        {`$${displayAmount.toLocaleString()}`}
      </Text>
    </group>
  );
};

// 2X Multiplier Badge
const MultiplierBadge: React.FC<{ position: [number, number, number]; visible: boolean }> = ({ position, visible }) => {
  const groupRef = useRef<THREE.Group>(null);
  const scaleRef = useRef({ value: 0 });
  
  const shieldShape = React.useMemo(() => {
    const shape = new THREE.Shape();
    const width = 1.0;
    const height = 1.2;
    
    shape.moveTo(-width/2, height/2 - 0.08);
    shape.lineTo(-width/2 + 0.05, height/2);
    shape.lineTo(width/2 - 0.05, height/2);
    shape.lineTo(width/2, height/2 - 0.08);
    shape.lineTo(width/2, -height/4);
    shape.quadraticCurveTo(width/2, -height/2, 0, -height/2 - 0.1);
    shape.quadraticCurveTo(-width/2, -height/2, -width/2, -height/4);
    shape.closePath();
    
    return shape;
  }, []);
  
  useEffect(() => {
    if (visible) {
      gsap.to(scaleRef.current, {
        value: 1,
        duration: 0.6,
        ease: 'back.out(2)'
      });
    } else {
      scaleRef.current.value = 0;
    }
  }, [visible]);
  
  useFrame(() => {
    if (groupRef.current) {
      const s = scaleRef.current.value;
      groupRef.current.scale.set(s, s, s);
    }
  });
  
  if (!visible) return null;
  
  return (
    <group ref={groupRef} position={position}>
      <mesh position={[0, 0, -0.01]}>
        <shapeGeometry args={[shieldShape]} />
        <meshBasicMaterial color="#c9a648" />
      </mesh>
      <mesh scale={[0.88, 0.88, 1]}>
        <shapeGeometry args={[shieldShape]} />
        <meshBasicMaterial color="#1a3a5c" />
      </mesh>
      <Text
        position={[0, 0, 0.02]}
        fontSize={0.5}
        color="#c9a648"
        anchorX="center"
        anchorY="middle"
        font="/fonts/BebasNeue-Regular.ttf"
      >
        2X
      </Text>
    </group>
  );
};

// Sparkle burst
const SparkleBurst: React.FC<{
  position: [number, number, number];
  active: boolean;
  count?: number;
}> = ({ position, active, count = 36 }) => {
  const groupRef = useRef<THREE.Group>(null);
  const progressRef = useRef({ value: 0 });
  const [isActive, setIsActive] = useState(false);
  
  useEffect(() => {
    if (active && !isActive) {
      setIsActive(true);
      progressRef.current.value = 0;
      gsap.to(progressRef.current, {
        value: 1,
        duration: 1.5,
        ease: 'power2.out'
      });
    }
  }, [active, isActive]);
  
  useFrame(() => {
    if (!groupRef.current || !isActive) return;
    
    const progress = progressRef.current.value;
    const opacity = Math.max(0, 1 - progress * 1.3);
    
    groupRef.current.children.forEach((child, i) => {
      const angle = (i / count) * Math.PI * 2;
      const distance = progress * 6;
      
      child.position.x = Math.cos(angle) * distance;
      child.position.y = Math.sin(angle) * distance;
      
      if (child instanceof THREE.Line) {
        (child.material as THREE.LineBasicMaterial).opacity = opacity;
      }
    });
  });
  
  if (!isActive) return null;
  
  return (
    <group ref={groupRef} position={position}>
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * Math.PI * 2;
        const length = 0.12 + (i % 4) * 0.06;
        const points: [number, number, number][] = [
          [0, 0, 0],
          [Math.cos(angle) * length, Math.sin(angle) * length, 0]
        ];
        return (
          <Line
            key={i}
            points={points}
            color={i % 3 === 0 ? "#ffffff" : i % 3 === 1 ? "#ffd700" : "#ffaa00"}
            lineWidth={1.5}
            transparent
            opacity={1}
          />
        );
      })}
    </group>
  );
};

// Play Win Text
const PlayWinText: React.FC<{ visible: boolean; delay?: number }> = ({ visible, delay = 0 }) => {
  const [show, setShow] = useState(false);
  
  useEffect(() => {
    if (visible) {
      const timeout = setTimeout(() => setShow(true), delay * 1000);
      return () => clearTimeout(timeout);
    } else {
      setShow(false);
    }
  }, [visible, delay]);
  
  if (!show) return null;
  
  return (
    <group position={[0, -1.3, 0]}>
      <FadeInText position={[-1.7, 0, 0]} fontSize={1.15} color="#c9a648" delay={0}>
        PLAY
      </FadeInText>
      <Sparkle position={[0, 0, 0.1]} color="#3da9fc" size={0.22} delay={0.2} duration={2} />
      <FadeInText position={[1.7, 0, 0]} fontSize={1.15} color="#3da9fc" delay={0.1}>
        WIN
      </FadeInText>
    </group>
  );
};

// Main Game Scene
const GameScene: React.FC<{
  gameState: GameState;
  onCardSelect: (cardIndex: number) => void;
}> = ({ gameState, onCardSelect }) => {
  const { phase, selectedCard, winningCard, prizeAmount, isWinner } = gameState;
  
  const showIntro = phase === 'intro';
  const showCards = phase === 'cardSelection' || phase === 'cardReveal' || phase === 'result';
  const showCelebration = phase === 'celebration';
  
  // Card positions
  const leftCardPos: [number, number, number] = [-1.9, -0.3, 0];
  const rightCardPos: [number, number, number] = [1.9, -0.3, 0];
  
  return (
    <>
      {/* Gradient background */}
      <GradientBackground />
      
      {/* Smoke at bottom */}
      <Smoke position={[0, -5, -2]} scale={[22, 6, 1]} opacity={0.5} />
      
      {/* Spotlights - always visible, aligned with card positions */}
      <SpotlightBeam
        position={[-8, 9, -5]}
        targetPosition={[-1.9, -4, -5]}
        intensity={0.5}
        spread={0.6}
        angle={Math.PI / 5}
        penumbra={0.6}
        animationDelay={showIntro ? 0.3 : 0}
        visible={true}
      />
      <SpotlightBeam
        position={[8, 9, -5]}
        targetPosition={[1.9, -4, -5]}
        intensity={0.5}
        spread={0.6}
        angle={Math.PI / 5}
        penumbra={0.6}
        animationDelay={showIntro ? 0.5 : 0}
        visible={true}
      />
      
      {/* Center spotlight for celebration - fades in smoothly */}
      <SpotlightBeam
        position={[0, 10, -5]}
        targetPosition={[0, -4, -5]}
        intensity={showCelebration ? 0.4 : 0}
        spread={0.55}
        angle={Math.PI / 5}
        penumbra={0.7}
        animationDelay={0}
        visible={showCelebration}
      />
      
      {/* INTRO PHASE */}
      {showIntro && (
        <>
          <FadeInText
            position={[0, 0.5, 0]}
            fontSize={0.55}
            color="#d4d8dc"
            delay={1.5}
            letterSpacing={0.2}
          >
            FINAL FLIP
          </FadeInText>
          <Sparkle position={[0, -0.5, 0.1]} color="#3da9fc" size={0.28} delay={2.2} duration={1.5} />
          <PlayWinText visible={true} delay={3} />
        </>
      )}
      
      {/* CARD SELECTION / REVEAL PHASE */}
      {showCards && (
        <>
          <FadeInText
            position={[0, 2, 1]}
            fontSize={0.38}
            color="#d4d8dc"
            delay={0.2}
            letterSpacing={0.15}
          >
            FINAL FLIP
          </FadeInText>
          
          {phase === 'cardSelection' && (
            <FadeInText
              position={[0, -3, 0]}
              fontSize={0.3}
              color="#8ba4c4"
              delay={0.8}
              letterSpacing={0.08}
            >
              SELECT A CARD TO REVEAL YOUR PRIZE
            </FadeInText>
          )}
          
          {/* Cards */}
          <ShieldCard
            position={leftCardPos}
            frontContent="?"
            backContent="1"
            scale={1.5}
            entranceDelay={0.4}
            isFlipped={selectedCard !== null}
            isSelected={selectedCard === 0}
            isWinner={selectedCard === 0 && isWinner}
            showSadEmoji={selectedCard === 0 && !isWinner && phase === 'result'}
            onClick={() => phase === 'cardSelection' && onCardSelect(0)}
            disabled={phase !== 'cardSelection'}
          />
          <ShieldCard
            position={rightCardPos}
            frontContent="?"
            backContent="2"
            scale={1.5}
            entranceDelay={0.6}
            isFlipped={selectedCard !== null}
            isSelected={selectedCard === 1}
            isWinner={selectedCard === 1 && isWinner}
            showSadEmoji={selectedCard === 1 && !isWinner && phase === 'result'}
            onClick={() => phase === 'cardSelection' && onCardSelect(1)}
            disabled={phase !== 'cardSelection'}
          />
        </>
      )}
      
      {/* CELEBRATION PHASE */}
      {showCelebration && (
        <>
          <MultiplierBadge position={[0, 2.8, 0]} visible={true} />
          
          <GlossyAmount
            amount={prizeAmount}
            position={[0, 0.8, 0]}
            visible={true}
            animate={true}
          />
          
          <FadeInText
            position={[0, -0.7, 0]}
            fontSize={0.7}
            color="#d4d8dc"
            delay={0.3}
            letterSpacing={0.15}
          >
            WINNER
          </FadeInText>
          
          <FadeInText
            position={[0, -1.7, 0]}
            fontSize={0.3}
            color="#8ba4c4"
            delay={2.8}
            letterSpacing={0.1}
          >
            YOU JUST DOUBLED YOUR PRIZE!
          </FadeInText>
          
          {/* Sparkle bursts */}
          <SparkleBurst position={[0, 0.8, 0.1]} active={true} count={44} />
          
          {/* Fireworks */}
          <Fireworks position={[-4, 2, -1]} delay={0.5} count={90} spread={2.5} />
          <Fireworks position={[4, 2, -1]} delay={0.8} count={90} spread={2.5} />
          <Fireworks position={[0, 3.5, -1]} delay={1.2} count={110} spread={3} />
          <Fireworks position={[-2.5, 0.5, -1]} delay={1.8} count={70} spread={2} />
          <Fireworks position={[2.5, 0.5, -1]} delay={2.2} count={70} spread={2} />
        </>
      )}
    </>
  );
};

// Main Game Component
const VictoryVaultGame: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    phase: 'intro',
    selectedCard: null,
    winningCard: Math.random() < 0.5 ? 0 : 1,
    prizeAmount: 10000,
    isWinner: false
  });
  
  const [loopKey, setLoopKey] = useState(0);
  
  // Restart game for loop
  const restartGame = useCallback(() => {
    setLoopKey(prev => prev + 1);
    setGameState({
      phase: 'intro',
      selectedCard: null,
      winningCard: Math.random() < 0.5 ? 0 : 1,
      prizeAmount: 10000,
      isWinner: false
    });
  }, []);
  
  // Auto-transition from intro to card selection
  useEffect(() => {
    if (gameState.phase === 'intro') {
      const timer = setTimeout(() => {
        setGameState(prev => ({ ...prev, phase: 'cardSelection' }));
      }, 5500);
      return () => clearTimeout(timer);
    }
  }, [gameState.phase, loopKey]);
  
  // Auto-select card for demo loop (after 3 seconds of showing cards)
  useEffect(() => {
    if (gameState.phase === 'cardSelection') {
      const timer = setTimeout(() => {
        // Randomly select a card
        const cardToSelect = Math.random() < 0.5 ? 0 : 1;
        handleCardSelect(cardToSelect);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [gameState.phase, loopKey]);
  
  // Auto-restart loop
  useEffect(() => {
    if (gameState.phase === 'result' || gameState.phase === 'celebration') {
      const delay = gameState.phase === 'celebration' ? 6000 : 3000;
      const timer = setTimeout(() => {
        restartGame();
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [gameState.phase, restartGame]);
  
  // Handle card selection
  const handleCardSelect = useCallback((cardIndex: number) => {
    const isWinner = cardIndex === gameState.winningCard;
    
    setGameState(prev => ({
      ...prev,
      phase: 'cardReveal',
      selectedCard: cardIndex,
      isWinner
    }));
    
    // Transition to result after flip animation
    setTimeout(() => {
      setGameState(prev => ({ ...prev, phase: 'result' }));
      
      // If winner, transition to celebration
      if (isWinner) {
        setTimeout(() => {
          setGameState(prev => ({ ...prev, phase: 'celebration' }));
        }, 1500);
      }
    }, 1200);
  }, [gameState.winningCard]);
  
  const showLogo = gameState.phase === 'intro' || gameState.phase === 'cardSelection' || 
                   gameState.phase === 'cardReveal' || gameState.phase === 'result';
  
  return (
    <div key={loopKey} style={{ width: '100%', height: '100vh', position: 'relative', background: '#061018' }}>
      <Canvas
        camera={{ position: [0, 0, 10], fov: 45 }}
        gl={{ antialias: true, alpha: false }}
      >
        <Suspense fallback={null}>
          <GameScene
            gameState={gameState}
            onCardSelect={handleCardSelect}
          />
        </Suspense>
      </Canvas>
      
      {/* SVG Logo overlay */}
      <LogoOverlay 
        visible={showLogo} 
        delay={gameState.phase === 'intro' ? 0.5 : 0}
        top={gameState.phase === 'intro' ? '18%' : '8%'}
        scale={gameState.phase === 'intro' ? 1.1 : 0.7}
      />
    </div>
  );
};

export default VictoryVaultGame;
