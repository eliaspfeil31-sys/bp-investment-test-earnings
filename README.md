# BP Earnings Calendar – Vercel Deployment

## Projektstruktur

```
bp-earnings/
├── index.html          ← Das Frontend (Earnings Builder)
├── api/
│   └── earnings.js     ← Serverless Function (Yahoo Finance Scraper)
├── package.json
├── vercel.json
└── README.md
```

## Deploy auf Vercel (5 Minuten)

### Option A: Via GitHub (empfohlen)

1. **GitHub Repo erstellen**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/DEINNAME/bp-earnings.git
   git push -u origin main
   ```

2. **Vercel verbinden**
   - Gehe zu [vercel.com](https://vercel.com) → "New Project"
   - GitHub Repo importieren
   - Framework: **Other**
   - Deploy klicken → fertig ✅

### Option B: Via Vercel CLI (direkt)

```bash
npm i -g vercel
cd bp-earnings
vercel --prod
```

## Wie der KI Auto-Fill funktioniert

```
Browser → klickt "🤖 KI Auto-Fill"
       → /api/earnings?week=0
       → Vercel Serverless Function
       → Yahoo Finance API (query1.finance.yahoo.com)
       → Parsed BMO / AMC Daten
       → Logo via Clearbit (kostenlos, kein API Key nötig)
       → JSON zurück an Browser
       → Slots werden befüllt
```

### Woche wechseln

Die API unterstützt `?week=N`:
- `week=0` → aktuelle Woche
- `week=1` → nächste Woche
- `week=-1` → letzte Woche

Du kannst im Code einen "← Vorherige / Nächste →" Button ergänzen.

## Logo-Quellen

Logos kommen von **Clearbit Logo API** (kostenlos):
```
https://logo.clearbit.com/nvidia.com?size=128
```

Falls ein Logo fehlt oder falsch ist → einfach im Builder manuell ersetzen
(auf Logo klicken → Strg+V oder Datei hochladen).

## Eigene Domain

In Vercel unter "Settings → Domains" einfach deine Domain eintragen,
z.B. `earnings.bp-investments.com`.

## Kosten

- Vercel Free Tier: **kostenlos** (100GB Bandwidth, 1M Function Calls/Monat)
- Clearbit Logo API: **kostenlos** (kein Account nötig)
- Yahoo Finance: **kostenlos** (öffentliche API)
