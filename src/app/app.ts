import { Component, DestroyRef, ElementRef, afterNextRender, inject, viewChild } from '@angular/core';
import { createCardMotion } from './card-motion';
import { startStarfield } from './starfield';

/** Number of stacked layers that give the card its physical thickness. */
const EDGE_LAYERS = 9;
const EDGE_SPACING_PX = 0.6;

@Component({
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly edges = Array.from(
    { length: EDGE_LAYERS },
    (_, i) => `translateZ(${((i - (EDGE_LAYERS - 1) / 2) * EDGE_SPACING_PX).toFixed(2)}px)`,
  );

  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  private readonly rig = viewChild.required<ElementRef<HTMLElement>>('rig');
  private readonly card = viewChild.required<ElementRef<HTMLElement>>('card');
  private readonly pool = viewChild.required<ElementRef<HTMLElement>>('pool');
  private readonly sky = viewChild.required<ElementRef<HTMLCanvasElement>>('sky');

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      if (typeof requestAnimationFrame !== 'function') return;

      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      const stage = this.stage().nativeElement;
      const card = this.card().nativeElement;

      const stopSky = startStarfield(this.sky().nativeElement, stage, reduced);
      const motion = createCardMotion(
        { stage, rig: this.rig().nativeElement, card, pool: this.pool().nativeElement },
        reduced,
      );

      // Reveal once both faces are decoded so the card never pops in half-drawn.
      const faces = Array.from(card.querySelectorAll('img'));
      const ready = faces.map((img) => (img.decode ? img.decode().catch(() => undefined) : undefined));
      const fallback = setTimeout(() => motion.reveal(), 2500);
      Promise.all(ready).then(() => {
        clearTimeout(fallback);
        motion.reveal();
      });

      destroyRef.onDestroy(() => {
        clearTimeout(fallback);
        motion.destroy();
        stopSky();
      });
    });
  }
}
