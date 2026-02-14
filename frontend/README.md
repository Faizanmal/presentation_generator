# Presentation Designer Frontend

This is the frontend application for the Presentation Designer SaaS, built with [Next.js](https://nextjs.org/) and modern React technologies. It delivers a fast, responsive, and collaborative user experience for creating stunning presentations.

## 🎨 Key Features

- **Intuitive Editor**: Block-based editor with real-time preview and drag-and-drop functionality.
- **AI Integration**: Seamlessly generate slides, refine text, and create images directly within the editor.
- **Real-time Collaboration**: WebSocket-powered multi-user editing with live cursors and comments.
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices.
- **Themes & Templates**: Browse and apply professional themes and templates instantly.
- **Dashboard**: Project management, analytics, and team collaboration hub.
- **Accessibility**: WCAG 2.1 compliant UI components and features.

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Library**: React 19
- **Typing**: TypeScript
- **Styling**: Tailwind CSS 4
- **State Management**: Zustand
- **Data Fetching**: TanStack React Query
- **UI Components**: Radix UI
- **Components Library**: shadcn/ui
- **Icons**: Lucide React
- **Rich Text Editor**: TipTap (ProseMirror based)
- **Animations**: Framer Motion

## 📦 Project Structure

```
src/
├── app/                # App Router pages and layouts
├── components/         # Reusable UI components
│   ├── ai/             # AI-specific components
│   ├── editor/         # Presentation editor components
│   ├── ui/             # Generic UI components (shadcn/ui)
│   └── ...             # Other feature-specific components
├── hooks/              # Custom React hooks (useAuth, useProject, useSocket)
├── lib/                # Utilities and API client
├── stores/             # Global state stores (Zustand)
├── types/              # TypeScript interfaces and types
└── styles/             # Global CSS and Tailwind config
```

## ⚡ Getting Started

### Prerequisites

- Node.js (v20+)
- npm or pnpm

### Installation

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Environment Setup**:
    Create `.env.local` and add the backend API URL.
    ```bash
    echo "NEXT_PUBLIC_API_URL=http://localhost:3001/api" > .env.local
    ```

3.  **Running the Server**:
    ```bash
    # Development mode
    npm run dev

    # Production build
    npm run build
    npm start
    ```

    The application will be available at `http://localhost:3000`.

## 🧪 Testing

```bash
# Unit tests (Jest + React Testing Library)
npm run test

# Integration tests
npm run test:integration

# Accessibility tests
npm run test:a11y
```

## 🎨 Styling

We use Tailwind CSS for styling. Custom components are built on top of Radix UI primitives for accessibility and flexibility. Check out `src/components/ui` for our component library.

## 🤝 Contributing

Before adding new components, please check if a similar component already exists in `src/components/ui`. Follow the existing patterns for consistency.

```bash
npm run lint
```
