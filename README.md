# Presentation Designer

A Gamma-like SaaS application for creating beautiful AI-powered presentations. Built with Next.js, NestJS, PostgreSQL, and OpenAI.

## Features

### Core Features
- 🤖 **AI-Powered Generation**: Generate complete presentations from a simple topic description
- 🎨 **Beautiful Themes**: Multiple professionally designed themes with customizable colors and fonts
- 📝 **Block-Based Editor**: Drag-and-drop editor with support for headings, paragraphs, lists, images, code, quotes, tables, and more
- 👥 **User Authentication**: Email/password and Google OAuth authentication
- 💳 **Subscription Plans**: Free, Pro, and Enterprise tiers with Stripe integration
- 📤 **Export Options**: Export presentations as HTML, JSON, or PDF
- 🔗 **Sharing**: Share presentations via unique links
- 📱 **Presentation Mode**: Full-screen presentation mode with keyboard navigation

### Advanced Features (Competitive Advantages)
- 👥 **Real-Time Collaboration**: Multi-user editing with live cursors, presence indicators, and version history
- 🎤 **Voice-to-Slides**: Convert speech recordings to presentation content using OpenAI Whisper
- 📊 **Analytics & Tracking**: Track views, engagement, heatmaps, and AI-powered insights
- 🔗 **Third-Party Integrations**: Connect with Zoom, Slack, Teams, Google Drive, Figma, and Notion
- 🎨 **AI Personalization**: Brand profiles, training documents, and writing style customization
- 🏢 **Enterprise Features**: Organization management, SSO (SAML/OIDC), white-labeling, audit logs
- 📱 **PWA & Offline Support**: Install as app, work offline with background sync

### 🆕 Latest Features (V2.0)
- 🖼️ **AI Image Generation & Stock Integration**: Choose between unique AI-generated illustrations (DALL-E 3) or high-quality stock photos for your slides.
- 🎯 **AI Audience Adaptation**: Automatically adapt presentations for different audiences (executives, sales, technical, investors, etc.) with tone, complexity, and length adjustments
- 📊 **Interactive Embeds**: Live polls, Q&A sessions, forms, quizzes, and word clouds with real-time results via WebSocket
- 📈 **Data-Driven Charts**: Connect live data from CSV, Google Sheets, or APIs with auto-refresh and AI-suggested chart types
- 🛒 **Template Marketplace**: Browse, purchase, and sell presentation templates with reviews and revenue sharing (80% to creators)
- 🎨 **Design System Tokens**: Unified color, typography, spacing tokens with CSS/Tailwind export and built-in presets
- ♿ **Smart Accessibility Checks**: WCAG 2.1 compliance scanning with AI-powered alt-text generation and auto-fix suggestions
- 🌍 **Multilingual Collaboration**: Translate presentations to 18+ languages with async translation jobs and RTL support
- 🎙️ **AI Narration & Video Export**: Generate voiceovers with 6 TTS voices (OpenAI), AI speaker notes, and export to MP4/MP3/WebM
- 📋 **Content Governance**: Approval workflows, required disclaimers, content locks, and policy enforcement for enterprise compliance
- 📊 **Team Analytics**: Contribution tracking, revision heatmaps, productivity trends, and project attribution reports

### New Usability Features (Competitor-Matching)
- ⌨️ **Command Palette (⌘K)**: Quick access to all actions and navigation via keyboard shortcut
- ✨ **AI Text Enhancement**: Shorten, expand, simplify, change tone, fix grammar with one click
- 🎯 **Smart Templates**: Pre-designed slide layouts (title, two-column, statistics, timeline, etc.)
- 📋 **Starter Templates**: Complete presentation templates for pitch decks, proposals, training, etc.
- 🗺️ **Slide Outline/TOC**: Navigate large presentations with searchable slide outline
- ↩️ **Visual Undo History**: See all changes and jump to any previous state
- ⭐ **Favorites & Recent**: Quick access to starred and recently opened presentations
- 🎤 **Speaker Notes Generation**: AI-generated presenter notes for each slide
- 💡 **AI Slide Suggestions**: Get improvement recommendations for your content
- ⚡ **Quick Actions Toolbar**: Floating toolbar for common actions
- ⌨️ **Keyboard Shortcuts**: Comprehensive shortcuts with visual help overlay

### Enhanced Editor Features
- 📷 **Drag & Drop Image Upload**: Drop images directly onto slides with progress tracking
- 🎙️ **Speaker Notes Panel**: Full notes editor with AI generation and voice recording
- ⏸️ **Slash Commands (/)**: Type "/" to quickly insert any block type (like Notion)
- 📜 **Version History**: View, compare, and restore previous versions of presentations
- 💾 **Auto-Save**: Automatic saving with visual status indicator
- 🔍 **Advanced Search (⌘⇧F)**: Search across all presentations, slides, and content
- 🖼️ **Image URL Import**: Insert images from URLs with preview
- 📋 **Clipboard Paste**: Paste images directly from clipboard

### Collaboration Features
- 👥 **Real-time Presence**: See who's viewing/editing with avatar indicators
- 🖱️ **Live Cursors**: See collaborators' cursor positions in real-time
- 💬 **Comments System**: Threaded comments with @mentions, replies, and resolve/pin actions
- ⌨️ **Typing Indicators**: See when teammates are actively typing
- 🎨 **Collaborator Colors**: Unique colors assigned to each collaborator

### Presentation Mode
- 🎬 **Full Presentation Mode**: Fullscreen with keyboard navigation (→←, space, page up/down)
- 🔴 **Laser Pointer**: Virtual laser pointer for emphasis
- ✏️ **Pen & Highlighter**: Draw annotations during presentations
- 📝 **Speaker Notes**: View notes during presentation (press N)
- 📊 **Slide Grid**: Jump to any slide with thumbnail grid (press G)
- ⏱️ **Presentation Timer**: Track elapsed time
- ▶️ **Auto-Play**: Automatic slide advancement
- 👁️ **Presenter View**: Dual-screen support with current/next slide

### Analytics Dashboard
- 📈 **View Metrics**: Total views, unique viewers, completion rate
- 📊 **Slide Performance**: Per-slide engagement data with drop-off analysis
- 👤 **Viewer Activity**: Track individual viewer sessions and devices
- 🎯 **Engagement Funnel**: Visualize viewer drop-off points
- 🤖 **AI Insights**: Automated recommendations based on viewer behavior
- 📱 **Device Analytics**: Desktop vs mobile viewing breakdown


## Tech Stack

### Frontend
- **Next.js 16** (App Router)
- **React 19**
- **TypeScript**
- **Tailwind CSS 4**
- **TanStack React Query** - Data fetching and caching
- **Zustand** - State management
- **Socket.io Client** - Real-time collaboration
- **DnD-Kit** - Drag and drop functionality
- **TipTap** - Rich text editor (for future enhancements)
- **Radix UI** - Accessible UI components

### Backend
- **NestJS 11**
- **Prisma ORM** - Database management
- **PostgreSQL** - Database
- **Socket.io** - WebSocket for real-time features
- **Passport.js** - Authentication (JWT + Google OAuth + SAML + OIDC)
- **OpenAI GPT-4o** - AI content generation
- **OpenAI Whisper** - Speech-to-text for voice features
- **Stripe** - Payment processing
- **AWS S3** - File storage

## Project Structure

```
PresentationDesigner/
├── frontend/                 # Next.js frontend application
│   ├── src/
│   │   ├── app/             # App router pages
│   │   │   ├── auth/        # OAuth callbacks
│   │   │   ├── dashboard/   # User dashboard
│   │   │   ├── editor/      # Presentation editor
│   │   │   ├── login/       # Login page
│   │   │   ├── present/     # Presentation mode
│   │   │   ├── register/    # Registration page
│   │   │   └── settings/    # User settings (billing, integrations, branding, organization)
│   │   ├── components/      # Reusable components
│   │   │   ├── editor/      # Editor components (collaboration, voice, analytics)
│   │   │   ├── providers/   # Context providers
│   │   │   ├── settings/    # Settings components
│   │   │   └── ui/          # UI components (shadcn/ui)
│   │   ├── hooks/           # Custom React hooks
│   │   ├── lib/             # Utilities and API client
│   │   ├── stores/          # Zustand stores
│   │   └── types/           # TypeScript types
│   └── public/              # Static assets (manifest.json, sw.js for PWA)
│
├── backend-nest/            # NestJS backend application
│   ├── prisma/
│   │   └── schema.prisma    # Database schema
│   └── src/
│       ├── accessibility/   # WCAG 2.1 accessibility checks & auto-fix
│       ├── ai/              # AI generation service
│       ├── analytics/       # Presentation analytics & tracking
│       ├── audience-adaptation/ # AI audience adaptation
│       ├── auth/            # Authentication module
│       ├── blocks/          # Blocks CRUD
│       ├── collaboration/   # Real-time collaboration (WebSocket)
│       ├── content-governance/ # Approval workflows & compliance
│       ├── data-charts/     # Live data charts & visualizations
│       ├── design-system/   # Design tokens management
│       ├── export/          # Export functionality
│       ├── integrations/    # Third-party integrations (Zoom, Slack, etc.)
│       ├── interactive-embeds/ # Polls, Q&A, forms with WebSocket
│       ├── multilingual/    # Translation & localization
│       ├── narration-export/ # AI voiceover & video export
│       ├── organizations/   # Enterprise organization management
│       ├── payments/        # Stripe integration
│       ├── personalization/ # Brand profiles & AI customization
│       ├── prisma/          # Prisma service
│       ├── projects/        # Projects CRUD
│       ├── slides/          # Slides CRUD
│       ├── sync/            # Offline sync functionality
│       ├── tags/            # Project tagging
│       ├── team-analytics/  # Team performance & attribution
│       ├── template-marketplace/ # Template buying/selling
│       ├── themes/          # Themes management
│       ├── upload/          # S3 upload service
│       ├── users/           # User management
│       └── voice/           # Voice-to-slides functionality
│
└── backend/                 # Django backend (deprecated)
```

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- npm or pnpm
- OpenAI API key
- Stripe account (for payments)
- AWS S3 bucket (for file uploads)
- Google OAuth credentials (optional)

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend-nest
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment file and configure:
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

4. Generate Prisma client and run migrations:
   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```

5. Start the development server:
   ```bash
   npm run start:dev
   ```

The backend will be available at `http://localhost:3001`.

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment file:
   ```bash
   echo "NEXT_PUBLIC_API_URL=http://localhost:3001/api" > .env.local
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

The frontend will be available at `http://localhost:3000`.

## Environment Variables

### Backend (.env)

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/presentation_designer"

# JWT
JWT_SECRET="your-secret-key"
JWT_EXPIRATION="7d"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:3001/api/auth/google/callback"

# OpenAI
OPENAI_API_KEY="your-openai-api-key"

# Stripe
STRIPE_SECRET_KEY="your-stripe-secret-key"
STRIPE_WEBHOOK_SECRET="your-webhook-secret"
STRIPE_PRO_PRICE_ID="price_xxx"
STRIPE_ENTERPRISE_PRICE_ID="price_xxx"

# AWS S3
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"
AWS_REGION="us-east-1"
AWS_S3_BUCKET="your-bucket-name"

# App
FRONTEND_URL="http://localhost:3000"
PORT=3001
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Subscription Plans

| Feature | Free | Pro ($29/mo) | Enterprise ($199/mo) |
|---------|------|--------------:|---------------------:|
| Presentations | 3 | 100 | 1,000 |
| Standard AI Generations | 10/month | 1,000/month | 50,000/month |
| Thinking (high‑quality) generations (included) | 0 | 5 / month | 250 / month |
| Themes | Basic | All | All |
| Export PDF | ❌ | ✅ | ✅ |
| Priority Support | ❌ | ✅ | ✅ |
| Team Features | ❌ | ❌ | ✅ |

Notes:
- "Standard AI Generations" are the lower‑cost quick generations. "Thinking" runs are higher‑cost, multi‑step generations (use credits).
- You can purchase additional Thinking credits or upgrade plans for higher quotas.



## License

MIT
