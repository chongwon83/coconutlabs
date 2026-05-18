# CoconutLabs — Web

Static landing page for CoconutLabs.xyz — AI coding efficiency leaderboard,
cost-per-fix challenges, and verified workflow drops.

> **Status**: Hypothesis-validation prototype. Not a production product.

---

## Setup

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Build

```bash
npm run build   # TypeScript check + production bundle
npm run start   # Serve production build
```

---

## Stack

- **Next.js 16** (App Router, TypeScript)
- **Tailwind CSS v4** (config-less, `@theme` tokens in `globals.css`)
- **React 19** (via Next.js canary)
- Fonts: Inter + JetBrains Mono via `next/font/google`

---

## Project structure

```
web/
├── app/
│   ├── layout.tsx        # Fonts + metadata
│   ├── page.tsx          # Thin server component → LandingApp
│   └── globals.css       # Design tokens + ported skin CSS
├── components/
│   ├── LandingApp.tsx    # 'use client' shell (toast, modal state)
│   ├── Nav.tsx
│   ├── StatusBar.tsx
│   ├── Hero.tsx          # Includes ProductShot, HeroSecondaryCard
│   ├── Ticker.tsx
│   ├── BurnIndexSection.tsx
│   ├── ChallengeSection.tsx  # Includes CodePanel, Stat
│   ├── BuildersSection.tsx   # Includes ActivityFeed
│   ├── DropsSection.tsx
│   ├── TrustSection.tsx
│   ├── FinalCTA.tsx
│   ├── Footer.tsx
│   ├── Toast.tsx
│   ├── Sparkline.tsx
│   ├── primitives/       # Icon, Button, Badge, VerifBadge, Avatar, Trend
│   └── forms/
│       ├── JoinBurnIndexForm.tsx     # Placeholder, local state only
│       └── ChallengeInviteForm.tsx   # Placeholder, local state only
├── lib/
│   └── data.ts           # Types + static data + sparkFor()
├── docs/
│   └── usage-poc.md      # Track B manual guide
└── tools/usage-poc/
    ├── env-info.sh
    ├── discover-logs.sh
    ├── search-marker.sh
    └── inspect-fields.sh
```

---

## Track B — CLI usage PoC

See `docs/usage-poc.md` for the step-by-step guide to validate the
device-side collection hypothesis.

```bash
cd tools/usage-poc
chmod +x *.sh
./env-info.sh
./discover-logs.sh
./search-marker.sh
./inspect-fields.sh <path>
```

**Security**: scripts output file names, paths, and field names only.
Log file contents are never printed.

---

## What this prototype does NOT include

- Real authentication or account system
- Payment / marketplace
- Actual CLI collector or API integration
- Executable workflow installation
- Any server-side data storage

Forms submit locally and trigger a toast confirmation only.
