/**
 * Spielstand-Dienst (Ticket 009, ADR 0003): Laden mit Migration, entprelltes Autosave, sofortiges Speichern
 * bei `visibilitychange`/`pagehide`, Sicherungen, `persist()` – und nie ein stilles Überschreiben.
 *
 * Modi:
 * - `normal`: speichern erlaubt
 * - `nurLesend`: Spielstand enthält einen Abschnitt aus einer neueren Version (S7) – spielen ja, speichern nein
 * - `gesperrt`: Spielstand defekt, zu neu oder nicht lesbar (S7/S8) – speichern erst nach `neuBeginnen()`
 *
 * Fehler der Ablage (S8) werfen nie bis ins Spiel durch: sie landen in `status()` als Hinweis.
 */
import type { ModuleManifest } from '../modul';
import type { ModulId } from '../typen';
import { nachNeuladen, type Spielzustand } from '../zustand';
import type { Ablage } from './ablage';
import { dauerhaftAnfordern, standardSpeicherVerwaltung, type DauerhaftErgebnis, type SpeicherVerwaltung } from './dauerhaft';
import { dateiErstellen, dateiLesen, neueModulAbschnitte, type ModulAbschnitt } from './datei';

export type SpeicherModus = 'normal' | 'nurLesend' | 'gesperrt';

export interface SpeicherStatus {
  modus: SpeicherModus;
  /** Für Spieler/Debug-Overlay, älteste zuerst, ohne Dubletten. */
  hinweise: string[];
  letzterFehler: string | null;
  /** ISO-Zeit des letzten erfolgreichen Schreibens. */
  zuletztGespeichert: string | null;
  /** Ergebnis von `navigator.storage.persist()`; `null` = noch nicht versucht. */
  dauerhaft: DauerhaftErgebnis | null;
  /** Bekannte Module, deren Abschnitt nicht lesbar war (für diesen Spielstand aus). */
  deaktivierteModule: ModulId[];
  /** Ein Stand wartet noch auf das Schreiben. */
  ausstehend: boolean;
}

export type LadeAusgang =
  /** Kein Spielstand: Aufrufer legt `neuerSpielzustand()` an. */
  | { art: 'neu' }
  /** Geladen (und ggf. migriert); `nachNeuladen` ist bereits angewandt. */
  | { art: 'geladen'; zustand: Spielzustand }
  /** Defekt / zu neu / Lesefehler: Spiel startet neu, Speichern gesperrt bis `neuBeginnen()`. */
  | { art: 'defekt' | 'zuNeu' | 'lesefehler'; grund: string };

export interface SpielstandOptionen {
  ablage: Ablage;
  /** Aktive Module (z. B. `katalog.module`). */
  module: readonly ModuleManifest[];
  spielVersion?: string;
  /** Mindestabstand zweier Autosaves (ms), Standard 1000. */
  intervall_ms?: number;
  jetzt?: () => Date;
  speicherVerwaltung?: SpeicherVerwaltung | undefined;
}

const fehlerText = (e: unknown): string => {
  if (e instanceof Error) return e.name === 'QuotaExceededError' ? `Speicher voll (${e.message})` : e.message;
  return String(e);
};

export class Spielstand {
  private readonly ablage: Ablage;
  private readonly module: readonly ModuleManifest[];
  private readonly spielVersion: string;
  private readonly intervall: number;
  private readonly jetzt: () => Date;
  private readonly verwaltung: SpeicherVerwaltung | undefined;

  private modus: SpeicherModus = 'normal';
  private hinweise: string[] = [];
  private letzterFehler: string | null = null;
  private zuletztGespeichert: string | null = null;
  private dauerhaftErgebnis: DauerhaftErgebnis | null = null;
  private deaktiviert: ModulId[] = [];
  private abschnitte: Record<ModulId, ModulAbschnitt>;

  private wartend: Spielzustand | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private letzterStart = Number.NEGATIVE_INFINITY;
  private kette: Promise<boolean> = Promise.resolve(true);
  private persistVersucht = false;

  constructor(o: SpielstandOptionen) {
    this.ablage = o.ablage;
    this.module = o.module;
    this.spielVersion = o.spielVersion ?? 'unbekannt';
    this.intervall = o.intervall_ms ?? 1000;
    this.jetzt = o.jetzt ?? (() => new Date());
    this.verwaltung = 'speicherVerwaltung' in o ? o.speicherVerwaltung : standardSpeicherVerwaltung();
    this.abschnitte = neueModulAbschnitte(o.module);
  }

  status(): SpeicherStatus {
    return {
      modus: this.modus,
      hinweise: [...this.hinweise],
      letzterFehler: this.letzterFehler,
      zuletztGespeichert: this.zuletztGespeichert,
      dauerhaft: this.dauerhaftErgebnis,
      deaktivierteModule: [...this.deaktiviert],
      ausstehend: this.wartend !== null,
    };
  }

  /** Abschnitte aller Module, wie sie beim nächsten Speichern geschrieben werden (inkl. ruhender). */
  modulAbschnitte(): Readonly<Record<ModulId, ModulAbschnitt>> {
    return this.abschnitte;
  }

  private hinweis(text: string): void {
    if (!this.hinweise.includes(text)) this.hinweise.push(text);
  }

  async laden(): Promise<LadeAusgang> {
    let roh: string | undefined;
    try {
      roh = await this.ablage.lesen();
    } catch (e) {
      const grund = `Spielstand nicht lesbar: ${fehlerText(e)}`;
      this.modus = 'gesperrt';
      this.letzterFehler = grund;
      this.hinweis(`${grund}. Spiel läuft ohne Speichern weiter.`);
      return { art: 'lesefehler', grund };
    }

    const e = dateiLesen(roh, this.module);
    if (e.art === 'leer') {
      this.abschnitte = neueModulAbschnitte(this.module);
      return { art: 'neu' };
    }
    if (e.art === 'defekt' || e.art === 'zuNeu') {
      this.modus = 'gesperrt';
      this.hinweis(
        e.art === 'zuNeu'
          ? `Spielstand stammt aus einer neueren Version (${e.grund}). Er wird nicht überschrieben.`
          : `Spielstand defekt (${e.grund}). Er bleibt als Sicherung erhalten.`,
      );
      if (roh !== undefined) await this.sicherungAnlegen('defekt', roh);
      return { art: e.art, grund: e.grund };
    }

    for (const h of e.hinweise) this.hinweis(h);
    this.deaktiviert = e.deaktiviert;
    this.abschnitte = e.module;
    if (e.nurLesend) {
      this.modus = 'nurLesend';
      this.hinweis('Spielstand ist neuer als diese Spielversion: nur lesend, es wird nicht gespeichert.');
    }
    if (e.migriert && roh !== undefined && !(await this.sicherungAnlegen('vor-migration', roh))) {
      // Ohne Rohkopie nie mit migrierten Daten überschreiben.
      this.modus = 'nurLesend';
      this.hinweis('Sicherung vor Migration fehlgeschlagen: nur lesend.');
    }
    return { art: 'geladen', zustand: nachNeuladen(e.zustand) };
  }

  private async sicherungAnlegen(art: 'vor-migration' | 'defekt', roh: string): Promise<boolean> {
    try {
      await this.ablage.sichern(art, roh, this.jetzt().toISOString());
      return true;
    } catch (err) {
      this.letzterFehler = fehlerText(err);
      this.hinweis(`Sicherung (${art}) fehlgeschlagen: ${fehlerText(err)}`);
      return false;
    }
  }

  /**
   * Nach Bestätigung durch den Spieler: Sperre aufheben und neu beginnen. Der alte Stand liegt bereits in
   * `sicherung` bzw. wird jetzt dorthin kopiert. `false`, wenn das nicht gelingt (dann bleibt gesperrt).
   */
  async neuBeginnen(): Promise<boolean> {
    if (this.modus === 'normal') return true;
    let roh: string | undefined;
    try {
      roh = await this.ablage.lesen();
    } catch (e) {
      this.hinweis(`Spielstand weiterhin nicht lesbar: ${fehlerText(e)}`);
      return false;
    }
    if (roh !== undefined && !(await this.sicherungAnlegen('defekt', roh))) return false;
    this.modus = 'normal';
    this.deaktiviert = [];
    this.abschnitte = neueModulAbschnitte(this.module);
    return true;
  }

  /** Entprelltes Autosave: höchstens ein Schreibvorgang je `intervall_ms`, der neueste Stand gewinnt. */
  speichern(zustand: Spielzustand): void {
    if (this.modus !== 'normal') {
      this.hinweis('Speichern ausgesetzt (Spielstand nur lesend oder gesperrt).');
      return;
    }
    this.wartend = zustand;
    if (this.timer !== null) return;
    const warten = Math.max(0, this.letzterStart + this.intervall - this.jetzt().getTime());
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.schreibeWartend();
    }, warten);
  }

  /** Sofort schreiben (für `visibilitychange: hidden` und `pagehide`). `true`, wenn alles geschrieben ist. */
  async sofortSpeichern(zustand?: Spielzustand): Promise<boolean> {
    if (zustand !== undefined) {
      if (this.modus !== 'normal') return false;
      this.wartend = zustand;
    }
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.wartend !== null) return this.schreibeWartend();
    return this.kette;
  }

  private schreibeWartend(): Promise<boolean> {
    const z = this.wartend;
    if (z === null || this.modus !== 'normal') return this.kette;
    this.wartend = null;
    const zeit = this.jetzt();
    this.letzterStart = zeit.getTime();
    let json: string;
    try {
      const datei = dateiErstellen(z, this.abschnitte, { spielVersion: this.spielVersion, gespeichert: zeit.toISOString() });
      json = JSON.stringify(datei);
    } catch (e) {
      this.letzterFehler = fehlerText(e);
      this.hinweis(`Spielstand nicht serialisierbar: ${fehlerText(e)}`);
      return Promise.resolve(false);
    }
    this.kette = this.kette.then(async () => {
      try {
        await this.ablage.schreiben(json, zeit.toISOString());
        this.zuletztGespeichert = zeit.toISOString();
        this.letzterFehler = null;
        if (!this.persistVersucht) {
          this.persistVersucht = true;
          void this.persist();
        }
        return true;
      } catch (e) {
        this.letzterFehler = fehlerText(e);
        this.hinweis(`Speichern fehlgeschlagen: ${fehlerText(e)}. Spiel läuft weiter.`);
        this.wartend ??= z; // beim nächsten Speichern erneut versuchen
        return false;
      }
    });
    return this.kette;
  }

  /** `navigator.storage.persist()` versuchen; Ergebnis auch in `status().dauerhaft`. */
  async persist(): Promise<DauerhaftErgebnis> {
    this.persistVersucht = true;
    this.dauerhaftErgebnis = await dauerhaftAnfordern(this.verwaltung);
    return this.dauerhaftErgebnis;
  }
}
