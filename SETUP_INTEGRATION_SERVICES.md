# Quick Setup Guide for Third-Party Integrations

## Services Integrated

1. **New Relic** - APM & Error Tracking
2. **TestMail** - Email Testing & Verification
3. **Travis CI** - Continuous Integration
4. **Doppler** - Secrets Management
5. **ImgBot** - Image Optimization
6. **Termius** - SSH Terminal Management

---

## Step-by-Step Setup

### 1. New Relic APM

```bash
# Install package (if not done)
cd backend-nest && npm install newrelic

# Get your license key from https://newrelic.com
# Set in .env:
NEW_RELIC_ENABLED=true
NEW_RELIC_LICENSE_KEY=your-license-key-here

# Start your server
npm run start:dev
```

**Manual Custom Tracking:**
```typescript
import { TrackNewRelic } from './newrelic.initialization';

@Injectable()
export class Service {
  @TrackNewRelic('my-operation')
  async myOperation() { }
}
```

---

### 2. TestMail Email Testing

```bash
# Sign up at https://testmail.app
# Get your API Key

# Backend setup in .env:
TESTMAIL_ENABLED=true
TESTMAIL_API_KEY=your-api-key
TESTMAIL_NAMESPACE=presentation-designer

# Frontend setup (if testing email)
REACT_APP_TESTMAIL_ENABLED=true
REACT_APP_TESTMAIL_API_KEY=your-api-key
REACT_APP_TESTMAIL_NAMESPACE=presentation-designer
```

**Usage in Tests:**
```typescript
import { TestMailService } from './testmail/testmail.service';

constructor(private testMail: TestMailService) {}

async verifyEmail() {
  // Email sent to: presentation-designer.default@inbox.testmail.app
  const sent = await this.testMail.verifyEmailSent('Welcome Email');
  expect(sent).toBe(true);
}
```

---

### 3. Travis CI

```bash
# Already configured in .travis.yml
# Go to https://travis-ci.com
# Connect your GitHub account
# Enable PresentationDesigner repository

# Add environment variables in Travis dashboard:
# - DOCKER_USERNAME
# - DOCKER_PASSWORD
# - DATABASE_URL (for tests)
# - API_KEYS (for services)
```

---

### 4. Doppler Secrets Management

```bash
# Install CLI
npm install -g doppler-cli

# Login
doppler login

# Create project and configs (one-time in Doppler dashboard)
# Project: presentation-designer
# Configs: dev, stg, prd

# Fetch and use secrets locally
doppler run -- npm start:dev

# Or sync to .env
doppler secrets download --format dotenv --config dev > .env.local

# Add token to GitHub Actions:
# Settings > Secrets > DOPPLER_TOKEN_PROD
```

---

### 5. ImgBot Image Optimization

```bash
# Go to https://imgbot.net
# Connect GitHub account
# Enable PresentationDesigner repository

# Already configured in imgbot.yml
# Creates weekly optimization PRs automatically
```

---

### 6. Termius SSH Terminal

```bash
# Download from https://termius.com

# Setup in app:
# 1. Create account
# 2. Add server connection:
#    Host: your-server-ip
#    User: deploy-user
#    Key: Your SSH key (stored in vault)
#    Port: 22

# Common commands:
ssh deploy@server "systemctl restart presentation-designer"
ssh deploy@server "tail -f /var/log/app.log"
```

---

## Environment Variables Checklist

```env
# New Relic
NEW_RELIC_ENABLED=true
NEW_RELIC_LICENSE_KEY=

# TestMail
TESTMAIL_ENABLED=true
TESTMAIL_API_KEY=
TESTMAIL_NAMESPACE=presentation-designer

# Doppler
DOPPLER_TOKEN=
DOPPLER_PROJECT=presentation-designer
DOPPLER_CONFIG=dev

# Existing services
DATABASE_URL=
JWT_SECRET=
OPENAI_API_KEY=
STRIPE_SECRET_KEY=
```

---

## Verification

1. **New Relic**: Check https://one.newrelic.com/ for metrics
2. **TestMail**: Check https://testmail.app/ for captured emails
3. **Travis CI**: Check https://travis-ci.com/ for build status
4. **Doppler**: Check https://doppler.com/ for sync status
5. **ImgBot**: Check GitHub PRs for image optimizations
6. **Termius**: Test SSH connection to server

---

## Documentation

Full setup guide: [INTEGRATION_GUIDE.md](./docs/INTEGRATION_GUIDE.md)
