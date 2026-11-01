import { describe, expect, it } from 'vitest';
import { auftragErzeugen } from '../../../src/core/auftraege';
import { zufallsquelle } from '../../../src/core/zufall';
import { AUFTRAG_REGALBRETT } from '../../../src/modules/holz/data/stammdaten';
import { bereit, folge, katalog, zuege } from './hilfen';

// Lernkurve „geführt“ (holz-brett-zuschnitt §5): Auftrag 1–2 mit ± 2 mm, danach ± 1 mm (Ticket 013, QA F3).
describe('Einstiegs-Toleranz', () => {
  it('auftragErzeugen: erste zwei Aufträge ± 2 mm, ab dem dritten ± 1 mm', () => {
    const z = zufallsquelle(1).zufall;
    expect(auftragErzeugen(katalog, AUFTRAG_REGALBRETT, 'af_1', z, true).toleranz).toEqual({ delta_l_mm: 2 });
    expect(auftragErzeugen(katalog, AUFTRAG_REGALBRETT, 'af_2', z, false, 1).toleranz).toEqual({ delta_l_mm: 2 });
    expect(auftragErzeugen(katalog, AUFTRAG_REGALBRETT, 'af_3', z, false, 2).toleranz).toEqual({ delta_l_mm: 1 });
    expect(auftragErzeugen(katalog, AUFTRAG_REGALBRETT, 'af_9', z, false).toleranz).toEqual({ delta_l_mm: 1 });
  });

  it('Abliefern: Folgeauftrag nach dem 1. noch Einstieg, nach dem 2. normal', () => {
    let z = bereit();
    const runde = (): void => {
      const auftrag = z.auftraege.find((a) => a.status === 'angenommen');
      const ws = z.inventar.werkstuecke.find((w) => w.masse_mm.l >= 1000);
      if (!auftrag || !ws) throw new Error('kein Auftrag/Brett');
      const soll = auftrag.soll['laenge_mm'] ?? 600;
      z = folge(z, [
        { art: 'zuschnittBeginnen', werkstueckId: ws.id },
        { art: 'bezugsendeWaehlen', ende: 'a' },
        { art: 'markierungSetzen', mm: soll },
        { art: 'anreissen' },
        { art: 'blattVersatzSetzen', mm: 0.8 },
        ...zuege(8, 0, 0.5),
        { art: 'abliefern' },
      ]).zustand;
    };
    runde();
    const zweiter = z.auftraege.find((a) => a.status === 'angeboten');
    expect(zweiter?.toleranz).toEqual({ delta_l_mm: 2 });
    if (zweiter) zweiter.status = 'angenommen';
    runde();
    expect(z.tutorial).toBe(2);
    expect(z.auftraege.find((a) => a.status === 'angeboten')?.toleranz).toEqual({ delta_l_mm: 1 });
  });
});
