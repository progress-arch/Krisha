/**
 * Twinkling night sky drawn on a canvas: layered stars with a touch of
 * parallax, a few drifting fireflies, and the occasional shooting star.
 */
interface Star {
  x: number;
  y: number;
  r: number;
  alpha: number;
  speed: number;
  phase: number;
  depth: number;
  rgb: string;
}

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  phase: number;
}

interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
}

const STAR_TINTS = ['255,255,255', '206,220,255', '255,232,210', '230,236,255'];

export function startStarfield(canvas: HTMLCanvasElement, stage: HTMLElement, reduced: boolean): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  let width = 0;
  let height = 0;
  let stars: Star[] = [];
  let motes: Mote[] = [];
  let meteor: Meteor | null = null;
  let nextMeteorAt = 3 + Math.random() * 5;
  let previous = performance.now();
  let raf = 0;

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.round((width * height) / 2400);
    stars = Array.from({ length: count }, () => {
      const depth = Math.random() ** 2.4;
      return {
        x: Math.random() * width,
        y: Math.random() ** 1.3 * height * 0.9,
        r: 0.35 + depth * 1.35,
        alpha: 0.25 + Math.random() * 0.65,
        speed: 0.4 + Math.random() * 2.6,
        phase: Math.random() * Math.PI * 2,
        depth,
        rgb: STAR_TINTS[(Math.random() * STAR_TINTS.length) | 0],
      };
    });

    motes = Array.from({ length: reduced ? 0 : Math.round(width / 70) }, () => ({
      x: Math.random() * width,
      y: height * (0.35 + Math.random() * 0.65),
      vx: (Math.random() - 0.5) * 6,
      vy: -(4 + Math.random() * 10),
      r: 0.8 + Math.random() * 1.6,
      phase: Math.random() * Math.PI * 2,
    }));
  };

  const frame = (now: number) => {
    const dt = Math.min((now - previous) / 1000, 0.05);
    previous = now;
    const t = now / 1000;
    const style = stage.style;
    const px = parseFloat(style.getPropertyValue('--px')) || 0;
    const py = parseFloat(style.getPropertyValue('--py')) || 0;

    ctx.clearRect(0, 0, width, height);

    for (const s of stars) {
      const twinkle = reduced ? 1 : 0.6 + 0.4 * Math.sin(t * s.speed + s.phase);
      const x = s.x - px * s.depth * 14;
      const y = s.y - py * s.depth * 8;
      ctx.globalAlpha = s.alpha * twinkle;
      ctx.fillStyle = `rgb(${s.rgb})`;
      ctx.beginPath();
      ctx.arc(x, y, s.r, 0, Math.PI * 2);
      ctx.fill();

      // The brightest few get a soft cross-shaped glint.
      if (s.r > 1.45 && twinkle > 0.85) {
        const len = s.r * 5 * twinkle;
        ctx.globalAlpha = s.alpha * (twinkle - 0.85) * 3;
        ctx.fillRect(x - len, y - 0.3, len * 2, 0.6);
        ctx.fillRect(x - 0.3, y - len, 0.6, len * 2);
      }
    }

    for (const m of motes) {
      m.x += (m.vx + Math.sin(t * 0.8 + m.phase) * 6) * dt;
      m.y += m.vy * dt;
      if (m.y < height * 0.25) {
        m.y = height + 10;
        m.x = Math.random() * width;
      }
      const glow = 0.35 + 0.35 * Math.sin(t * 2 + m.phase);
      const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 5);
      g.addColorStop(0, `rgba(255,214,150,${glow})`);
      g.addColorStop(1, 'rgba(255,190,120,0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r * 5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (!reduced) {
      if (!meteor && t > nextMeteorAt) {
        const fromLeft = Math.random() < 0.5;
        const speed = 700 + Math.random() * 500;
        const angle = (18 + Math.random() * 22) * (Math.PI / 180);
        meteor = {
          x: fromLeft ? Math.random() * width * 0.5 : width * (0.5 + Math.random() * 0.5),
          y: Math.random() * height * 0.3,
          vx: Math.cos(angle) * speed * (fromLeft ? 1 : -1),
          vy: Math.sin(angle) * speed,
          age: 0,
          life: 0.9 + Math.random() * 0.6,
        };
      }
      if (meteor) {
        meteor.age += dt;
        meteor.x += meteor.vx * dt;
        meteor.y += meteor.vy * dt;
        const p = meteor.age / meteor.life;
        const fade = Math.sin(Math.min(p, 1) * Math.PI);
        const tailX = meteor.x - meteor.vx * 0.12;
        const tailY = meteor.y - meteor.vy * 0.12;
        const g = ctx.createLinearGradient(meteor.x, meteor.y, tailX, tailY);
        g.addColorStop(0, `rgba(255,255,255,${0.9 * fade})`);
        g.addColorStop(1, 'rgba(180,200,255,0)');
        ctx.globalAlpha = 1;
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(meteor.x, meteor.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();
        if (p >= 1) {
          meteor = null;
          nextMeteorAt = t + 5 + Math.random() * 9;
        }
      }
    }

    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  };

  resize();
  window.addEventListener('resize', resize);
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
  };
}
