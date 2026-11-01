/**
 * Balken-Interaktion: antippen → ausgewählt (Hervorhebung), dann auf dem Balken wischen →
 * Schnittlinie folgt dem Finger (auf 1 mm gerastert). Reine Logik auf Basis von Strahlen.
 */
import { clamp, pointOnRay, rayAabb, rayHorizontalPlane, type Aabb, type Ray } from './math';

export class BeamInteraction {
  selected = false;
  /** Schnittposition als Welt-X (m), null = keine Linie */
  cutX: number | null = null;
  private cutting = false;

  constructor(private readonly beam: Aabb) {}

  hits(ray: Ray): boolean {
    return rayAabb(ray, this.beam) !== null;
  }

  /** Tippen: auf den Balken → Auswahl umschalten; daneben → Auswahl aufheben. Liefert true bei Änderung. */
  tap(ray: Ray): boolean {
    const before = this.selected;
    this.selected = this.hits(ray) ? !this.selected : false;
    return before !== this.selected;
  }

  /**
   * Beginn einer Geste; true, wenn sie als Schnittlinien-Geste übernommen wird. Die Linie folgt erst
   * ab der ersten Bewegung, damit ein Tippen auf den ausgewählten Balken nur die Auswahl aufhebt.
   */
  beginCut(ray: Ray): boolean {
    this.cutting = this.selected && this.hits(ray);
    return this.cutting;
  }

  moveCut(ray: Ray): void {
    if (!this.cutting) return;
    const t = rayAabb(ray, this.beam);
    const p = t !== null ? pointOnRay(ray, t) : rayHorizontalPlane(ray, this.beam.max[1]);
    if (!p) return;
    const x = clamp(p[0], this.beam.min[0], this.beam.max[0]);
    this.cutX = this.beam.min[0] + Math.round((x - this.beam.min[0]) * 1000) / 1000;
  }

  endCut(): void {
    this.cutting = false;
  }

  get isCutting(): boolean {
    return this.cutting;
  }

  /** Schnittmass ab linkem Balkenende in mm (null ohne Linie). */
  get cutMm(): number | null {
    return this.cutX === null ? null : Math.round((this.cutX - this.beam.min[0]) * 1000);
  }
}
