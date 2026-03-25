'use client';

import React, { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial, MeshWobbleMaterial } from '@react-three/drei';
import type * as THREE from 'three';

interface Ambient3DBackgroundProps {
  primaryColor?: string;
  accentColor?: string;
  variant?: 'floating-spheres' | 'abstract-torus' | 'glass-cubes' | 'minimal-rings';
  intensity?: number;
}

function hexToVec3(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
}

/** Gently floating glass sphere */
function GlassSphere({ position, color, scale = 1 }: { position: [number, number, number]; color: string; scale?: number }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.1;
      meshRef.current.rotation.y += 0.003;
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.8}>
      <mesh ref={meshRef} position={position} scale={scale}>
        <sphereGeometry args={[1, 64, 64]} />
        <MeshDistortMaterial
          color={color}
          transparent
          opacity={0.35}
          roughness={0.1}
          metalness={0.8}
          distort={0.25}
          speed={1.5}
        />
      </mesh>
    </Float>
  );
}

/** Smooth rotating torus */
function WobbleTorus({ position, color, scale = 1 }: { position: [number, number, number]; color: string; scale?: number }) {
  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={1.2}>
      <mesh position={position} scale={scale}>
        <torusGeometry args={[1, 0.35, 32, 100]} />
        <MeshWobbleMaterial
          color={color}
          transparent
          opacity={0.3}
          roughness={0.15}
          metalness={0.9}
          factor={0.3}
          speed={1}
        />
      </mesh>
    </Float>
  );
}

/** Floating abstract ring */
function MinimalRing({ position, color, scale = 1 }: { position: [number, number, number]; color: string; scale?: number }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.z = state.clock.elapsedTime * 0.2;
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.15) * 0.3;
    }
  });

  return (
    <Float speed={1} rotationIntensity={0.2} floatIntensity={0.6}>
      <mesh ref={meshRef} position={position} scale={scale}>
        <torusGeometry args={[1.2, 0.08, 16, 100]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.4}
          roughness={0.2}
          metalness={0.85}
        />
      </mesh>
    </Float>
  );
}

/** Softly rotating glass cube */
function GlassCube({ position, color, scale = 1 }: { position: [number, number, number]; color: string; scale?: number }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.15;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.1;
    }
  });

  return (
    <Float speed={1.2} rotationIntensity={0.4} floatIntensity={0.5}>
      <mesh ref={meshRef} position={position} scale={scale}>
        <boxGeometry args={[1, 1, 1]} />
        <MeshDistortMaterial
          color={color}
          transparent
          opacity={0.25}
          roughness={0.05}
          metalness={0.95}
          distort={0.1}
          speed={1}
        />
      </mesh>
    </Float>
  );
}

function SceneContent({ primaryColor, accentColor, variant }: {
  primaryColor: string;
  accentColor: string;
  variant: Ambient3DBackgroundProps['variant'];
}) {
  const [rp, gp, bp] = hexToVec3(primaryColor);
  const [ra, ga, ba] = hexToVec3(accentColor);
  void rp; void gp; void bp; void ra; void ga; void ba;

  switch (variant) {
    case 'abstract-torus':
      return (
        <>
          <WobbleTorus position={[2.5, 1, -3]} color={primaryColor} scale={1.8} />
          <GlassSphere position={[-2, -0.5, -2]} color={accentColor} scale={0.8} />
          <MinimalRing position={[-3, 1.5, -4]} color={primaryColor} scale={0.6} />
        </>
      );
    case 'glass-cubes':
      return (
        <>
          <GlassCube position={[3, 0.5, -3]} color={primaryColor} scale={1.5} />
          <GlassCube position={[-2.5, -1, -4]} color={accentColor} scale={1} />
          <GlassSphere position={[0, 2, -5]} color={primaryColor} scale={0.5} />
        </>
      );
    case 'minimal-rings':
      return (
        <>
          <MinimalRing position={[2, 0.5, -2]} color={primaryColor} scale={1.5} />
          <MinimalRing position={[-2, -0.5, -3]} color={accentColor} scale={1} />
          <MinimalRing position={[0, 1.5, -4]} color={primaryColor} scale={0.7} />
        </>
      );
    case 'floating-spheres':
    default:
      return (
        <>
          <GlassSphere position={[3, 1, -3]} color={primaryColor} scale={1.5} />
          <GlassSphere position={[-2.5, -0.5, -4]} color={accentColor} scale={1} />
          <GlassSphere position={[0.5, 2, -5]} color={primaryColor} scale={0.6} />
          <GlassSphere position={[-1, -1.5, -2.5]} color={accentColor} scale={0.4} />
        </>
      );
  }
}

/**
 * Premium ambient 3D background for title slides.
 * Renders gently floating, glassy 3D objects using the project's theme colors.
 * This is the key differentiator vs competitors like Canva and Pitch.
 */
export function Ambient3DBackground({
  primaryColor = '#3b82f6',
  accentColor = '#10b981',
  variant = 'floating-spheres',
  intensity = 0.5,
}: Ambient3DBackgroundProps) {
  return (
    <div
      className="absolute inset-0 pointer-events-none z-0"
      style={{ opacity: Math.min(intensity, 0.8) }}
    >
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 5], fov: 50 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: 'transparent' }}
      >
        <Suspense fallback={null}>
          {/* Soft ambient lighting */}
          <ambientLight intensity={0.4} />
          <directionalLight position={[5, 5, 5]} intensity={0.6} />
          <pointLight position={[-5, -5, 5]} intensity={0.3} color={primaryColor} />
          <pointLight position={[5, -3, 3]} intensity={0.2} color={accentColor} />

          <SceneContent
            primaryColor={primaryColor}
            accentColor={accentColor}
            variant={variant}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

export default Ambient3DBackground;
