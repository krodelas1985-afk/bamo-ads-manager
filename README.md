# BaMo Ads Manager

Advertisement management platform for BaMo clients — part of the BaMo 3P Framework.

## Platform Context
- **Pillar 1 (Position):** BaMo Marketplace — bahaymo.com
- **Pillar 2 (Prepare):** BaMo Ads Manager — this app
- **Pillar 3 (Produce):** BaMo Campaign Engine — Messenger automation

## Stack
- Next.js 14 (App Router)
- Supabase (shared project with Campaign Engine)
- Tailwind CSS
- TypeScript

## Getting Started

1. Clone the repo
2. Copy `.env.local.example` to `.env.local` and fill in keys
3. Run `npm install`
4. Run `npm run dev` (runs on port 3001 to avoid conflict with Campaign Engine)

## Roles
- `baymo_admin` — full access to all clients
- `client_admin` — scoped to their own workspace

## Supabase Project
`zyfkjxepykwpfzmkxitb` — shared with BaMo Campaign Engine
