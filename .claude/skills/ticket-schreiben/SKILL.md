---
name: ticket-schreiben
description: Schreibt ein umsetzbares Ticket mit Scope, Abnahmekriterien und Abhängigkeiten nach docs/tickets/. Verwenden, wenn Arbeit an einen Agenten gegeben werden soll (Rolle Technical Producer).
---

# Ticket schreiben

Datei: `docs/tickets/NNN-kurzer-titel.md` (NNN fortlaufend, dreistellig).

```markdown
---
id: NNN
titel: <Verb + Ergebnis, z. B. "Brett auf Länge sägen – Schnittlogik">
agent: game-designer | engine-engineer | asset-artist | mobile-ux
meilenstein: <M…>
status: open | in_progress | review | done
reifegrad: Konzept | Prototyp | Implementiert | Getestet | Freigegeben
blocked_by: [<ids>]
branch: ticket/NNN
---

## Ziel
Ein bis drei Sätze: was der Spieler danach kann oder was danach technisch existiert.

## Kontext
Links auf Abschnitt der Projektdokumente, Design-Dokument, Entscheidungen in docs/decisions/

## Scope
- Darf ändern: <Pfade>
- Darf nicht ändern: <Pfade, mindestens docs/decisions/, docs/GAME_VISION.md>

## Abnahmekriterien
- [ ] <prüfbar, mit Zahl oder beobachtbarem Verhalten>
- [ ] Tests: <welche>
- [ ] Budget: <relevante Grenzwerte>

## Nicht Teil dieses Tickets
<bewusst ausgeschlossene Punkte>

## Protokoll
<wird bei Abschluss gefüllt>
```

Regeln für gute Tickets:
- Kriterien sind prüfbar: "Schnittlänge weicht höchstens ±1 mm von der Markierung ab, wenn der
  Spieler die Führung nicht verlässt" statt "Sägen fühlt sich gut an".
- Ein Ticket = ein Agent. Braucht es zwei Rollen, teilen.
- Wenn ein Kriterium nur auf echtem iPhone prüfbar ist, markiere es mit `(Gerät)`; es wird im
  Playtest abgehakt, nicht durch QA.
