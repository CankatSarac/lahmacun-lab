// Orbit / zoom / pan for the cross-section canvas. Pointer, wheel, pinch and keyboard.

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function attachCamera(canvas, onChange) {
  const cam = { yaw: 0.28, zoom: 1, px: 0, py: 0 };
  const reset = () => { cam.yaw = 0.28; cam.zoom = 1; cam.px = 0; cam.py = 0; onChange(); };

  let drag = null;
  const pointers = new Map();
  let pinchStart = 0, pinchZoom = 1;

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
      pinchZoom = cam.zoom;
      drag = null;
    } else {
      drag = { x: e.clientX, y: e.clientY, pan: e.shiftKey || e.button === 1 };
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchStart > 0) cam.zoom = clamp((pinchZoom * d) / pinchStart, 0.5, 6);
      onChange();
      return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    if (drag.pan) {
      cam.px += dx; cam.py += dy;
    } else {
      cam.yaw = clamp(cam.yaw + dx * 0.006, -0.9, 0.9);
      cam.py = clamp(cam.py + dy * 0.35, -220, 220);
    }
    onChange();
  });

  const release = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = 0;
    if (pointers.size === 0) drag = null;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    cam.zoom = clamp(cam.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12), 0.5, 6);
    onChange();
  }, { passive: false });

  canvas.addEventListener('keydown', (e) => {
    const k = e.key;
    if (k === 'ArrowLeft') cam.yaw = clamp(cam.yaw - 0.08, -0.9, 0.9);
    else if (k === 'ArrowRight') cam.yaw = clamp(cam.yaw + 0.08, -0.9, 0.9);
    else if (k === 'ArrowUp') cam.py -= 12;
    else if (k === 'ArrowDown') cam.py += 12;
    else if (k === '+' || k === '=') cam.zoom = clamp(cam.zoom * 1.12, 0.5, 6);
    else if (k === '-' || k === '_') cam.zoom = clamp(cam.zoom / 1.12, 0.5, 6);
    else if (k === 'Home') return reset();
    else return;
    e.preventDefault();
    onChange();
  });

  return { cam, reset, zoomBy: (f) => { cam.zoom = clamp(cam.zoom * f, 0.5, 6); onChange(); } };
}
