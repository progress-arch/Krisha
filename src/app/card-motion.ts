/**
 * Physics-ish driver for the floating card.
 *
 * The card idles in a slow spin, can be flung by dragging (with momentum that
 * eases back into the idle spin), leans toward the pointer, and bobs gently.
 * Every frame it also publishes lighting values as CSS custom properties so the
 * glare, holographic foil, shading and floor shadow follow the card's angle.
 */
export interface CardMotionElements {
  stage: HTMLElement;
  /** Wrapper that receives the intro fade/blur (kept off the 3D card itself). */
  rig: HTMLElement;
  card: HTMLElement;
  pool: HTMLElement;
}

export interface CardMotion {
  reveal(): void;
  destroy(): void;
}

const IDLE_SPEED = 24; // deg/s
const REDUCED_IDLE_SPEED = 8;
const INTRO_SECONDS = 2.2;
const DRAG_GAIN = 0.45; // deg per px dragged
const MAX_FLING = 1400; // deg/s

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const approach = (from: number, to: number, rate: number, dt: number) =>
  from + (to - from) * (1 - Math.exp(-rate * dt));
/** Wraps an angle into (-180, 180]. */
const wrap = (deg: number) => {
  const a = ((deg % 360) + 360) % 360;
  return a > 180 ? a - 360 : a;
};
const easeOutCubic = (p: number) => 1 - (1 - p) ** 3;
const easeOutBack = (p: number) => 1 + 2.2 * (p - 1) ** 3 + 1.2 * (p - 1) ** 2;

export function createCardMotion({ stage, rig, card, pool }: CardMotionElements, reduced: boolean): CardMotion {
  const idle = reduced ? REDUCED_IDLE_SPEED : IDLE_SPEED;

  let angle = -25;
  let velocity = idle;
  let direction = 1;

  // Pointer-driven lean, smoothed toward targets.
  let leanX = 0, leanXTarget = 0;
  let leanY = 0, leanYTarget = 0;
  let parallaxX = 0, parallaxY = 0;

  let dragging = false;
  let dragPointer = -1;
  let lastX = 0;
  let lastMoveAt = 0;
  let dragVelocity = 0;

  let revealedAt: number | null = null;
  const startedAt = performance.now();
  let previous = startedAt;
  let raf = 0;

  const onPointerMove = (e: PointerEvent) => {
    const nx = clamp((e.clientX / innerWidth) * 2 - 1, -1, 1);
    const ny = clamp((e.clientY / innerHeight) * 2 - 1, -1, 1);
    if (e.pointerType === 'mouse' || dragging) {
      leanXTarget = -ny * 14;
      leanYTarget = nx * 12;
    }

    if (dragging && e.pointerId === dragPointer) {
      const now = performance.now();
      const dx = e.clientX - lastX;
      const dt = Math.max(now - lastMoveAt, 1) / 1000;
      angle += dx * DRAG_GAIN;
      dragVelocity = dragVelocity * 0.5 + ((dx * DRAG_GAIN) / dt) * 0.5;
      lastX = e.clientX;
      lastMoveAt = now;
    }
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    dragging = true;
    dragPointer = e.pointerId;
    lastX = e.clientX;
    lastMoveAt = performance.now();
    dragVelocity = 0;
    stage.setPointerCapture?.(e.pointerId);
    stage.classList.add('grabbing');
    onPointerMove(e);
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!dragging || e.pointerId !== dragPointer) return;
    dragging = false;
    stage.classList.remove('grabbing');
    // A drag that stopped before release shouldn't fling.
    const stale = performance.now() - lastMoveAt > 90;
    velocity = stale ? 0 : clamp(dragVelocity, -MAX_FLING, MAX_FLING);
    if (Math.abs(velocity) > 20) direction = Math.sign(velocity);
    if (e.pointerType !== 'mouse') {
      leanXTarget = 0;
      leanYTarget = 0;
    }
  };

  const onPointerLeave = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && !dragging) {
      leanXTarget = 0;
      leanYTarget = 0;
    }
  };

  stage.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  document.documentElement.addEventListener('pointerleave', onPointerLeave);

  const frame = (now: number) => {
    const dt = Math.min((now - previous) / 1000, 0.05);
    previous = now;
    const t = (now - startedAt) / 1000;

    if (!dragging) {
      velocity = approach(velocity, idle * direction, 0.9, dt);
      angle += velocity * dt;
    }

    leanX = approach(leanX, leanXTarget, 4, dt);
    leanY = approach(leanY, leanYTarget, 4, dt);
    parallaxX = approach(parallaxX, leanYTarget / 12, 2.5, dt);
    parallaxY = approach(parallaxY, -leanXTarget / 14, 2.5, dt);

    // Intro: the card drops in, unblurs and settles with a little overshoot.
    let intro = 0;
    if (revealedAt !== null) intro = reduced ? 1 : clamp((now - revealedAt) / 1000 / INTRO_SECONDS, 0, 1);
    const introEase = easeOutCubic(intro);
    const introScale = reduced ? 1 : 0.55 + 0.45 * easeOutBack(intro);

    const bob = reduced ? 0 : Math.sin(t * 1.15) * 12 + Math.sin(t * 0.37) * 4;
    const lift = (Math.sin(t * 1.15) + 1) / 2; // 0 low … 1 high
    const drop = (1 - introEase) * -140;
    const rx = leanX + (reduced ? 0 : Math.sin(t * 0.83) * 5);
    const rz = reduced ? 0 : Math.sin(t * 0.61) * 2.5;
    const ry = angle + leanY;

    rig.style.opacity = introEase.toFixed(3);
    rig.style.filter = intro < 1 ? `blur(${((1 - introEase) * 12).toFixed(2)}px)` : '';
    card.style.transform =
      `translate3d(0, ${(bob + drop).toFixed(2)}px, 0) ` +
      `rotateZ(${rz.toFixed(2)}deg) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) ` +
      `scale(${introScale.toFixed(4)})`;

    // Lighting. Light comes from the upper-right (where the moon is).
    const front = wrap(ry);
    const back = wrap(ry - 180);
    const facing = Math.abs(Math.cos((ry * Math.PI) / 180)); // 1 face-on, 0 edge-on
    const s = card.style;
    s.setProperty('--gxf', `${(55 - front * 1.6).toFixed(1)}%`);
    s.setProperty('--gxb', `${(55 - back * 1.6).toFixed(1)}%`);
    s.setProperty('--gy', `${(22 - rx * 2.5).toFixed(1)}%`);
    s.setProperty('--hpf', `${((front + 180) / 3.6).toFixed(1)}%`);
    s.setProperty('--hpb', `${((back + 180) / 3.6).toFixed(1)}%`);
    s.setProperty('--holo', (0.1 + (1 - facing) * 0.4).toFixed(3));
    s.setProperty('--shade', ((1 - facing) * 0.55).toFixed(3));

    // The floor shadow tracks the card's footprint and height.
    const footprint = 0.18 + 0.82 * facing;
    const height = reduced ? 0.5 : lift;
    pool.style.transform = `scale(${(footprint * (1.05 - height * 0.18)).toFixed(3)}, ${(1 - height * 0.12).toFixed(3)})`;
    pool.style.opacity = ((0.95 - height * 0.35) * introEase).toFixed(3);

    stage.style.setProperty('--px', parallaxX.toFixed(3));
    stage.style.setProperty('--py', parallaxY.toFixed(3));

    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return {
    reveal() {
      if (revealedAt !== null) return;
      revealedAt = performance.now();
      if (!reduced) velocity = 820 * direction; // spin in fast, then settle
    },
    destroy() {
      cancelAnimationFrame(raf);
      stage.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
    },
  };
}
