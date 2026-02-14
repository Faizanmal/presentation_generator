# Presentation Designer Backend

This is the backend API for the Presentation Designer application, built with [NestJS](https://nestjs.com/). It provides a robust, scalable architecture for handling AI content generation, real-time collaboration, payments, and data management.

## 🚀 Key Features

- **AI Engine**: Integration with OpenAI (GPT-4o, DALL-E 3, Whisper) for text, image, and voice generation.
- **Real-time Collaboration**: WebSocket-based (Socket.io) collaboration engine for multi-user editing.
- **Authentication**: Secure auth system supporting Email/Password, Google OAuth, and Enterprise SSO (SAML/OIDC).
- **Payment Processing**: Stripe integration for subscription management (SaaS).
- **Data Layer**: PostgreSQL database managed via Prisma ORM.
- **File Storage**: AWS S3 integration for asset management.
- **Export Engine**: HTML to PDF/PPTX conversion services.

## 🛠️ Tech Stack

- **Framework**: NestJS 11
- **Language**: TypeScript
- **Database**: PostgreSQL 15+
- **ORM**: Prisma
- **Real-time**: Socket.io
- **AI**: OpenAI API
- **Storage**: AWS S3
- **Payment**: Stripe

## 📦 Project Structure

The project follows a modular architecture:

```
src/
├── ai/                 # AI service (Text, Image, Speech)
├── auth/               # Authentication & Authorization
├── collaboration/      # WebSocket gateway & session management
├── prisma/             # Database connection & services
├── projects/           # Project CRUD & logic
├── slides/             # Slide management
├── blocks/             # Content block management
├── payments/           # Stripe subscription handling
├── upload/             # S3 file upload handling
├── export/             # Export functionality (PDF, PPTX)
└── ...                 # Other feature modules
```

## ⚡ Getting Started

### Prerequisites

- Node.js (v20+)
- PostgreSQL
- npm or pnpm

### Installation

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Environment Setup**:
    Copy `.env.example` to `.env` and fill in the required values.
    ```bash
    cp .env.example .env
    ```

    **Key Environment Variables**:
    - `DATABASE_URL`: PostgreSQL connection string.
    - `JWT_SECRET`: Secret for signing JWT tokens.
    - `OPENAI_API_KEY`: API key for OpenAI services.
    - `STRIPE_SECRET_KEY`: Stripe secret key.
    - `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`: AWS credentials.

3.  **Database Setup**:
    Run Prisma migrations to set up your database schema.
    ```bash
    npx prisma migrate dev
    ```

4.  **Running the Server**:
    ```bash
    # Development mode
    npm run start:dev

    # Production mode
    npm run start:prod
    ```

    The server will start on `http://localhost:3001` (default).

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## 📚 API Documentation

The API documentation is available via Swagger UI when running in development mode.
Visit: `http://localhost:3001/api/docs`

## 🤝 Contributing

Please ensure you follow the project's coding standards and run linting before improved.

```bash
npm run lint
```
