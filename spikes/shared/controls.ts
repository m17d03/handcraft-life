/**
 * Touch-Steuerung nach Konzept B (docs/design/steuerung-a-b.md), Querformat:
 * linke Hälfte = Stick erscheint unter dem Daumen (gehen), rechte Hälfte = ziehen (umsehen).
 * Tippen (kurz, wenig Bewegung) und Wischen auf dem ausgewählten Balken gehen an die Callbacks.
 * Pointer Events → funktioniert gleich für Finger, Maus und Stift; Tastatur WASD/Pfeile für Desktop.
 */
import type { PlayerInput } from './player';

export interface ControlCallbacks {
  /** true → diese Geste setzt die Schnittlinie (statt gehen/umsehen) */
  beginCut(x: number, y: number): boolean;
  moveCut(x: number, y: number): void;
  endCut(): void;
  tap(x: number, y: number, timeStamp: number): void;
}

type Zone = 'move' | 'look' | 'cut';

interface Active {
  zone: Zone;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startT: number;
  maxDist: number;
}

export const STICK_RADIUS = 56; // CSS-px
const EDGE_DEAD = 20; // Safari-Zurückgeste
const TAP_MAX_MS = 350;
const TAP_MAX_PX = 10;

export class TouchControls {
  private readonly active = new Map<number, Active>();
  private moveX = 0;
  private moveY = 0;
  private lookDx = 0;
  private lookDy = 0;
  private readonly keys = new Set<string>();
  private readonly stick: HTMLElement;
  private readonly knob: HTMLElement;
  private readonly lookDot: HTMLElement;

  constructor(
    private readonly surface: HTMLElement,
    hud: HTMLElement,
    private readonly cb: ControlCallbacks,
  ) {
    this.stick = el('div', 'stick');
    this.knob = el('div', 'stick-knob');
    this.stick.append(this.knob);
    this.lookDot = el('div', 'look-dot');
    hud.append(this.stick, this.lookDot);

    surface.addEventListener('pointerdown', (e) => { this.down(e); });
    surface.addEventListener('pointermove', (e) => { this.move(e); });
    surface.addEventListener('pointerup', (e) => { this.up(e, true); });
    surface.addEventListener('pointercancel', (e) => { this.up(e, false); });
    surface.addEventListener('contextmenu', (e) => { e.preventDefault(); });
    // iOS: Seiten-Pinch/Doppeltipp-Zoom unterdrücken
    document.addEventListener('gesturestart', (e) => { e.preventDefault(); });
    surface.addEventListener('touchmove', (e) => { e.preventDefault(); }, { passive: false });
    window.addEventListener('keydown', (e) => { this.keys.add(e.code); });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    window.addEventListener('blur', () => { this.keys.clear(); });
  }

  private local(e: PointerEvent): { x: number; y: number } {
    const r = this.surface.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private down(e: PointerEvent): void {
    const { x, y } = this.local(e);
    const w = this.surface.clientWidth;
    if (x < EDGE_DEAD || x > w - EDGE_DEAD) return;
    let zone: Zone;
    if (this.cb.beginCut(x, y)) zone = 'cut';
    else if (x < w / 2 && ![...this.active.values()].some((a) => a.zone === 'move')) zone = 'move';
    else zone = 'look';
    try {
      this.surface.setPointerCapture(e.pointerId);
    } catch {
      // synthetische Events (Tests) haben keinen aktiven Pointer – Geste funktioniert trotzdem
    }
    this.active.set(e.pointerId, { zone, startX: x, startY: y, lastX: x, lastY: y, startT: e.timeStamp, maxDist: 0 });
    if (zone === 'move') {
      this.stick.style.transform = `translate(${String(x)}px, ${String(y)}px)`;
      this.knob.style.transform = 'translate(0px, 0px)';
      this.stick.classList.add('on');
    } else if (zone === 'look') {
      this.showDot(x, y);
    }
  }

  private move(e: PointerEvent): void {
    const a = this.active.get(e.pointerId);
    if (!a) return;
    const { x, y } = this.local(e);
    a.maxDist = Math.max(a.maxDist, Math.hypot(x - a.startX, y - a.startY));
    if (a.zone === 'move') {
      let dx = x - a.startX;
      let dy = y - a.startY;
      const d = Math.hypot(dx, dy);
      if (d > STICK_RADIUS) {
        dx = (dx / d) * STICK_RADIUS;
        dy = (dy / d) * STICK_RADIUS;
      }
      this.moveX = dx / STICK_RADIUS;
      this.moveY = -dy / STICK_RADIUS;
      this.knob.style.transform = `translate(${String(dx)}px, ${String(dy)}px)`;
    } else if (a.zone === 'look') {
      this.lookDx += x - a.lastX;
      this.lookDy += y - a.lastY;
      this.showDot(x, y);
    } else {
      this.cb.moveCut(x, y);
    }
    a.lastX = x;
    a.lastY = y;
  }

  private up(e: PointerEvent, normal: boolean): void {
    const a = this.active.get(e.pointerId);
    if (!a) return;
    this.active.delete(e.pointerId);
    if (a.zone === 'move') {
      this.moveX = 0;
      this.moveY = 0;
      this.stick.classList.remove('on');
    } else if (a.zone === 'look') {
      this.lookDot.classList.remove('on');
    } else {
      this.cb.endCut();
    }
    const isTap = normal && a.maxDist <= TAP_MAX_PX && e.timeStamp - a.startT <= TAP_MAX_MS;
    if (isTap) this.cb.tap(a.startX, a.startY, e.timeStamp);
  }

  private showDot(x: number, y: number): void {
    this.lookDot.style.transform = `translate(${String(x)}px, ${String(y)}px)`;
    this.lookDot.classList.add('on');
  }

  /** Eingabe dieses Frames abholen (Umsehen wird danach zurückgesetzt). */
  consume(): PlayerInput {
    let kx = 0;
    let ky = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) ky += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) ky -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) kx += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) kx -= 1;
    const input: PlayerInput = {
      moveX: this.moveX + kx,
      moveY: this.moveY + ky,
      lookDx: this.lookDx,
      lookDy: this.lookDy,
    };
    this.lookDx = 0;
    this.lookDy = 0;
    return input;
  }
}

function el(tag: string, cls: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = cls;
  return e;
}
