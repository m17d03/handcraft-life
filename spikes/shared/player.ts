/**
 * Ich-Sicht-Kamera (Steuerungskonzept B): Gehen per Stick, Umsehen per Wischen, einfache Kollision
 * mit Raumwänden und Werkbank. Reine Logik ohne DOM/Engine.
 */
import { clamp, forwardFromYawPitch, type Vec3 } from './math';

export interface PlayerBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  /** rechteckige Hindernisse (xz), z. B. Werkbank */
  readonly obstacles: readonly { minX: number; maxX: number; minZ: number; maxZ: number }[];
}

export interface PlayerInput {
  /** Stick: x rechts, y vorwärts, je −1..1 */
  readonly moveX: number;
  readonly moveY: number;
  /** Umsehen in Pixeln seit dem letzten Frame */
  readonly lookDx: number;
  readonly lookDy: number;
}

export const WALK_SPEED = 1.4; // m/s
export const LOOK_RAD_PER_PX = 0.0045;
export const PITCH_LIMIT = (80 * Math.PI) / 180;
export const PLAYER_RADIUS = 0.3;

export class FirstPersonController {
  x: number;
  z: number;
  yaw: number;
  pitch: number;

  constructor(
    start: { position: Vec3; yaw: number; pitch: number },
    readonly eyeHeight: number,
    private readonly bounds: PlayerBounds,
  ) {
    this.x = start.position[0];
    this.z = start.position[2];
    this.yaw = start.yaw;
    this.pitch = start.pitch;
  }

  get eye(): Vec3 {
    return [this.x, this.eyeHeight, this.z];
  }

  get forward(): Vec3 {
    return forwardFromYawPitch(this.yaw, this.pitch);
  }

  update(dtSeconds: number, input: PlayerInput): void {
    this.yaw -= input.lookDx * LOOK_RAD_PER_PX;
    this.pitch = clamp(this.pitch - input.lookDy * LOOK_RAD_PER_PX, -PITCH_LIMIT, PITCH_LIMIT);
    const mag = Math.hypot(input.moveX, input.moveY);
    if (mag < 1e-3) return;
    const k = Math.min(1, mag) / mag;
    const dt = Math.min(dtSeconds, 0.1); // Hänger nicht in Teleport umsetzen
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw);
    const rz = -Math.sin(this.yaw);
    const sx = (input.moveY * fx + input.moveX * rx) * k * WALK_SPEED * dt;
    const sz = (input.moveY * fz + input.moveX * rz) * k * WALK_SPEED * dt;
    this.x += sx;
    this.z += sz;
    this.collide();
  }

  private collide(): void {
    const r = PLAYER_RADIUS;
    const b = this.bounds;
    this.x = clamp(this.x, b.minX + r, b.maxX - r);
    this.z = clamp(this.z, b.minZ + r, b.maxZ - r);
    for (const o of b.obstacles) {
      const minX = o.minX - r;
      const maxX = o.maxX + r;
      const minZ = o.minZ - r;
      const maxZ = o.maxZ + r;
      if (this.x <= minX || this.x >= maxX || this.z <= minZ || this.z >= maxZ) continue;
      // auf kürzestem Weg hinausschieben
      const pushes = [
        { d: this.x - minX, apply: () => { this.x = minX; } },
        { d: maxX - this.x, apply: () => { this.x = maxX; } },
        { d: this.z - minZ, apply: () => { this.z = minZ; } },
        { d: maxZ - this.z, apply: () => { this.z = maxZ; } },
      ].sort((p, q) => p.d - q.d);
      pushes[0]?.apply();
    }
  }
}
