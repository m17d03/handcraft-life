---
name: architektur-entscheid
description: Erstellt einen Architecture Decision Record (ADR) für Engine-Wahl, Datenmodelle, Speicherformat, Modulvertrag, Budgets oder neue Abhängigkeiten. Verwenden, wenn ein Agent einen Einwand hat oder eine Grundsatzentscheidung ansteht.
---

# Architekturentscheid (ADR)

Agenten dürfen ADRs **vorschlagen** (`status: vorgeschlagen`). Nur der Director setzt
`status: angenommen` oder `abgelehnt`.

Datei: `docs/decisions/NNNN-titel.md` – danach eine Zeile in `docs/DECISION_LOG.md` (Nr. | Datum | Titel | Status | Link).

```markdown
---
adr: NNNN
titel: <Entscheidung als Satz>
status: vorgeschlagen | angenommen | abgelehnt | ersetzt durch NNNN
datum: JJJJ-MM-TT
---

## Problem
Was muss entschieden werden und warum jetzt?

## Optionen
| Option | Vorteile | Nachteile | Messwerte/Belege |
|---|---|---|---|

## Entscheid
<gewählte Option, eine klare Aussage>

## Begründung
Belege zuerst (Messung, Spike, Doku-Link), Meinung zuletzt.

## Folgen
Was wird dadurch einfacher, was schwerer, was muss angepasst werden (Tickets, Code, Projektdokumente)?

## Rückweg
Wie teuer wäre es, die Entscheidung später zu ändern?
```

Regeln:
- Eine Entscheidung pro ADR.
- Wo möglich auf Messungen stützen (Skill `engine-spike`, `perf-budget-check`), nicht auf
  Vergleichstabellen aus dem Netz.
- Nach Annahme: betroffene Tickets und `CLAUDE.md` aktualisieren.
