// Compiles every material in the room before the first frame is drawn, one
// program per task, so the compile never lands as one long main-thread block.
//
// Without this the first render links every shader program synchronously: 1.6 s
// of blocked main thread on a desktop GPU under ANGLE/D3D11 and over 3 s on
// SwiftShader, measured with Lighthouse and a CPU profile (Phase 4.1). The time
// is all in WebGLProgram.getUniforms waiting on the link.
//
// gl.compile() only issues the compile and link commands; the GPU process works
// through them in order. Each program is then awaited on its own:
//   - with KHR_parallel_shader_compile, by polling isReady() without blocking
//   - without it, getUniforms() blocks for that one link only, then yields
// Either way no task holds the main thread for more than one program.
//
// The composer draws the scene into a render target, and three builds a
// different program for a render target than for the screen (no tone mapping,
// linear output). So the warm-up compiles against one whenever the composer is
// on, or every program it built would be thrown away by the first frame.
//
// Renders nothing. Must sit inside the Canvas, after the scene, so every object
// it has to compile is already in the graph when its effect runs.

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { HalfFloatType, WebGLRenderTarget, type Material } from 'three';

import { effectsEnabled } from './Effects';
import { useSceneStore } from '../lib/stores/scene';

const POLL_MS = 10;

/** The two WebGLProgram methods used here; three's types leave properties untyped. */
interface WarmingProgram {
  isReady(): boolean;
  getUniforms(): unknown;
}

const wait =(ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface ShaderWarmupProps {
  onReady: () => void;
}

export function ShaderWarmup({ onReady }: ShaderWarmupProps) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    let cancelled = false;

    async function warm() {
      const target = effectsEnabled(useSceneStore.getState())
        ? new WebGLRenderTarget(1, 1, { type: HalfFloatType })
        : null;
      gl.setRenderTarget(target);
      const materials: Set<Material> = gl.compile(scene, camera);
      gl.setRenderTarget(null);
      target?.dispose();
      for (const material of materials) {
        if (cancelled) return;
        // `currentProgram` is three's own record of the program compile() built.
        const program = (gl.properties.get(material) as { currentProgram?: WarmingProgram }).currentProgram;
        if (!program) continue;
        while (!program.isReady()) {
          await wait(POLL_MS);
          if (cancelled) return;
        }
        program.getUniforms();
        await wait(0);
      }
      if (!cancelled) onReady();
    }

    // A failed warm-up must not leave the room blank: draw anyway, and let the
    // first frame compile whatever is left the slow way.
    warm().catch(() => {
      if (!cancelled) onReady();
    });

    return () => {
      cancelled = true;
    };
  }, [gl, scene, camera, onReady]);

  return null;
}
