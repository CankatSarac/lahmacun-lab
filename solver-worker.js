// Worker boundary. Precompute the entire bake, then hand back a fixed number of frames so
// the main thread only ever scrubs an array. This is why playback is instant regardless of
// how long the bake is.
//
// The contract here (init -> advance -> snapshot) is deliberately the shape a compiled
// module would expose, so physics.js can be swapped for a WASM build without the app
// noticing. See plan/00-project-requirements.md section 10.

import { createSolver } from './physics.js';

const FRAME_TARGET = 360;

self.onmessage = ({ data: { id, p } }) => {
  try {
    const solver = createSolver(p);
    const duration = Math.max(1, p.sure);
    const step = Math.max(0.25, duration / FRAME_TARGET);
    const frames = [solver.snapshot()];
    const times = [0];
    for (let t = 0; t < duration;) {
      const dt = Math.min(step, duration - t);
      solver.advance(dt);
      t += dt;
      frames.push(solver.snapshot());
      times.push(t);
      if (frames.length % 24 === 0) self.postMessage({ id, progress: t / duration });
    }
    self.postMessage({ id, frames, times }, frames.map((f) => f.buffer));
  } catch (e) {
    self.postMessage({ id, error: e && e.message ? e.message : String(e) });
  }
};
