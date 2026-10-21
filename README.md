# PresentPitch: AI Presentation Platform

**Type a topic and get a finished, editable slide deck that you can present, share or export. An LLM-backed SaaS I built from idea to live product.**

🌐 **Live app:** https://presentpitch.vercel.app

<!-- SCREENSHOT/GIF PLACEHOLDER 1: prompt → generated deck (10–15 s GIF) -->
<!-- ![Generate a deck](docs/media/generate.gif) -->
<!-- SCREENSHOT PLACEHOLDER 2: block editor with theme panel -->
<!-- SCREENSHOT PLACEHOLDER 3: presentation mode / share link view -->

---

## What it does

PresentPitch turns a short prompt into a complete presentation. It plans the outline, writes the slides and lays them out as editable blocks, then lets you refine, present, share and export the result.

## Features

- **AI deck generation:** prompt in, structured slides out (OpenAI GPT-4o by default, with Groq and Gemini support in the codebase).
- **"Thinking" mode:** a multi-step agent pipeline (planner → research → generator → critic) runs as a background job for higher-quality decks.
- **AI editing helpers:** shorten, expand, rewrite or change the tone of text, and generate speaker notes.
- **Block-based editor:** headings, lists, images, code, quotes and tables, with drag-and-drop ordering and themes.
- **Real-time collaboration:** live presence and editing over WebSockets (Socket.io).
- **Presentation mode:** full screen with keyboard navigation, plus share links for viewers.
- **Export** to PPTX, PDF and HTML.
- **Accounts and billing:** email/password and Google OAuth sign-in, with Stripe subscription plans.
- **Engineering:** NestJS + Prisma API, Redis-backed job queues, Jest tests and GitHub Actions CI, Docker files for local and production use.

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, TanStack Query, Zustand, Radix UI, dnd-kit, Socket.io client |
| Backend | NestJS 11, Prisma, PostgreSQL, Redis, Socket.io, Passport (JWT + Google OAuth) |
| AI | OpenAI API (GPT-4o / GPT-4o-mini), Groq, Google Gemini |
| Payments and infra | Stripe, AWS S3, Docker, Vercel (frontend), Render (backend) |

## Quick start (local)

**You'll need:** Node.js **24.12+** (see `.nvmrc`), Docker (for Postgres and Redis) and an OpenAI or Groq API key.

```bash
git clone https://github.com/Faizanmal/presentation_generator.git
cd presentation_generator

# 1. Environment files
cp .env.example .env
cp backend-nest/.env.example backend-nest/.env
cp frontend/.env.example frontend/.env.local
#    then set DATABASE_URL, REDIS_*, and OPENAI_API_KEY (or GROQ_API_KEY) in backend-nest/.env

# 2. Database and cache
docker compose up -d db redis

# 3. Backend (http://localhost:3001)
cd backend-nest
npm install
npx prisma generate
npx prisma migrate dev
npm run start:dev

# 4. Frontend (http://localhost:3000), in a second terminal
cd frontend
npm install
npm run dev
```

The frontend reads `NEXT_PUBLIC_API_URL` (default `http://localhost:3001/api`).
Tests: run `npm test` in `backend-nest/` or `frontend/`.

## Project layout

```
frontend/       # Next.js app (dashboard, editor, present, view, settings)
backend-nest/   # NestJS API (ai, slides, blocks, export, collaboration, payments, auth, ...)
shared/         # shared presentation DSL and layout engine
docs/           # deployment and feature guides
```

---

## 💼 Hire me

I build LLM features into real products, from an AI assistant or RAG MVP to a full SaaS like this one, in fixed scopes with clear milestones, tests and CI. I also stay on after launch for maintenance.

**Faizan Malik**, Freelance AI & Automation Engineer (Python, Next.js, LLM/RAG), based in Delhi (IST, UTC+5:30)
→ [Contra](https://contra.com/faizan_malik_u76kw1s7) · [LinkedIn](https://www.linkedin.com/in/faizanmalikdelhi) · [GitHub](https://github.com/Faizanmal)

## License

MIT
