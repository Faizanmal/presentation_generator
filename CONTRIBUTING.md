# Contributing to Presentation Generator

Thank you for your interest in contributing to Presentation Generator! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Project Structure](#project-structure)
- [Commit Message Guidelines](#commit-message-guidelines)

## Code of Conduct

We are committed to providing a welcoming and inspiring community for all. Please be respectful, professional, and considerate in all interactions.

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose
- PostgreSQL 15+
- Redis 7+
- Git

### First-Time Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/presentation_generator.git
   cd presentation_generator
   ```

2. **Install dependencies**
   ```bash
   # Backend
   cd backend-nest
   npm install
   
   # Frontend
   cd ../frontend
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start development services**
   ```bash
   # From project root
   docker-compose up -d db redis
   ```

5. **Run database migrations and seed**
   ```bash
   cd backend-nest
   npm run db:migrate
   npm run db:seed
   ```

6. **Start development servers**
   ```bash
   # Terminal 1 - Backend
   cd backend-nest
   npm run start:dev
   
   # Terminal 2 - Frontend
   cd frontend
   npm run dev
   ```

## Development Workflow

### Branching Strategy

We follow a simplified Git Flow:

- `master` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - New features
- `fix/*` - Bug fixes
- `hotfix/*` - Critical production fixes
- `refactor/*` - Code refactoring
- `docs/*` - Documentation updates

### Creating a Branch

```bash
# Feature branch
git checkout -b feature/add-dark-mode

# Bug fix
git checkout -b fix/resolve-export-issue

# Documentation
git checkout -b docs/update-api-guide
```

### Making Changes

1. Make your changes in your feature branch
2. Write or update tests as needed
3. Ensure all tests pass: `npm test`
4. Ensure code lints: `npm run lint`
5. Commit with a descriptive message (see [Commit Guidelines](#commit-message-guidelines))

## Coding Standards

### TypeScript/JavaScript

- Use TypeScript for all new code
- Follow the existing code style (ESLint + Prettier configured)
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Prefer `const` over `let`, avoid `var`
- Use async/await over raw Promises
- Handle errors appropriately

### Backend (NestJS)

- Follow NestJS best practices
- Use dependency injection
- Create DTOs for request validation
- Add Swagger/OpenAPI decorators to controllers
- Write unit tests for services
- Write e2e tests for controllers
- Use guards for authentication/authorization
- Apply rate limiting decorators to relevant endpoints

```typescript
// Example controller
@Controller('projects')
@UseGuards(JwtAuthGuard)
@ApiTags('Projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ThrottleModerate()
  @ApiOperation({ summary: 'Create a new project' })
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectsService.create(user.id, dto);
  }
}
```

### Frontend (Next.js/React)

- Use functional components with hooks
- Follow React best practices
- Use TypeScript for type safety
- Create reusable components in `components/ui/`
- Use Tailwind CSS for styling
- Implement proper error boundaries
- Use React Query for data fetching
- Follow atomic design principles

```tsx
// Example component
interface ProjectCardProps {
  project: Project;
  onDelete?: (id: string) => void;
}

export function ProjectCard({ project, onDelete }: ProjectCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{project.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* content */}
      </CardContent>
    </Card>
  );
}
```

### Database (Prisma)

- Follow Prisma naming conventions
- Add indexes for frequently queried fields
- Use appropriate data types
- Add comments to complex fields
- Create migrations with descriptive names

```prisma
model Project {
  id          String   @id @default(cuid())
  title       String
  userId      String
  createdAt   DateTime @default(now())
  
  user User @relation(fields: [userId], references: [id])
  
  @@index([userId])
  @@index([createdAt])
  @@map("projects")
}
```

## Testing Guidelines

### Unit Tests

- Write tests for all business logic
- Aim for >80% code coverage
- Mock external dependencies
- Use descriptive test names

```typescript
describe('ProjectsService', () => {
  describe('create', () => {
    it('should create a new project', async () => {
      // Arrange
      const userId = 'user-123';
      const dto = { title: 'Test Project' };
      
      // Act
      const result = await service.create(userId, dto);
      
      // Assert
      expect(result.title).toBe(dto.title);
      expect(result.userId).toBe(userId);
    });
  });
});
```

### E2E Tests

- Write e2e tests for critical user flows
- Use the test database
- Clean up test data after each test
- Test both success and error cases

```typescript
describe('Projects (e2e)', () => {
  it('/api/projects (POST)', () => {
    return request(app.getHttpServer())
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'New Project' })
      .expect(201)
      .expect((res) => {
        expect(res.body.title).toBe('New Project');
      });
  });
});
```

### Running Tests

```bash
# Backend unit tests
cd backend-nest
npm test

# Backend e2e tests
npm run test:e2e

# Frontend tests
cd frontend
npm test

# Test coverage
npm run test:cov
```

## Pull Request Process

### Before Submitting

1. ✅ All tests pass
2. ✅ Code is linted and formatted
3. ✅ No TypeScript errors
4. ✅ Documentation is updated
5. ✅ Commits follow the convention
6. ✅ Branch is up to date with `develop`

### PR Template

When creating a PR, include:

**Description**
- What changes were made and why
- Link to related issue(s)

**Type of Change**
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

**Testing**
- [ ] Unit tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing performed

**Screenshots** (if applicable)

### Review Process

1. Submit PR against `develop` branch
2. Automated CI checks must pass
3. At least one maintainer approval required
4. Address review comments
5. Maintainer will merge once approved

## Project Structure

```
presentation_generator/
├── backend-nest/           # NestJS backend
│   ├── src/
│   │   ├── ai/            # AI generation module
│   │   ├── auth/          # Authentication
│   │   ├── common/        # Shared utilities
│   │   ├── projects/      # Projects module
│   │   └── ...
│   ├── test/              # E2E tests
│   └── prisma/            # Database schema
├── frontend/              # Next.js frontend
│   ├── src/
│   │   ├── app/          # Next.js app router
│   │   ├── components/   # React components
│   │   ├── lib/          # Utilities
│   │   └── stores/       # State management
│   └── public/           # Static assets
├── k8s/                  # Kubernetes configs
├── nginx/                # Nginx config
└── docs/                 # Documentation
```

## Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements

### Examples

```
feat(ai): add image generation with DALL-E 3

Implement AI image generation endpoint using DALL-E 3.
Includes rate limiting and error handling.

Closes #123
```

```
fix(export): resolve PDF export timeout issue

Increase timeout for large presentations and add
progress indicators.

Fixes #456
```

```
docs(contributing): update testing guidelines
```

## Need Help?

- 📧 Email: support@presentation.com
- 💬 Discord: https://discord.gg/presentation
- 📖 Documentation: https://docs.presentation.com
- 🐛 Issues: https://github.com/Faizanmal/presentation_generator/issues

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.

---

Thank you for contributing to Presentation Generator! 🎉
