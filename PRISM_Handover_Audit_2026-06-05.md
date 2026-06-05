# PRISM / PULSE — Handover Due-Diligence & Refactoring-Konzept

**Auditor-Rolle:** Principal/Staff Engineer · Handover-Due-Diligence
**Datum:** 2026-06-05 · **Repo-Stand:** `main` @ `af46bec`
**Scope:** Vorbereitung der Codebase für saubere Übergabe an interne IT (Verständnis, lokales Setup, produktive Weiterentwicklung ohne Vorwissen)
**Modus:** Phase 1 (Audit, read-only) + Phase 2 (Konzept, Planung). **Keine Code-Änderung vorgenommen.**

> Harte Constraints respektiert: Es wurde ausschließlich gelesen. Jede Maßnahme, die Funktionalität, Verhalten oder UI/UX berühren könnte, ist als solche markiert und in „Entscheidungen, die ich von dir brauche" zur Freigabe gestellt.

---

## Executive Summary

Der **Code-Kern ist überraschend solide** (typisierter API-Client, sauberes Rollen-/Auth-Design, getestete Simulations-Engine, gute Fehler-Resilienz), aber das **Repository drumherum ist stark zugewachsen** und in der aktuellen Form **nicht handover-fähig**. Drei Realitäten weichen vom Briefing ab: (1) es ist **Next.js 14.2**, nicht 15; (2) es ist **kein reines Next.js-Projekt**, sondern Full-Stack mit einer großen **Python/FastAPI-Engine** (`pulse/`); (3) eine **komplette Alt-Frontend-App** (`pulse/dashboard/`, Vite) und ein **versehentlich eingecheckter Agent-Worktree** (332 Dateien) liegen noch im Repo.

**Größte Risiken:**
1. **Sicherheit (kritisch, zu verifizieren):** Das alte Custom-Auth-System ist unter `/api/v1/auth/*` weiter **live gemountet** und von der Middleware **öffentlich** gestellt — inkl. hartkodierter Default-Invite-Codes, hartkodierter persönlicher Admin-E-Mails und eines Passwort-Reset-Endpoints, der den Reset-Token im Response zurückgibt. Parallel zu Clerk.
2. **Onboarding (kritisch):** Kein Root-`README`; die `.env.example` listet **die falschen** Variablen — keine einzige der tatsächlich benötigten (Clerk, `DATABASE_URL`, `PRISM_JWT_SECRET`). Ein Dritter kann die App damit **nicht starten**.
3. **Toter Ballast & fehlende Frontend-Tests:** ~232 MB Alt-Frontend, Backup-Komponenten im Prod-Bundle, 0 Tests für 21k Zeilen TS/TSX.

**Top-3-Maßnahmen:** (A) Sicherheits-Entscheidung zum Legacy-`/api/v1/auth/*` treffen und Zugangs-Defaults entschärfen. (B) Risikofreie Löschungen (Alt-Frontend, Worktree, Backups, Logs) + neue `README` + korrekte `.env.example`. (C) Quality-Gates (ESLint/Prettier, `tsc --noEmit`, Frontend-Smoke-Tests) als Sicherheitsnetz vor jeglichem strukturellen Umbau.

**Gesamturteil:** Gelb. Mit ~3–5 fokussierten, risikoarmen Arbeitspaketen erreichbar grün — ohne sichtbare Änderung für Nutzer.

---

## Methodik & Evidenz

Statische Analyse des `main`-Stands: Konfigurations- und Entry-Point-Review (`package.json`, `tsconfig`, `next.config.js`, `vercel.json`, `middleware.ts`), Import-/Nutzungs-Graphen (grep über reale Importe), Git-Tracking-Analyse (`git ls-files`), Secret-Scan über alle getrackten Textdateien, Größen-/LOC-Vermessung, Lesen der sicherheits- und datenfluss-relevanten Module (Auth, Rollen, API-Client, Daten-Hook, FastAPI-App/Auth). Dynamische Tests (npm audit, Build, pytest-Lauf) wurden **nicht** ausgeführt (read-only, kein Install/Netzwerk) — entsprechende Punkte sind als „zu verifizieren" markiert.

## Architektur-Ist (Kurzbild)

```
Browser ──▶ Next.js 14 App Router (app/, components/, hooks/usePrism, lib/, types/)
                │  Auth: Clerk (Identity) + lib/roles.ts (Authz via Neon/Postgres)
                │  fetch('/api/v1/*')
                ▼
        vercel.json rewrite ──▶ api/index.py ──▶ pulse/ (FastAPI Engine)
                                                   Simulation (Bayes-MC, CVaR, Sobol …),
                                                   Delphi, Analytics, eigene Custom-Auth
        Bridge: lib/prismJwt.ts mintet PRISM-JWT (PRISM_JWT_SECRET) → Python require_admin
```

Im **Dev**-Betrieb laufen zwei Prozesse (Next :3000 + FastAPI :8000, Proxy via `next.config.js`). In **Prod** (Vercel) ist die Python-App eine Serverless-Function hinter dem Rewrite. **Das ist der eigentliche Stack — die IT muss Node *und* Python betreiben.**

## Stärken (explizit festgehalten)

- **`api/client.ts`** ist vollständig typisiert („Zero `any`"), zentralisiert alle Requests, sauberer `ApiError`.
- **`lib/roles.ts`** ist ein klares, gut dokumentiertes Authz-Modell (Clerk = Identity, Postgres = Rolle; bewusste Designbegründung im Code).
- **Secret-Hygiene am Code:** Secret-Scan über alle getrackten Textdateien ist **sauber** — keine hartkodierten Live-Keys; `.gitignore` deckt `.env*`, `dist*`, `*.db`, Deploy-Token, `*.py.bak.*` korrekt ab.
- **Resilienz:** `api/index.py` mit Cold-Start-Retry + Degraded-Fallback; Frontend mit `ErrorBoundary` + Reconnect-Logik im `usePrism`.
- **Engine getestet:** 12 pytest-Dateien inkl. Property-Tests (Hypothesis) für die Simulationskerne; Monte-Carlo sauber über `np.random.default_rng(seed)` mit deterministisch abgeleiteten Chain-Seeds.
- **Saubere Deprecation-Praxis:** Alte Auth-Seiten/-Routen liefern bewusst `410 Gone` bzw. redirecten auf `/sign-in` statt stiller 404.


---

# Phase 1 — Audit (Befunde mit Schweregrad)

Schweregrade: **🔴 Kritisch · 🟠 Hoch · 🟡 Mittel · ⚪ Niedrig**. Jeder Befund mit Evidenz, Wirkung und Empfehlung. „Verhaltens-/UI-sensibel" = darf laut Constraints **nicht** ohne Freigabe geändert werden.

## Übersicht

| ID | Schwere | Kategorie | Befund (Kurz) |
|----|---------|-----------|----------------|
| K1 | 🔴 | Security | Legacy-Custom-Auth `/api/v1/auth/*` live & öffentlich, Default-Codes/Admin-Mails hartkodiert, Reset-Token im Response |
| K2 | 🔴 | Onboarding/Build | `.env.example` listet falsche Variablen — App nicht startbar |
| H1 | 🟠 | Repo-Integrität | Eingecheckter Agent-Worktree `.claude/worktrees/…` (332 Dateien) |
| H2 | 🟠 | Onboarding | Kein Root-`README`; ~60 verstreute Docs, 22 Doppelungen, kein Index |
| H3 | 🟠 | Toter Code | Komplettes Alt-Frontend `pulse/dashboard/` (Vite, 232 MB, 5× `dist-*`) |
| H4 | 🟠 | Tests | 0 automatisierte Tests fürs Frontend (21k LOC); kein `test`-Script |
| M1 | 🟡 | Toter Code | `hooks/usePulse.ts` (283 L) — Zwilling von `usePrism`, nirgends importiert |
| M2 | 🟡 | Toter Code (Bundle) | `ProfitPoolAnalysis2Backup.tsx` (1.545 L) als `hidden`-Tab im Prod-Bundle |
| M3 | 🟡 | Stray Assets | `archive/`, `*.bak`, `pulse_server.log`, Root-`*.xlsx`, Lock-/Temp-Dateien |
| M4 | 🟡 | Komplexität | God-Files: `app.py` 2.268 L; `ConsumerJourney2` 2.518 L; `Trends2` 1.825 L … |
| M5 | 🟡 | Konsistenz/Drift | Tote `adminOnly`-Logik; veraltete Header-Kommentare; Doku-Drift |
| M6 | 🟡 | Security/Config | Hartkodierte Default-Zugangscodes & persönliche Admin-Mails |
| M7 | 🟡 | Type Safety | 26× `any` (Cluster `DelphiPanel`); `tsconfig target: es5` |
| N1 | ⚪ | Logging | 21× `console.*` im Live-Code, keine Logger-Abstraktion |
| N2 | ⚪ | Dokumentation | Briefing-Prämisse „Next.js 15" falsch (real 14.2.35) |
| N3 | ⚪ | Build-Repro | Build hängt am Netzwerk (`download-images.mjs` → Unsplash) |
| N4 | ⚪ | Security | Selbstgebautes JWT in Python (keine `alg`-Prüfung beim Verify) |
| N5 | ⚪ | Performance | `data/innovations.ts` (212 KB) + `mockData.ts` im Client-Bundle (Beta) |
| N6 | ⚪ | Ops-Sprawl | Mehrere Deploy-Skripte, 2× `tsconfig`, Migrationsskripte unklar kanonisch |

---

## 🔴 K1 — Legacy-Custom-Auth ist live, öffentlich und unsicher konfiguriert
**Kategorie:** Security · API-Routen · Auth — **verhaltens-/sicherheits-sensibel**

**Evidenz:**
- `pulse/api/routes/auth.py` definiert `POST /auth/register`, `/auth/login`, `/auth/request-reset`, `/auth/confirm-reset`, `/auth/reset-password`, `GET/PUT/DELETE /auth/users…`.
- `pulse/api/app.py:521` → `app.include_router(auth_router, prefix="/api/v1")` → erreichbar als `/api/v1/auth/*`.
- `middleware.ts` setzt `'/api/v1/(.*)'` als **public route** (kein Clerk-Gate).
- `pulse/api/auth.py`: `INVITE_CODES` Default = `PRISM-2026,HENKEL-STRATEGY,PROFITPOOLSHIFTMODEL-ACCESS,PRISM2026`; `ADMIN_EMAILS` Default = **persönliche E-Mails des Eigentümers** (gmail/gmx) → Auto-Admin bei Registrierung.
- `request_password_reset()` gibt bei deaktiviertem E-Mail-Versand `"reset_token": <gültiger JWT>` **im HTTP-Response** zurück (Kommentar: „acceptable for pre-production").

**Wirkung:** Parallel zu Clerk existiert ein zweites, selbstbedienbares Auth-System. Wer `/api/v1/auth/*` erreicht (öffentlich) und einen Default-Invite-Code kennt, kann einen **PRISM-JWT** erhalten — genau das Token, das die Python-`require_admin`-Gate akzeptiert. Damit ist ein **Clerk-Bypass für mutierende Engine-Endpoints** denkbar. Zusätzlich erlaubt der Reset-Pfad die **Herausgabe eines Reset-Tokens** für bekannte Alt-User. Die Clerk-basierte UI ist davon unberührt; betroffen ist die Engine-API-Ebene.

**Empfehlung:** Schicksal des Legacy-Auth entscheiden (entfernen **oder** in Prod hart deaktivieren/env-gaten), Reset-Token-Rückgabe entfernen, Default-Codes/Mails auf „env-only, kein Default" umstellen. **Keine Änderung ohne deine Freigabe** (siehe Entscheidungen #3/#7). Vorab in der Live-Umgebung verifizieren, ob `/api/v1/auth/register` extern antwortet.

## 🔴 K2 — `.env.example` ist falsch → App nicht startbar
**Kategorie:** Onboarding · Build · Reproduzierbarkeit

**Evidenz:** `.env.example` listet nur `BEAUTYFEEDS_API_KEY`, `OPENALEX_API_KEY`, `NEWSAPI_API_KEY`, `ANTHROPIC_API_KEY`, `AZURE_OPENAI_*`. Der **tatsächliche** Variablen-Bedarf (aus dem Code extrahiert) ist ein anderer:
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`, `DATABASE_URL`/`POSTGRES_URL`, `PRISM_JWT_SECRET`, `BACKEND_URL`/`PRISM_BACKEND_URL`, `NEXT_PUBLIC_SIGNUP_CODE`, `ADMIN_BOOTSTRAP_SECRET`, `PRISM_ADMIN_EMAILS`, `RESEND_API_KEY`/`RESEND_FROM_EMAIL`, `PRISM_DB_PATH`, `CORS_ORIGINS`, `PRISM_APP_URL`.

**Wirkung:** Ein neuer Entwickler, der dem Standard-Pfad „`.env.example` → `.env`" folgt, bekommt eine **nicht lauffähige** App und keine der real benötigten Keys. Direkter Widerspruch zum Ziel „in unter einem Tag aufsetzen".

**Empfehlung:** `.env.example` aus dem realen Inventar neu schreiben (Werte leer/Platzhalter), gruppiert nach Frontend/DB/Bridge/Backend, mit Kurzkommentar je Variable. Rein additiv, **verhaltensneutral**.

## 🟠 H1 — Eingecheckter Agent-Worktree (332 Dateien)
**Evidenz:** `git ls-files .claude/worktrees/agent-ac4169a7` → **332** getrackte Dateien (~25 MB), die `app/`, `components/`, `hooks/`, sogar eine im Live-Stand **entfernte** `WarRoom.tsx` duplizieren. **Wirkung:** verfälscht jede Volltextsuche/grep (Doppeltreffer), bläht Clone/Review auf, transportiert Entwicklungs-Altstände nach außen. **Empfehlung:** entfernen + `.claude/worktrees/` in `.gitignore`. Verhaltensneutral (nicht Teil des Builds).

## 🟠 H2 — Kein README, Doku-Wildwuchs ohne Index
**Evidenz:** Kein Root-`README.md`. **31** Root-`*.md` + **29** `DOCUMENTATION/*.md`, davon **22 byte-identische Doppelungen**; dazu Dutzende `.docx/.pptx/.pdf` (Decks, Audits, Methodendoku) im Repo-Root. De-facto-Handbuch ist `CLAUDE.md` (54 KB) — aber kein Einstiegspunkt. **Wirkung:** Ein Dritter findet „das eine" Setup-Dokument nicht; Quelle der Wahrheit unklar. **Empfehlung:** ein knappes Root-`README` (Architektur, Setup, Scripts, Env) + Konsolidierung nach `/docs` mit Index; Decks aus dem Code-Repo herauslösen.

## 🟠 H3 — Komplettes Alt-Frontend `pulse/dashboard/`
**Evidenz:** Separate Vite-React-App (72 getrackte Quelldateien) inkl. eigenem `usePulse`, `AuthPage`, `AdminUsersPanel`; auf Platte **232 MB** (eigenes `node_modules`) mit **fünf** Build-Ordnern `dist, dist-deploy, dist-new, dist-v2, dist-v3`. Vollständig durch Next.js `app/` ersetzt; nicht im `vercel.json`-Build. **Wirkung:** massiver toter Ballast, doppelte Komponentennamen, Verwirrung „welches Frontend gilt?". **Empfehlung:** nach Bestätigung (Entscheidung #2) entfernen. Verhaltensneutral fürs Prod-Frontend.

## 🟠 H4 — Keine Frontend-Tests
**Evidenz:** Alle 12 Testdateien (`tests/`) sind **pytest** für die Engine (bayes_mc, cvar, sobol, tipping_points, reverse_stress, optimizer, api, scanner, properties). **Null** Tests für `app/`, `components/` (21k+ LOC TSX), `hooks/usePrism`, die Next-API-Routen. `package.json` hat kein `test`-Script. **Wirkung:** Genau die Schicht, die am häufigsten geändert wird (UI/Datenfluss), ist für einen Dritten unverifizierbar — riskant für „weiterentwickeln ohne Vorwissen". **Empfehlung:** schlankes Sicherheitsnetz (RTL-Smoke-Tests für Dashboard-Shell + `usePrism`-Reducer/States), `test`/`typecheck`-Scripts. Additiv, verhaltensneutral.

## 🟡 M1 — `hooks/usePulse.ts` ist toter Zwilling
**Evidenz:** `usePulse.ts` (283 L) ist die PULSE-benamste Kopie von `usePrism.ts` (live). Live-Importe nur über `usePrism` (4 Komponenten). `usePulse` wird ausschließlich vom Alt-Frontend und dem eingecheckten Worktree referenziert, **nirgends im Next-Build**. Enthält zusätzlich einen `generateMockSimulation()`-Mock-Generator. **Empfehlung:** mit H1/H3 entfernen. Verhaltensneutral.

## 🟡 M2 — Backup-Komponente im Produktions-Bundle
**Evidenz:** `app/dashboard/page.tsx` importiert `ProfitPoolAnalysis2Backup` (1.545 L, ~Duplikat der 1.716-L-Live-Version) und rendert sie als Tab mit `hidden: true`. Kommentar im Code: „useful for keeping a working backup page out of sight without deleting the code." **Wirkung:** ~1.500 L Toter Code werden kompiliert & ausgeliefert (Bundle-Größe), obwohl in der UI unerreichbar. **Empfehlung:** Tab + Datei entfernen — **UI-Render-sensibel** (kein sichtbarer Unterschied, aber berührt den Dashboard-Render-Tree → Freigabe #5).

## 🟡 M3 — Stray Assets / Artefakte im Repo
**Evidenz (getrackt oder auf Platte):** `archive/InnovationExplorer.tsx` (20 KB, getrackt); auskommentierter `scanner_router` in `app.py`; `pulse/seed_trends.py.bak.*` (3×, gitignored, auf Platte); **getrackte** `pulse_server.log`; Root-Build-Artefakte `shift_matrix_*.xlsx`, `fresh_prod.xlsx`; LibreOffice-Lock `.~lock.Attenuation_Calibration.xlsx#`; Office-Temp `~$ISM_Methodology_Documentation.docx`; `_tmp_slide_preview.jpg`; `DEPLOY_TOKEN_HIER_EINFUEGEN.txt` (gitignored, auf Platte). **Empfehlung:** entfernen / aus Tracking nehmen; `pulse_server.log` zusätzlich in `.gitignore`. Verhaltensneutral.

## 🟡 M4 — God-Files (Wartbarkeit)
**Evidenz:** `pulse/api/app.py` **2.268 L** (30 Routen + Modelle + Logik in einer Datei). Frontend-Monolithen: `ConsumerJourney2.tsx` 2.518 L, `Trends2.tsx` 1.825 L, `ProfitPoolAnalysis2.tsx` 1.716 L, `DelphiPanel.tsx` 1.453 L, `SettingsModal.tsx` 1.357 L, `CategoryDetailPanel.tsx` 1.260 L. **Wirkung:** hohe Einarbeitungslast, schweres Code-Review, Merge-Konflikt-anfällig. **Empfehlung:** später, rein strukturell, hinter Tests (Phase-2-Schritt 6). **Nicht** zum Handover-Start nötig.

## 🟡 M5 — Konsistenz & Doku-Drift im Code
**Evidenz:** `app/dashboard/page.tsx` berechnet `role`/`isAdmin` via `/api/me`, doch der Filter nutzt `adminOnly`, das **kein Tab mehr setzt** (Kommentar: „no longer used") → tote Gating-Logik + überflüssiger Request je Load. Header-Kommentar oben behauptet „Profit Pool Explorer tab is admin-gated" — Code sagt das Gegenteil. `usePrism.ts`-Header verspricht „graceful fallback to mock data" — **kein** Mock-Fallback im Live-Hook vorhanden (Erbe aus `usePulse`). **Empfehlung:** Kommentare/tote Zweige bereinigen — kleinteilig, **Logik-sensibel** (Entfernen des `/api/me`-Calls beobachtbar → in Schritt mit Tests).

## 🟡 M6 — Hartkodierte Zugangs-Defaults & persönliche Daten
**Evidenz:** Clerk-Signup-Gate Default `'HCB2026'` (`NEXT_PUBLIC_SIGNUP_CODE`), Python `ACCESS_KEYWORD='PRISM2026'`, Invite-Code-Set, **persönliche Admin-E-Mails** als Default in `pulse/api/auth.py`. **Wirkung:** Für einen Dritt-Eigentümer sind Zugang/Admin in den Quellcode „eingebrannt"; PII im Repo. **Empfehlung:** auf env-only ohne Default umstellen (überschneidet sich mit K1) — **sicherheits-/verhaltens-sensibel**, Freigabe #7.

## 🟡 M7 — Type Safety
**Evidenz:** 26× `: any`/`as any` im Live-Code, ~Hälfte in `DelphiPanel.tsx` (`onSubmit:(data:any)`, `scores?:any[]`, `as any`-Casts auf API-Payloads); Chart-Payload-Casts in `ForceWaterfall`, `HeadlineKPI`, `ReverseStressPanel`. Positiv: **0** `@ts-ignore`, **0** TODO/FIXME, `strict:true`. `tsconfig` hat `target:"es5"` — anachronistisch für Node 22/Next 14 (größerer/langsamerer Output). **Empfehlung:** `any`-Hotspots in `DelphiPanel` typisieren (Engine-Typen existieren in `types/`); `target` auf `es2017+` heben (verifizieren: identisches Laufzeitverhalten). Schrittweise, mit `tsc`-Gate.

## ⚪ N1–N6 (Niedrig)
- **N1 Logging:** 21× `console.*` im Live-Code; keine Logger-Abstraktion. Vor Handover vereinheitlichen.
- **N2 Versions-Prämisse:** Deklariert/installiert ist **Next 14.2.35**, React 18.3 — nicht „Next.js 15". Briefing/Doku korrigieren.
- **N3 Build-Repro:** `vercel.json` `buildCommand` ruft `scripts/download-images.mjs` (Unsplash-API) vor `next build`. Degradiert sauber auf Platzhalter ohne `UNSPLASH_ACCESS_KEY` und cached — aber erster Clean-Build ist netzabhängig. Dokumentieren oder Bilder vorab committen.
- **N4 Krypto:** Selbstgebautes JWT in `pulse/api/auth.py` (HMAC-SHA256, Constant-Time-Compare, exp-Check) — ok wie genutzt, aber `alg` wird beim Verify nicht geprüft; perspektivisch `PyJWT`.
- **N5 Bundle:** `data/innovations.ts` (212 KB) + `data/mockData.ts` (29 KB) werden von den **Beta**-Innovation-Views statisch importiert → große Client-Payloads (nur Beta-Pfad).
- **N6 Ops-Sprawl:** `deploy.sh`, `deploy_v3_5.sh`, `deploy_consumer_journey_readout.sh`, `deploy_horizon_trim.sh`, `deploy_prism_overrides.sh`, `scripts/cowork-deploy.sh`, `scripts/migrate_prod_to_v3_*`; 2× `tsconfig`. Kanonischen Deploy-/Migrationspfad definieren, Rest archivieren.

---

# Phase 2 — Refactoring-Konzept (Planung, keine Umsetzung)

Leitprinzip: **maximale Aufräum-Wirkung bei minimalem Verhaltens-Risiko.** Erst Sicherheitsnetz, dann risikofreie Löschungen, dann Doku/Config, dann (nur nach Freigabe) sicherheits- und verhaltensnahe Eingriffe; struktureller Umbau ganz zuletzt. Strangler-Logik dort, wo Altes neben Neuem lebt (Auth).

## Soll-Architektur (Zielbild)

Die Laufzeit-Architektur ist tragfähig — Ziel ist **Lesbarkeit & klare Grenzen**, nicht Umbau:

```
/                     Root: README, package.json, Configs, .env.example (korrekt)
├─ app/               Next.js App Router (Seiten + Next-API-Routen = BFF/Bridge)
├─ components/        UI (dashboard/, dashboard/analytics/)
├─ hooks/             usePrism (einziger Daten-Hook)
├─ lib/               ── server/  (roles, db, users, auth, prismJwt)  ← serverseitig
│                     └─ shared/  (format)                            ← isomorph
├─ types/             Geteilte TS-Typen
├─ api/               Vercel-Python-Adapter (index.py)
├─ pulse/             FastAPI-Engine
│                     └─ api/  app.py → in Router aufgeteilt (trends/sim/config/…)
├─ tests/             pytest (Engine) + neu: frontend/ (RTL-Smoke)
├─ scripts/           genau die kanonischen Build-/Migrationsskripte
└─ docs/              EIN konsolidierter Doku-Satz + Index (Decks ausgelagert)
```

Entfällt: `pulse/dashboard/` (Alt-Frontend), `.claude/worktrees/` (Worktree), `archive/`, Backup-/Log-/Artefakt-Dateien, `usePulse.ts`. **`/lib`-Isolation:** aktuell mischt `lib/` serverseitige Module (DB/Auth/Rollen) mit isomorphen (`format`); Untergliederung `lib/server` vs. `lib/shared` macht Server-Only-Grenzen explizit (rein organisatorisch, keine Logikänderung).

## Migrationsplan (inkrementell, priorisiert)

Jeder Schritt eigenständig mergebar und einzeln zurückrollbar. Aufwand grob: **S**=Stunden, **M**=≤1 Tag, **L**=mehrere Tage.

### Schritt 0 — Sicherheitsnetz etablieren *(zuerst, blockiert nichts)*
- **Was:** `tsc --noEmit` (via `tsconfig.check.json`) + `next build` + `pytest` als reproduzierbarer Baseline-Lauf; 4–6 Referenz-Screenshots der Hauptviews (Trends, Consumer Journey, Profit Pool, Innovation) als visuelle Baseline; `test`/`typecheck`-Scripts ergänzen.
- **Warum:** Beweisgrundlage für „kein sichtbarer/verhaltensseitiger Unterschied" nach jedem Folgeschritt.
- **Dateien:** `package.json` (Scripts), neue `tests/frontend/` (1–2 Smoke-Tests), CI-Workflow optional.
- **Risiko:** keins (additiv). **Aufwand:** M. **Constraint:** unkritisch.

### Schritt 1 — Risikofreie Löschungen *(kein Laufzeit-Impact)*
- **Was:** `.claude/worktrees/` (H1), `pulse/dashboard/` (H3, nach #2), `archive/` (M3), `hooks/usePulse.ts` (M1), `*.py.bak.*`, `pulse_server.log`, Root-`*.xlsx`/Lock-/Temp-/`_tmp_*`-Dateien (M3); `.gitignore` um `pulse_server.log`, `.claude/worktrees/` ergänzen.
- **Warum:** entfernt ~250 MB Ballast + Such-Rauschen ohne Build-Bezug.
- **Verifikation pro Löschung:** `grep` auf Importe = 0, danach `tsc` + `next build` grün.
- **Risiko:** sehr niedrig. **Aufwand:** S–M. **Constraint:** verhaltensneutral.

### Schritt 2 — Onboarding herstellen
- **Was:** Root-`README.md` (Architektur-Diagramm, Prereqs Node+Python, Setup in nummerierten Schritten, Scripts, Env-Tabelle, Deploy); **`.env.example` aus realem Inventar neu** (K2); Doku nach `/docs` konsolidieren, 22 Doppelungen entfernen, Decks (`.pptx/.pdf/.docx`) aus dem Code-Repo lösen (#6).
- **Warum:** erfüllt das Kernziel „Dritter setzt in < 1 Tag auf".
- **Dateien:** neu `README.md`, überarbeitet `.env.example`, `/docs/*`.
- **Risiko:** keins (Doku/Beispiel). **Aufwand:** M. **Constraint:** verhaltensneutral.

### Schritt 3 — Quality-Gates
- **Was:** ESLint- + Prettier-Config, die den **bestehenden** Stil abbildet (keine Massen-Reformatierung im selben PR); `target: es5 → es2017+` (verifizieren); `any`-Hotspots in `DelphiPanel` typisieren; `console.*` → schlanke Logger-Hilfe.
- **Warum:** durchsetzbare Qualität für den neuen Owner; kleinere/schnellere Builds.
- **Risiko:** niedrig (Type-/Lint-Gate fängt Regressions). **Aufwand:** M. **Constraint:** `target`-Bump ist Build-nah → mit Baseline-Diff prüfen.

### Schritt 4 — Toter, aber gebundelter Code *(Freigabe nötig)*
- **Was:** `ProfitPoolAnalysis2Backup`-Tab + Datei entfernen (M2); tote `adminOnly`-Logik + ggf. `/api/me`-Load im Dashboard bereinigen (M5).
- **Warum:** entfernt ~1,5k L aus dem Bundle + irreführende tote Logik.
- **Risiko:** niedrig, aber berührt den Dashboard-Render-Tree → **UI-/Verhaltens-sensibel**. Mit Screenshot-Diff + Tests absichern. **Aufwand:** S–M. **Constraint:** Freigabe #5.

### Schritt 5 — Security-Bereinigung Legacy-Auth *(Freigabe nötig, Strangler)*
- **Was:** Nach Entscheidung (#3/#7): entweder `auth_router`-Include + `routes/auth.py` + `pulse/api/auth.py` + tote `app/api/auth/*`-Stubs + Legacy-Seiten entfernen — **oder** `/api/v1/auth/*` in Prod hart deaktivieren/env-gaten; Reset-Token-Rückgabe streichen; Default-Codes/Mails auf env-only.
- **Warum:** schließt den potenziellen Clerk-Bypass + Token-Disclosure; entfernt PII.
- **Risiko:** mittel — Auth ist verhaltenskritisch. Strangler: zuerst Telemetrie/Zugriffslog auf die Alt-Routen, bestätigen „0 legitime Nutzung", dann deaktivieren, dann löschen. **Aufwand:** M. **Constraint:** Freigabe #3/#7.

### Schritt 6 — Strukturelle Entflechtung *(optional, zuletzt)*
- **Was:** `pulse/api/app.py` (2.268 L) in fachliche Router splitten (trends/simulate/config/forces/export); größte TSX-Monolithen in Sub-Komponenten zerlegen; `lib/server` vs. `lib/shared`.
- **Warum:** langfristige Wartbarkeit. **Rein strukturell, keine Logikänderung.**
- **Risiko:** mittel (viel Bewegung) → erst mit Test-Netz aus Schritt 0/3, ein Modul pro PR. **Aufwand:** L. **Constraint:** nur falls gewünscht; nicht handover-blockierend.

## Risikoanalyse — Was könnte Verhalten/UI brechen, und wie verhindern wir es?

| Risiko | Wo | Gegenmaßnahme |
|--------|----|----------------|
| Versehentliches Löschen von noch genutztem Code | Schritt 1 | Import-grep = 0 **vor** Löschung; `tsc` + `next build` grün **nach** jeder Löschung |
| Sichtbare UI-Änderung durch Bundle-/Render-Eingriff | Schritt 4 (Backup-Tab), Schritt 3 (`target`) | Referenz-Screenshots (Schritt 0) vor/nach vergleichen; ein Eingriff pro PR |
| Auth-Regression / Aussperren von Nutzern | Schritt 5 | Strangler: erst loggen/messen, dann deaktivieren, dann löschen; Clerk-Pfad bleibt unberührt |
| „Unsichtbare" Verhaltensänderung (z. B. `/api/me`-Entfall) | Schritt 4/5 | Smoke-Test auf Rollen-/Tab-Sichtbarkeit; in eigenem PR |
| Build-Bruch durch Netz-Abhängigkeit | jederzeit | `download-images.mjs`-Fallback dokumentiert; Bilder optional vorab committen (N3) |
| Engine-Seed-/Determinismus-Annahme falsch | keine Code-Änderung geplant | Verhalten **unangetastet** bis Entscheidung #4 |

**Querschnittsregel:** Jeder PR durchläuft `typecheck` + `build` + `pytest`; sichtbare Views werden per Screenshot-Diff geprüft. Kein Schritt bündelt Aufräumen mit Reformatierung. Reihenfolge strikt 0 → 1 → 2 → 3 → (4/5 nach Freigabe) → 6.

---

# Entscheidungen, die ich von dir brauche

Bevor Phase 3 (Umsetzung) startet, brauche ich Klärung zu folgenden Punkten. Schritte 0–3 (Sicherheitsnetz, risikofreie Löschungen außer `pulse/dashboard`, Doku, Quality-Gates) kann ich nach deinem „Go" beginnen; 4–6 hängen an den markierten Entscheidungen.

1. **Scope der Übergabe.** Soll die **Python/FastAPI-Engine (`pulse/`)** mit übergeben & weiterentwickelt werden, oder nur das Next.js-Frontend? (Das Briefing sagt „Next.js 15"; real ist es Full-Stack + Python-Engine, und die IT muss Node *und* Python betreiben.)

2. **`pulse/dashboard/` (Alt-Vite-Frontend).** Bestätigst du, dass es vollständig stillgelegt ist und gelöscht werden darf? (Sieht zu 100 % tot aus, aber Löschen von 232 MB will ich abgesichert wissen.)

3. **Legacy-`/api/v1/auth/*` (Custom-Auth).** Komplett **entfernen** oder in Prod **deaktiviert/env-gegatet behalten**? Das ist sicherheitsrelevant (möglicher Clerk-Bypass + Reset-Token-Disclosure) und verhaltensnah — ich ändere hier nichts ohne deine Freigabe. *(Empfehlung: entfernen, sofern keine externen Clients diese Endpoints nutzen.)*

4. **Monte-Carlo-Seed = 42 (fix).** Gewollte Reproduzierbarkeit (so lassen) oder sollen Läufe variieren? Verhalten der Engine — ich fasse es bis zu deiner Antwort **nicht** an. *(Hinweis: aktueller Code ist sauber & deterministisch; „identische Ergebnisse pro Lauf" ist Feature, nicht Bug — sofern beabsichtigt.)*

5. **`ProfitPoolAnalysis2Backup` (versteckter Tab).** Darf die Backup-Datei + der `hidden`-Tab gelöscht werden? Kein sichtbarer UI-Unterschied, aber es berührt den Dashboard-Render-Tree → ich will dein OK.

6. **Dokumente/Decks.** Welche der ~60 `.md/.docx/.pptx/.pdf` sind **kanonisch** und bleiben im Repo, welche dürfen nach `/docs` konsolidiert bzw. aus dem Code-Repo ausgelagert werden? (Ich schlage vor: nur technische Docs im Repo, Strategie-Decks separat.)

7. **Hartkodierte Zugangs-Defaults & persönliche Admin-Mails.** Darf ich Signup-Code, `ACCESS_KEYWORD`, Invite-Codes und Admin-E-Mails auf **env-only ohne Default** umstellen? Ändert, wer sich registrieren/Admin werden kann → Sign-off nötig.

8. **Ziel-Infrastruktur der IT.** Gibt es Vorgaben (bleibt es Vercel? darf Python-Serverless laufen? Node-/Runtime-Version)? Das beeinflusst, wie „reproduzierbares Setup" für den neuen Owner aussehen muss.

**Offene Verifikationen (kann ich auf Wunsch nachziehen):** `npm audit` (Dependency-CVEs, war read-only nicht ausgeführt), Live-Check ob `/api/v1/auth/register` extern antwortet, sowie ein echter `next build`-Lauf zur Bundle-Baseline.

---

*Erstellt im Read-only-Audit-Modus. Es wurde keine Datei der Codebase verändert. Nächster Schritt: deine Antworten zu 1–8, dann beginne ich mit Schritt 0–2 des Migrationsplans.*

---

# Anhang — Umsetzungs-Log (Phase 3, Schritte 0–2 + freigegebene Eingriffe)

**Durchgeführt am 2026-06-05 nach Freigabe.** Alle Schritte einzeln committet und per `tsc --noEmit` (und Python `py_compile`) verifiziert; Produktions-Build kompiliert erfolgreich (Prerender-Fehler in der Sandbox ausschließlich wegen fehlendem Clerk-Key — umgebungsbedingt).

| Commit | Inhalt |
|--------|--------|
| `dbc3f99` | Snapshot des Arbeitsstands (nur Modifikationen; lokale Bild-Löschungen bewusst NICHT committet) |
| `e62b7d1` | Toter Ballast entfernt: Alt-Frontend `pulse/dashboard/`, Agent-Worktree `.claude/worktrees/` (332 Dateien), `archive/`, `usePulse.ts`, Logs, Backups, Temp-/Lock-Dateien, verwaister Vite-Build in `public/` — **760 → 352 getrackte Dateien** |
| `b8335a6` | Versteckter Backup-Tab + `ProfitPoolAnalysis2Backup.tsx` entfernt (UI unverändert) |
| `7bad5e8` | Legacy-Auth entfernt: `/api/v1/auth/*`-Router weg, `pulse/api/auth.py` auf JWT-Verify reduziert (656 → 140 Zeilen; **hartkodierte Invite-Codes & persönliche Admin-Mails eliminiert** → K1/M6 adressiert), Next-410-Stubs + tote `lib/auth.ts`/`lib/users.ts` weg |
| `a6f952c` | Root-`README.md` (Architektur, Setup, Env-Referenz) + korrekte `.env.example` → K2/H2 adressiert |
| `eb7b391` | Korrektur: in `7bad5e8` versehentlich mit-committete lokale Bild-Löschungen wiederhergestellt; lokale Decks/One-off-Skripte/Buildinfo wieder enttrackt (bleiben auf Platte); `*.tsbuildinfo` ignoriert |

**npm audit (Produktions-Dependencies):** 9 Schwachstellen (3 moderate, 6 high). Ohne Breaking Change behebbar (`npm audit fix`): Clerk-Pakete (Authorization-Bypass-Advisory GHSA-w24r-5266-9c3c), `js-cookie`, `svix`/`uuid`. **Nur mit Major-Upgrade behebbar:** `next` 14.2.35 → 16.x (lange Advisory-Liste, u. a. Cache-Poisoning/DoS) — Entscheidung für die IT-Roadmap.

**Bewusst offen gelassen:** Doku-Konsolidierung (Entscheidung #6); `npm audit fix` (Freigabe ausstehend); Next-16-Upgrade (IT-Roadmap); Schritt 3 (ESLint/Prettier) & Schritt 6 (God-File-Split) aus dem Migrationsplan.

**Nachtrag (2026-06-05, nachmittags):** Next.js 14.2 → 16.2 / React 19 Upgrade umgesetzt (Branch `next-16-upgrade`, via Preview verifiziert, dann live): Turbopack-Build, async Request-APIs, `middleware.ts`→`proxy.ts`, ESLint-Flat-Config ersetzt entferntes `next lint` (0 Errors; React-Compiler-Hinweise als Warnungen = IT-Merkliste), recharts 2.15.4 / framer-motion 12 / lucide 1.17, tsconfig `ES2017`. Damit sind die verbleibenden Next-CVEs geschlossen. Typografie-Entscheidung: Die nie geladenen Google-Fonts-Links (Inter/Manrope) wurden entfernt — React 19 hätte sie erstmals aktiviert und damit das gewohnte Schriftbild verändert (sichtbar als Textüberlauf in den Consumer-Journey-Kacheln). Der System-Font-Stack ist jetzt dokumentierte, bewusste Wahl; zusätzlich `overflow-wrap`-Schutz in den Journey-Pills.
