// Test-Schnittstelle der HUD-Testseite (window.__hudDemo), ohne CSS-Import nutzbar in E2E-Tests.
import type { Befehl } from '../input/befehle';
import type { Hud } from '../ui/hud-typen';

export interface DemoZustand {
  geld: number;
  mm: number;
  markeMm: number | null;
  versatzMm: number;
  zug: number;
  stuetzen: boolean;
  blick: { x: number; y: number };
  gang: { x: number; z: number };
}

declare global {
  interface Window {
    __hudDemo?: { befehle: Befehl[]; hud: Hud; zustand: () => DemoZustand };
  }
}
