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

## 🚀 Deployment

### Railway Deployment

This backend is configured for easy deployment on [Railway](https://railway.app).

#### Prerequisites
- Railway account
- GitHub repository connected to Railway

#### Steps

1. **Create a Railway Project**:
   - Go to [Railway Dashboard](https://railway.app/dashboard)
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository

2. **Add Database Service**:
   - In your Railway project, add a PostgreSQL service
   - Railway will automatically provide `DATABASE_URL` environment variable

3. **Add Redis Service (Optional)**:
   - Add a Redis service for caching and queues
   - Railway will provide `REDIS_URL` environment variable

4. **Configure Environment Variables**:
   Set the following environment variables in Railway (Project Settings → Variables):

   ```env
   # Required
   JWT_SECRET=your-super-secret-jwt-key-change-in-production
   JWT_EXPIRATION=7d

   # AI Providers (at least one)
   OPENAI_API_KEY=your-openai-api-key
   GROQ_API_KEY=your-groq-api-key
   GOOGLE_AI_API_KEY=your-google-ai-key

   # Image APIs (optional)
   UNSPLASH_ACCESS_KEY=your-unsplash-access-key
   PEXELS_API_KEY=your-pexels-api-key
   PIXABAY_API_KEY=your-pixabay-api-key

   # Payments (if using Stripe)
   STRIPE_SECRET_KEY=your-stripe-secret-key
   STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret

   # AWS S3 (if using file storage)
   AWS_ACCESS_KEY_ID=your-aws-access-key
   AWS_SECRET_ACCESS_KEY=your-aws-secret-key
   AWS_REGION=us-east-1
   AWS_S3_BUCKET=your-s3-bucket-name

   # Email (if using SendGrid)
   SENDGRID_API_KEY=your-sendgrid-api-key
   MAIL_FROM=no-reply@example.com

   # Frontend URL
   FRONTEND_URL=https://your-frontend-domain.com
   ```

5. **Deploy**:
   - Railway will automatically detect the `railway.json` configuration
   - It will build using `Dockerfile.production`
   - Run database migrations on deploy
   - Start the application

6. **Verify Deployment**:
   - Check the Railway logs for successful build and migration
   - Visit your Railway domain + `/api/health` to verify the health endpoint

#### Railway Configuration Files
- `railway.json`: Specifies build and deploy configuration
- `Dockerfile.production`: Optimized production Docker image
- Environment variables are automatically injected by Railway services
