/**
 * Spielsteuerung des Vertical Slice (Ticket 013): verbindet Eingabe-Befehle (src/input), Spielregeln
 * (Fassade `ausfuehren` in src/core), Spielstand (src/core/save), Darstellung (View-API) und HUD.
 *
 * Grundsatz: Der Spielzustand aus dem Kern ist die einzige Wahrheit. Nach jeder Aktion zeichnet
 * `darstellen()` View und HUD vollständig aus ihm neu. Lokal (nicht gespeichert) sind nur: steht der Spieler
 * an der Bank, aktueller Massband-Wert, „Sägen ›“ getippt – ein Neuladen setzt diese sauber zurück.
 */
import { textFuer, type Katalog } from '../core/modul';
import type { LadeAusgang, Spielstand } from '../core/save';
import { angenommenerAuftrag, ausfuehren, werkstueckImLager, type Aktion, type AktionsErgebnis } from '../core/zuschnitt';
import type { Spielzustand } from '../core/zustand';
import { AKTIONEN, type Befehl } from '../input/befehle';
import type { WerkstattViewDebug } from '../render/view-api';
import type { Hud, HudModus } from '../ui/hud-typen';
import { installHinweisPruefen } from '../ui/installhinweis';
import {
  aktuellerAuftrag,
  auftragText,
  bedarfMm,
  endeAusMm,
  endrisse,
  ergebnisKarte,
  grundText,
  hudModusFuer,
  schrittHinweis,
  stueckWaehlen,
} from './ablauf';

/** Objekte, deren Antippen bzw. Anvisieren zur Werkbank führt. */
const WERKBANK_ZIELE = new Set(['werkbank', 'brett', 'reststueck', 'saege', 'massband', 'bleistift']);
export const AKTION_WERKBANK = 'werkbank';
const RASTER_MM = 0.5;

const aufRaster = (mm: number): number => Math.round(mm / RASTER_MM) * RASTER_MM + 0;

export interface SpielOptionen {
  katalog: Katalog;
  view: WerkstattViewDebug;
  hud: Hud;
  spielstand: Spielstand;
  zustand: Spielzustand;
  ladeAusgang: LadeAusgang;
  /** Zeile im Debug-Overlay setzen (nur mit ?debug=1). */
  debugZeile?: (schluessel: string, text: string | null) => void;
  /** Wurzel für Banner und Installationshinweis. */
  wurzel?: HTMLElement;
}

/** Lesezugriff für Tests und Debug (`window.__spiel`). */
export interface SpielDebug {
  zustand(): Spielzustand;
  ui(): { anDerBank: boolean; massMm: number; saegenFreigegeben: boolean; hudModus: HudModus; hinweis: string | null; aktionstaste: boolean };
  speicher(): ReturnType<Spielstand['status']>;
  /** Text zu einer Ursache-ID (wie auf der Ergebniskarte). */
  text(id: string, wert?: number): string;
}

export class Spiel implements SpielDebug {
  private z: Spielzustand;
  private anDerBank = false;
  private massMm = 0;
  private saegenFrei = false;
  private kurzText: string | null = null;
  private kurzTimer = 0;
  private hinweisJetzt: string | null = null;
  private modusJetzt: HudModus = 'erkunden';
  private ziel: string | null = null;
  private letzterPick = 0;
  private letzteDebug = 0;
  private griffSchluessel = '';
  private raf = 0;
  private beendet = false;
  private banner: HTMLElement | null = null;
  private readonly aufraeumen: (() => void)[] = [];

  constructor(private readonly o: SpielOptionen) {
    this.z = o.zustand;
    this.bannerZeigen(o.ladeAusgang);
    const beiSichtbarkeit = (): void => {
      if (document.visibilityState === 'hidden') this.sofortSpeichern();
    };
    const beiPagehide = (): void => {
      this.sofortSpeichern();
    };
    document.addEventListener('visibilitychange', beiSichtbarkeit);
    window.addEventListener('pagehide', beiPagehide);
    this.aufraeumen.push(() => {
      document.removeEventListener('visibilitychange', beiSichtbarkeit);
      window.removeEventListener('pagehide', beiPagehide);
    });
    // Neuer Spielstand: sofort einmal schreiben (danach überlebt er Neuladen auch ohne Aktion)
    if (o.ladeAusgang.art === 'neu') this.sofortSpeichern();
    this.darstellen();
    this.raf = requestAnimationFrame(this.tick);
  }

  // ------------------------------------------------------------------ Debug-Schnittstelle

  zustand(): Spielzustand {
    return structuredClone(this.z);
  }

  ui(): ReturnType<SpielDebug['ui']> {
    return {
      anDerBank: this.anDerBank,
      massMm: this.massMm,
      saegenFreigegeben: this.saegenFrei,
      hudModus: this.modusJetzt,
      hinweis: this.hinweisJetzt,
      aktionstaste: this.ziel !== null && !this.anDerBank,
    };
  }

  speicher(): ReturnType<Spielstand['status']> {
    return this.o.spielstand.status();
  }

  text(id: string, wert?: number): string {
    return textFuer(this.o.katalog, id, wert);
  }

  // ------------------------------------------------------------------ Aktionen

  /** Führt eine Aktion im Kern aus; bei Erfolg wird der neue Zustand übernommen und gespeichert. */
  private tun(aktion: Aktion, sofort = false): AktionsErgebnis {
    const r = ausfuehren(this.o.katalog, this.z, aktion);
    if (r.grund === undefined) {
      this.z = r.zustand;
      if (sofort) this.sofortSpeichern();
      else this.o.spielstand.speichern(this.z);
    }
    return r;
  }

  private sofortSpeichern(): void {
    void this.o.spielstand.sofortSpeichern(this.z).then(() => {
      this.debugAktualisieren(true);
    });
  }

  befehl(b: Befehl): void {
    if (this.beendet) return;
    switch (b.art) {
      case 'bewegen':
        if (!this.anDerBank) this.o.view.bewegen(b.vorwaerts, b.seitwaerts);
        return;
      case 'umschauen':
        if (!this.anDerBank) this.o.view.umschauen(b.dxPx, b.dyPx);
        return;
      case 'tippen':
      case 'halten':
        if (this.anDerBank) {
          if (this.z.arbeit?.phase === 'bezugsende') this.bezugsendeTippen(b.xCss, b.yCss);
          return;
        }
        if (WERKBANK_ZIELE.has(this.o.view.pick(b.xCss, b.yCss) ?? '')) this.zurWerkbank();
        return;
      case 'aktion':
        this.aktion(b.id);
        return;
      case 'massband':
        this.massbandVerschieben(b.deltaMm);
        return;
      case 'massbandSetzen':
        if (this.z.arbeit?.phase === 'bezugsende') this.bezugsendeTippen(b.xCss, b.yCss);
        else this.massbandSetzen(b.xCss, b.yCss);
        return;
      case 'blattVersatz': {
        const a = this.z.arbeit;
        if (a?.phase !== 'ansetzen') return;
        this.tun({ art: 'blattVersatzSetzen', mm: a.blattversatz_mm + b.deltaMm });
        this.darstellen();
        return;
      }
      case 'sägezug': {
        const phase = this.z.arbeit?.phase;
        if (phase !== 'ansetzen' && phase !== 'saegen') return;
        if (phase === 'ansetzen' && !this.saegenFrei) return;
        const r = this.tun({ art: 'saegezug', seitenabweichung: b.seitenabweichung, tempo: b.tempo });
        if (r.ereignisse.some((e) => e.art === 'getrennt')) this.sofortSpeichern();
        this.darstellen();
        return;
      }
      case 'stuetzen': {
        const phase = this.z.arbeit?.phase;
        if (phase === 'ansetzen' || phase === 'saegen') this.tun({ art: 'stuetzen', an: b.an });
        return;
      }
    }
  }

  private aktion(id: string): void {
    switch (id) {
      case AKTION_WERKBANK:
        this.zurWerkbank();
        return;
      case AKTIONEN.zurueck:
        this.vonDerBank();
        return;
      case AKTIONEN.anreissen:
        this.anreissen();
        return;
      case AKTIONEN.weiter:
        if (this.z.arbeit?.phase === 'ansetzen') {
          this.saegenFrei = true;
          this.darstellen();
        }
        return;
      case AKTIONEN.abliefern:
        this.abliefern();
        return;
      case AKTIONEN.neuesBrett:
        this.neuesBrett();
        return;
    }
  }

  /** Auftrag annehmen, passendes Stück wählen (oder kaufen) und den Zuschnitt beginnen. */
  private zuschnittVorbereiten(): boolean {
    let auftrag = angenommenerAuftrag(this.z);
    if (!auftrag) {
      const angeboten = this.z.auftraege.find((a) => a.status === 'angeboten');
      if (!angeboten) {
        this.kurz('Gerade kein Auftrag.');
        return false;
      }
      if (this.tun({ art: 'auftragAnnehmen', auftragId: angeboten.id }).grund !== undefined) return false;
      auftrag = angenommenerAuftrag(this.z);
    }
    if (!auftrag) return false;
    let stueck = stueckWaehlen(this.z, bedarfMm(auftrag));
    let meldung: string | null = null;
    if (!stueck) {
      const vorlage = this.o.katalog.auftragVorlagen[auftrag.vorlageId];
      if (!vorlage) return false;
      const r = this.tun({ art: 'materialKaufen', materialId: vorlage.materialId }, true);
      const kauf = r.ereignisse.find((e) => e.art === 'gekauft');
      if (r.grund !== undefined || kauf?.art !== 'gekauft') {
        this.kurz(grundText(r.grund ?? ''));
        return false;
      }
      stueck = werkstueckImLager(this.z, kauf.werkstueckId);
      meldung = kauf.aufAnschreiben
        ? `Neues Fichtenbrett auf Anschreiben (${String(kauf.preis)} G).`
        : `Neues Fichtenbrett gekauft: −${String(kauf.preis)} G.`;
    }
    if (!stueck) return false;
    const r = this.tun({ art: 'zuschnittBeginnen', werkstueckId: stueck.id });
    if (r.grund !== undefined) {
      this.kurz(grundText(r.grund));
      return false;
    }
    this.massMm = 0;
    this.saegenFrei = false;
    if (meldung) this.kurz(meldung, 2600);
    return true;
  }

  private zurWerkbank(): void {
    if (this.anDerBank) return;
    if (!this.z.arbeit && !this.zuschnittVorbereiten()) {
      this.darstellen();
      return;
    }
    this.anDerBank = true;
    this.o.view.bewegen(0, 0);
    this.o.view.arbeitsansicht(true);
    this.griffSchluessel = '';
    this.darstellen();
  }

  private vonDerBank(): void {
    if (!this.anDerBank) return;
    this.anDerBank = false;
    this.o.view.arbeitsansicht(false);
    this.darstellen();
  }

  private bezugsendeTippen(x: number, y: number): void {
    const a = this.z.arbeit;
    const ws = a ? werkstueckImLager(this.z, a.werkstueckId) : undefined;
    if (!a || !ws) return;
    // Vor der Wahl zählt die View ab Ende a (Bezugsende null)
    const mm = this.o.view.bildschirmNachBrettMm(x, y);
    if (mm === null) {
      this.kurz('Tippe direkt auf das Brett, nahe an einem Ende.');
      return;
    }
    const ende = endeAusMm(mm, ws.masse_mm.l);
    this.tun({ art: 'bezugsendeWaehlen', ende });
    this.massMm = 0;
    this.darstellen();
  }

  private massbandVerschieben(deltaMm: number): void {
    const a = this.z.arbeit;
    if (a?.phase !== 'messen' && a?.phase !== 'anreissen') {
      if (a?.phase === 'bezugsende') this.kurz('Zuerst ein Brettende antippen.');
      return;
    }
    const ws = werkstueckImLager(this.z, a.werkstueckId);
    if (!ws) return;
    // Feintasten (−0,5 / +0,5) meinen kürzer/länger. Der Griff meldet Bildschirm-Richtung (rechts = +):
    // misst man vom rechten Ende, wachsen die mm nach links → Vorzeichen umdrehen.
    const ziehtGriff = this.o.hud.element.querySelector('.hud-massband-griff.aktiv') !== null;
    const vorzeichen = ziehtGriff ? this.ziehVorzeichen : 1;
    this.massMm = Math.min(Math.max(aufRaster(this.massMm + deltaMm * vorzeichen), 0), ws.masse_mm.l);
    this.darstellen();
  }

  /** Bildschirm-Richtung, in der die mm auf dem Brett wachsen (+1 = nach rechts); aus der Projektion. */
  private ziehVorzeichen: 1 | -1 = 1;

  private massbandSetzen(x: number, y: number): void {
    const a = this.z.arbeit;
    if (a?.phase !== 'messen' && a?.phase !== 'anreissen') return;
    const mm = this.o.view.bildschirmNachBrettMm(x, y);
    if (mm === null) return;
    this.massMm = aufRaster(mm);
    this.darstellen();
  }

  private anreissen(): void {
    const a = this.z.arbeit;
    if (a?.phase !== 'messen' && a?.phase !== 'anreissen') return;
    const r = this.tun({ art: 'markierungSetzen', mm: this.massMm });
    if (r.grund !== undefined) {
      this.kurz(grundText(r.grund));
      this.darstellen();
      return;
    }
    this.tun({ art: 'anreissen' }, true);
    this.saegenFrei = false;
    this.darstellen();
  }

  private abliefern(): void {
    const r = this.tun({ art: 'abliefern' }, true);
    if (r.grund !== undefined) {
      this.kurz(grundText(r.grund));
      return;
    }
    const e = r.ereignisse.find((x) => x.art === 'abgeliefert');
    const erloes = e?.art === 'abgeliefert' ? e.erloes : 0;
    const getilgt = e?.art === 'abgeliefert' ? e.getilgt : 0;
    this.anDerBank = false;
    this.o.view.arbeitsansicht(false);
    const neu = auftragText(aktuellerAuftrag(this.z));
    this.kurz(
      `Abgeliefert: +${String(erloes - getilgt)} G${getilgt > 0 ? ` (${String(getilgt)} G Schulden getilgt)` : ''}.${neu ? ` Neuer Auftrag: ${neu}` : ''}`,
      4500,
    );
    this.darstellen();
    installHinweisPruefen({ ersterAuftragAbgeliefert: true, ...(this.o.wurzel ? { wurzel: this.o.wurzel } : {}) });
  }

  private neuesBrett(): void {
    if (this.z.arbeit?.phase !== 'ergebnis') return;
    this.tun({ art: 'weiter' }, true);
    if (!this.zuschnittVorbereiten()) {
      this.anDerBank = false;
      this.o.view.arbeitsansicht(false);
    }
    this.darstellen();
  }

  // ------------------------------------------------------------------ Darstellung

  private kurz(text: string, ms = 2400): void {
    this.kurzText = text;
    window.clearTimeout(this.kurzTimer);
    this.kurzTimer = window.setTimeout(() => {
      this.kurzText = null;
      this.hinweisSetzen();
    }, ms);
    this.hinweisSetzen();
  }

  private stueckAufDerBank(): ReturnType<typeof werkstueckImLager> {
    const a = this.z.arbeit;
    if (a) return werkstueckImLager(this.z, a.werkstueckId);
    return stueckWaehlen(this.z, bedarfMm(aktuellerAuftrag(this.z)));
  }

  private hinweisSetzen(): void {
    const text =
      this.kurzText ??
      schrittHinweis(this.z, { anDerBank: this.anDerBank, massMm: this.massMm, saegenFreigegeben: this.saegenFrei, stueck: this.stueckAufDerBank(), zielWerkbank: this.ziel !== null });
    if (text === this.hinweisJetzt) return;
    this.hinweisJetzt = text;
    this.o.hud.hinweis(text);
  }

  /** Zeichnet View und HUD vollständig aus dem Spielzustand (plus den drei lokalen UI-Werten). */
  private darstellen(): void {
    const { view, hud, katalog } = this.o;
    const z = this.z;
    const a = z.arbeit;
    hud.geldAnzeigen(z.inventar.geld - z.inventar.schulden);
    hud.auftragAnzeigen(auftragText(aktuellerAuftrag(z)));

    // ---- Brett
    const saegeDef = a ? katalog.werkzeuge[a.werkzeugId] : undefined;
    const fuge = saegeDef?.werte['fuge_mm'] ?? 1.6;
    const gesamt = saegeDef?.werte['zuege_gesamt'] ?? 8;
    if (a?.ergebnis) {
      const e = a.ergebnis;
      const teil = werkstueckImLager(z, e.teilId);
      const rest = e.restId === null ? undefined : werkstueckImLager(z, e.restId);
      const teilL = teil?.masse_mm.l ?? e.laenge_ist_mm;
      view.brettZeigen(teilL + fuge + (rest?.masse_mm.l ?? 0), a.bezugsende);
      view.schnittErgebnisZeigen(teilL);
      const riss = endrisse(teil);
      const rissBezug = riss.a ?? riss.b;
      view.endrisseZeigen(a.bezugsende === 'b' ? { a: null, b: rissBezug } : { a: rissBezug, b: null });
    } else {
      const ws = this.stueckAufDerBank();
      view.brettZeigen(ws?.masse_mm.l ?? 2000, a?.bezugsende ?? null);
      view.schnittErgebnisZeigen(null);
      view.endrisseZeigen(endrisse(ws));
    }
    const phase = a?.phase ?? null;
    const angerissen = phase === 'ansetzen' || phase === 'saegen' || phase === 'ergebnis';
    view.markierungZeigen(angerissen ? (a?.markierung_mm ?? null) : null);
    const misst = phase === 'messen' || phase === 'anreissen';
    view.massbandZeigen(misst && this.massMm > 0 ? this.massMm : null);
    if (a && (phase === 'ansetzen' || phase === 'saegen')) {
      view.saegeZeigen({ versatzMm: a.blattversatz_mm, tiefe01: Math.min(1, a.zuege.length / gesamt), driftGrad: a.drift_grad });
    } else view.saegeZeigen(null);

    // ---- HUD
    const modus = hudModusFuer(a, this.anDerBank, this.saegenFrei);
    this.modusJetzt = modus;
    hud.modus(modus);
    hud.messwertAnzeigen(misst ? this.massMm : null);
    if (a && phase === 'ansetzen') hud.blattVersatzAnzeigen(a.blattversatz_mm);
    if (a && (phase === 'ansetzen' || phase === 'saegen')) {
      const stuetzen = a.stuetzen;
      const grenze = (saegeDef?.werte['tempo_grenze'] ?? 1) * (stuetzen ? (saegeDef?.werte['stuetz_faktor'] ?? 1) : 1);
      const letzter = a.zuege[a.zuege.length - 1];
      hud.saegeFortschritt(a.zuege.length, gesamt, letzter === undefined || letzter.tempo <= grenze);
    }
    hud.ergebnisKarte(modus === 'ergebnis' ? ergebnisKarte(katalog, z) : null);
    hud.aktionstaste(
      modus === 'erkunden' && this.ziel !== null ? { id: AKTION_WERKBANK, text: a ? 'Weiter­arbeiten' : 'An die Werkbank' } : null,
    );
    this.griffSchluessel = '';
    this.griffAktualisieren();
    this.hinweisSetzen();
  }

  /** Massband-Griff des HUD auf das projizierte Bandende setzen (folgt auch der Kamerafahrt). */
  private griffAktualisieren(): void {
    const a = this.z.arbeit;
    if (!this.anDerBank || (a?.phase !== 'messen' && a?.phase !== 'anreissen')) return;
    const { view, hud } = this.o;
    const p = view.weltNachBildschirm(this.massMm);
    const q = view.weltNachBildschirm(this.massMm + 100);
    if (!p || !q) return;
    this.ziehVorzeichen = q.x < p.x ? -1 : 1;
    const pxProMm = Math.max(0.05, Math.abs(q.x - p.x) / 100);
    const schluessel = `${p.x.toFixed(1)}|${p.y.toFixed(1)}|${pxProMm.toFixed(3)}`;
    if (schluessel === this.griffSchluessel) return;
    this.griffSchluessel = schluessel;
    hud.massbandGriff({ xCss: p.x, yCss: p.y - 30, pxProMm });
  }

  private readonly tick = (jetzt: number): void => {
    if (this.beendet) return;
    this.raf = requestAnimationFrame(this.tick);
    if (this.anDerBank) {
      if (this.o.view.zustand().fahrt) this.griffSchluessel = '';
      this.griffAktualisieren();
    } else if (jetzt - this.letzterPick > 150) {
      // Fadenkreuz: Werkbank anvisiert → Aktionstaste „An die Werkbank“
      this.letzterPick = jetzt;
      const id = this.o.view.pick(window.innerWidth / 2, window.innerHeight / 2);
      const ziel = id !== null && WERKBANK_ZIELE.has(id) ? id : null;
      if (ziel !== this.ziel) {
        this.ziel = ziel;
        this.darstellen();
      }
    }
    if (jetzt - this.letzteDebug > 1000) this.debugAktualisieren(false);
  };

  private debugAktualisieren(sofort: boolean): void {
    const zeile = this.o.debugZeile;
    if (!zeile) return;
    if (!sofort && performance.now() - this.letzteDebug < 1000) return;
    this.letzteDebug = performance.now();
    const s = this.o.spielstand.status();
    const zeit = s.zuletztGespeichert ? s.zuletztGespeichert.slice(11, 19) : '–';
    zeile('speicher', `Speicher: ${s.modus} · persist: ${s.dauerhaft ?? 'offen'} · gespeichert ${zeit}${s.letzterFehler ? ` · Fehler: ${s.letzterFehler}` : ''}`);
  }

  // ------------------------------------------------------------------ Speicher-Hinweis (S7/S8)

  private bannerZeigen(ausgang: LadeAusgang): void {
    const modus = this.o.spielstand.status().modus;
    let text: string | null = null;
    let neuBeginnen = false;
    if (ausgang.art === 'defekt') {
      text = 'Der Spielstand ist beschädigt. Er bleibt als Sicherung erhalten – bis du neu beginnst, wird nicht gespeichert.';
      neuBeginnen = true;
    } else if (ausgang.art === 'lesefehler') {
      text = 'Der Spielstand konnte nicht gelesen werden. Du spielst ohne Speichern.';
      neuBeginnen = true;
    } else if (ausgang.art === 'zuNeu') {
      text = 'Der Spielstand stammt aus einer neueren Version und wird nicht überschrieben. Du spielst ohne Speichern.';
    } else if (modus === 'nurLesend') {
      text = 'Spielstand nur lesend geöffnet (neuere Version) – Fortschritt wird nicht gespeichert.';
    }
    if (text === null) return;
    const wurzel = this.o.wurzel ?? document.body;
    const el = document.createElement('div');
    el.className = 'spiel-speicherhinweis';
    el.setAttribute('role', 'alert');
    Object.assign(el.style, {
      position: 'fixed',
      zIndex: '35',
      left: '50%',
      bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
      transform: 'translateX(-50%)',
      maxWidth: 'min(560px, 70vw)',
      display: 'flex',
      gap: '10px',
      alignItems: 'center',
      padding: '8px 10px 8px 14px',
      font: '15px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: '#f3e9dc',
      background: 'rgb(60 24 18 / 94%)',
      border: '1.5px solid #ff8a7a',
      borderRadius: '12px',
    } satisfies Partial<CSSStyleDeclaration>);
    const p = document.createElement('span');
    p.textContent = `⚠ ${text}`;
    el.append(p);
    if (neuBeginnen) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = 'Neu beginnen';
      Object.assign(b.style, {
        flex: 'none',
        minWidth: '44px',
        minHeight: '44px',
        padding: '0 12px',
        font: 'inherit',
        fontWeight: '600',
        color: '#1f1a15',
        background: '#d9a35b',
        border: 'none',
        borderRadius: '10px',
      } satisfies Partial<CSSStyleDeclaration>);
      b.addEventListener('click', () => {
        void this.o.spielstand.neuBeginnen().then((ok) => {
          if (!ok) return;
          el.remove();
          this.banner = null;
          this.sofortSpeichern();
        });
      });
      el.append(b);
    }
    wurzel.append(el);
    this.banner = el;
  }

  dispose(): void {
    this.beendet = true;
    cancelAnimationFrame(this.raf);
    window.clearTimeout(this.kurzTimer);
    for (const f of this.aufraeumen) f();
    this.banner?.remove();
  }
}
