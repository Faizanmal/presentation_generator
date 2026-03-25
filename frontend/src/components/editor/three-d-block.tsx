'use client';

import React, { Suspense } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, Stage, Float } from '@react-three/drei';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface ThreeDBlockProps {
  modelUrl?: string;
  autoRotate?: boolean;
  scale?: number;
  environment?: 'sunset' | 'city' | 'studio' | 'apartment' | 'forest';
}

function Model({ url, scale }: { url: string; scale: number }) {
  const gltf = useLoader(GLTFLoader, url);
  return <primitive object={gltf.scene} scale={[scale, scale, scale]} />;
}

export function ThreeDBlock({ 
  modelUrl = '', 
  autoRotate = true,
  scale = 1,
  environment = 'city'
}: ThreeDBlockProps) {
  // Free sample model to show off capabilities
  const url = modelUrl || 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb';

  return (
    <div className="w-full h-full min-h-100 rounded-2xl overflow-hidden shadow-2xl bg-linear-to-br from-black/5 to-black/10 dark:from-white/5 dark:to-white/10 relative group cursor-grab active:cursor-grabbing border border-white/20 backdrop-blur-sm">
      <Canvas shadows dpr={[1, 2]} camera={{ fov: 45 }}>
        <Suspense fallback={null}>
          <Stage environment={environment} intensity={0.5} shadows scale={scale}>
            <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
              <Model url={url} scale={scale} />
            </Float>
          </Stage>
        </Suspense>
        <OrbitControls autoRotate={autoRotate} autoRotateSpeed={2} makeDefault />
      </Canvas>
      <div className="absolute inset-0 pointer-events-none rounded-2xl ring-1 ring-inset ring-white/10" />
      <div className="absolute bottom-3 right-3 px-3 py-1.5 bg-black/60 backdrop-blur-md text-white text-xs font-medium rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none flex items-center gap-2 shadow-xl">
        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        Interactive 3D Model
      </div>
    </div>
  );
}
