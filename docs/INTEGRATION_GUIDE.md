# Third-Party Integrations Guide

This document covers the setup and usage of integrated third-party services in the PresentationDesigner project.

## Table of Contents

- [New Relic APM](#new-relic-apm)
- [TestMail Email Testing](#testmail-email-testing)
- [Travis CI](#travis-ci)
- [Doppler Secrets Management](#doppler-secrets-management)
- [ImgBot Image Optimization](#imgbot-image-optimization)
- [Termius SSH Terminal](#termius-ssh-terminal)

---

## New Relic APM

**Purpose**: Application Performance Monitoring and error tracking for the NestJS backend.

### Setup

1. **Get License Key**
   - Sign up at https://newrelic.com
   - Create an application and copy the license key

2. **Install Package**
   ```bash
   npm install newrelic --save
   ```

3. **Add Environment Variables**
   ```env
   NEW_RELIC_ENABLED=true
   NEW_RELIC_LICENSE_KEY=your-license-key-here
   ```

4. **Configuration**
   - `newrelic.js` contains all configuration
   - Automatically loaded via `src/newrelic.initialization.ts`
   - Logs stored in `./logs/newrelic.log`

### Usage

The New Relic agent automatically monitors:
- HTTP requests and responses
- Database queries
- JavaScript errors
- Redis operations

To manually track custom transactions:

```typescript
import { TrackNewRelic } from './newrelic.initialization';

@Injectable()
export class MyService {
  @TrackNewRelic('custom-operation')
  async customOperation() {
    // This will be tracked as a custom segment
  }
}
```

### Dashboard
- Access at: https://one.newrelic.com/
- Monitor real-time performance metrics
- Set up alerts for error rates and latency

---

## TestMail Email Testing

**Purpose**: Intercept and verify emails during development and testing.

### Setup

1. **Create TestMail Account**
   - Go to https://testmail.app
   - Sign up and create an API key

2. **Backend Configuration**
   ```env
   TESTMAIL_ENABLED=true
   TESTMAIL_API_KEY=your-api-key
   TESTMAIL_NAMESPACE=presentation-designer
   ```

3. **Frontend Configuration**
   ```env
   REACT_APP_TESTMAIL_ENABLED=true
   REACT_APP_TESTMAIL_API_KEY=your-api-key
   REACT_APP_TESTMAIL_NAMESPACE=presentation-designer
   ```

### Usage

**Backend - NestJS:**

```typescript
import { TestMailService } from './testmail/testmail.service';

@Controller('auth')
export class AuthController {
  constructor(private testMailService: TestMailService) {}

  @Post('verify-email')
  async verifyEmail() {
    // Email sent to: presentation-designer.default@inbox.testmail.app
    
    // Verify in tests
    const emailSent = await this.testMailService.verifyEmailSent('Welcome to PresentationDesigner');
    expect(emailSent).toBe(true);
  }
}
```

**Frontend - React:**

```typescript
import { fetchTestEmails, getTestMailAddress } from '@config/testmail.config';

export function EmailTest() {
  const testEmail = getTestMailAddress('signup-test');
  
  const handleCheckEmail = async () => {
    const emails = await fetchTestEmails('signup-test');
    console.log('Received emails:', emails);
  };

  return (
    <div>
      <p>Test email address: {testEmail}</p>
      <button onClick={handleCheckEmail}>Check Emails</button>
    </div>
  );
}
```

### Test Email Addresses

Pattern: `{namespace}.{tag}@inbox.testmail.app`

Examples:
- `presentation-designer.default@inbox.testmail.app`
- `presentation-designer.signup-test@inbox.testmail.app`
- `presentation-designer.password-reset@inbox.testmail.app`

### Dashboard
- View all captured emails at: https://testmail.app/
- No configuration needed - emails appear automatically

---

## Travis CI

**Purpose**: Continuous Integration and automated testing on code push.

### Setup

1. **Connect Repository**
   - Go to https://travis-ci.com
   - Sign in with GitHub
   - Enable the PresentationDesigner repository

2. **Configuration**
   - `.travis.yml` file is already configured
   - Builds run automatically on push to main/develop branches

3. **Environment Variables**
   - Set in Travis CI dashboard:
     - `DOCKER_USERNAME`
     - `DOCKER_PASSWORD`
     - `DOCKER_EMAIL`
   - Database credentials for testing
   - API keys for services

4. **Notifications**
   - Slack webhook (set in `.travis.yml`)
   - Email notifications on build failure

### Build Matrix

Builds run for:
- Backend (NestJS): `npm lint`, `npm test:cov`, `npm build`
- Frontend (React): `npm lint`, `npm test:cov`, `npm build`

### Docker Image Deployment

On successful build to `main` branch:
- Builds Docker image
- Pushes to Docker Hub as `presentationdesigner:latest`
- Tags with version `v{BUILD_NUMBER}`

### Logs

View build logs at: `https://travis-ci.com/github/{owner}/PresentationDesigner`

---

## Doppler Secrets Management

**Purpose**: Securely manage environment variables across dev/staging/production.

### Setup

1. **Install Doppler CLI**
   ```bash
   npm install -g doppler-cli
   ```

2. **Create Doppler Project**
   - Go to https://doppler.com
   - Create project: `presentation-designer`
   - Create configs: `dev`, `stg`, `prd`

3. **Authenticate**
   ```bash
   doppler login
   ```

4. **Sync Secrets**
   ```bash
   cd backend-nest
   doppler secrets set --config dev
   ```

### Usage

**Fetch Secrets in Terminal:**
```bash
doppler run -- npm start
```

**Sync to Local .env:**
```bash
doppler secrets download --format dotenv > .env.local
```

**In CI/CD (GitHub Actions):**
```yaml
- name: Fetch secrets
  env:
    DOPPLER_TOKEN: ${{ secrets.DOPPLER_TOKEN_PROD }}
  run: |
    doppler secrets download --format dotenv --config prd > .env.production
```

### Required Secrets

Doppler will warn if these are missing:
- `DATABASE_URL`
- `JWT_SECRET`
- `OPENAI_API_KEY`
- `STRIPE_SECRET_KEY`
- `NEW_RELIC_LICENSE_KEY`
- All API keys and credentials

### Features

- **Automatic Backups**: All changes tracked
- **Secret Rotation**: Rotate keys by date
- **Audit Logs**: See who accessed what, when
- **Sync**: Auto-sync to GitHub Actions, Docker, K8s
- **Redaction**: Logs automatically hide sensitive values

---

## ImgBot Image Optimization

**Purpose**: Automatically optimize images in PRs to reduce bundle size.

### Setup

1. **Enable ImgBot**
   - Go to https://imgbot.net
   - Connect your GitHub account
   - Select PresentationDesigner repository

2. **Configuration**
   - `imgbot.yml` file configures behavior
   - Currently set to optimize weekly
   - Ignores node_modules, dist, build directories

### How It Works

- When PR is opened with images, ImgBot analyzes them
- Creates a commit with optimized versions
- Runs lossless compression by default
- Configurable minimum KB reduction (currently 10 KB)

### Configuration Options

In `imgbot.yml`:
```yaml
schedule:
  interval: weekly          # Frequency of optimization

minKBReduction: 10          # Minimum KB reduction required

aggressiveCompression: false # Lossy compression (smaller but reduced quality)

compressWEBP: true          # Optimize WebP images

jpegProgressive: true       # Create progressive JPEGs
```

### Dashboard
- View optimization details in PR comments
- No manual action needed - automatic commits

---

## Termius SSH Terminal

**Purpose**: Secure remote access to servers without storing credentials locally.

### Setup

1. **Install Termius**
   - Download from https://termius.com/
   - Available for Windows, Mac, Linux, iOS, Android

2. **Create Account**
   - Sign up at https://termius.com
   - Enables cross-device sync of connections

3. **Add Server**
   ```
   Host: your-server-ip
   Username: deploy-user
   Authentication: Key or Password
   Key: Your SSH private key
   Port: 22 (or custom)
   ```

4. **Features**
   - End-to-end encrypted sync across devices
   - Authentication through Termius vault
   - Supports SSH keys, passwords, and 2FA
   - Port forwarding and SOCKS proxy
   - Snippet library for common commands

### Usage

**Connect to Production Server:**
```
Server: PresentationDesigner-Prod
IP: your-production-ip
User: deploy-user
Key: Your SSH key (stored in Termius vault)
```

**Common Production Commands:**
```bash
# View logs
ssh deploy@server "tail -f /var/log/app.log"

# Restart service
ssh deploy@server "systemctl restart presentation-designer"

# Database backup
ssh deploy@server "pg_dump -U dbuser dbname > backup.sql"
```

### Security Best Practices

- Use SSH keys instead of passwords
- Enable 2FA in Termius account
- Regularly rotate SSH keys
- Limit SSH access by IP
- Use bastion host for internal servers
- Store SSH keys in secure vault

---

## Environment Variables Summary

Create `.env` file with:

```env
# New Relic
NEW_RELIC_ENABLED=true
NEW_RELIC_LICENSE_KEY=

# TestMail
TESTMAIL_ENABLED=true
TESTMAIL_API_KEY=
TESTMAIL_NAMESPACE=presentation-designer

# Doppler (Development)
DOPPLER_TOKEN=

# Other services...
DATABASE_URL=
JWT_SECRET=
OPENAI_API_KEY=
STRIPE_SECRET_KEY=
```

---

## Troubleshooting

### New Relic Not Reporting
- Check license key is correct
- Verify `NEW_RELIC_ENABLED=true`
- Check logs in `./logs/newrelic.log`
- Ensure `newrelic` package is installed

### TestMail Emails Not Received
- Verify API key is correct
- Check namespace matches configuration
- Confirm email is sent to correct address pattern
- Test with API health check

### Travis CI Builds Failing
- Check build logs on travis-ci.com
- Verify environment variables are set
- Ensure Docker Hub credentials are correct
- Check database migrations run properly

### Doppler Secrets Not Syncing
- Verify `doppler login` completed
- Check config exists (dev, stg, prd)
- Use `doppler status` to verify connection
- Check token hasn't expired

---

## Support

For more information:
- New Relic: https://docs.newrelic.com/
- TestMail: https://testmail.app/api/
- Travis CI: https://docs.travis-ci.com/
- Doppler: https://docs.doppler.com/
- ImgBot: https://imgbot.net/
- Termius: https://termius.com/support/
