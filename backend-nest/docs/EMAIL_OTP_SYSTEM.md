# Email Worker & OTP System

This document outlines the email worker and OTP (One-Time Password) authentication system implemented using BullMQ, Redis, and NestJS.

---

## 📧 Email Worker (BullMQ)

### Features

- **Asynchronous Email Delivery**: All emails are queued via BullMQ and processed by background workers
- **Priority Queue**: Critical emails (OTP, password reset) get higher priority
- **Automatic Retries**: Failed emails retry with exponential backoff
- **Rate Limiting**: 30 emails per minute to prevent abuse
- **Concurrency Control**: 5 concurrent email processing jobs
- **Job Tracking**: Monitor job status, progress, and failures
- **Auto-Cleanup**: Completed/failed jobs are automatically removed after retention period

### Supported Email Types

| Email Type         | Template              | Priority | Use Case                          |
|--------------------|-----------------------|----------|-----------------------------------|
| OTP                | `otp.hbs`             | 1 (High) | Verification codes                |
| Password Reset     | `password-reset.hbs`  | 1 (High) | Password reset links              |
| Email Verification | `email-verification.hbs` | 2      | Email address verification        |
| Welcome            | `welcome.hbs`         | 3        | New user onboarding               |
| Project Shared     | `project-shared.hbs`  | 3        | Collaboration notifications       |
| Team Invite        | `team-invite.hbs`     | 3        | Team membership invites           |
| Notification       | `notification.hbs`    | 5        | Generic notifications             |
| Bulk Email         | Any template          | 10 (Low) | Mass emails (newsletters, etc.)   |

### Usage Examples

```typescript
// Send OTP email
await emailService.sendOtpEmail('user@example.com', '123456', 5);

// Send welcome email
await emailService.sendWelcomeEmail('user@example.com', 'John', 'https://app.com/dashboard');

// Send password reset
await emailService.sendPasswordResetEmail('user@example.com', 'John', 'https://app.com/reset?token=xyz', 30);

// Send custom notification
await emailService.sendNotificationEmail(
  'user@example.com',
  'John',
  'Payment Successful',
  'Your subscription has been renewed.',
  'https://app.com/billing',
  'View Receipt'
);

// Bulk email
await emailService.sendBulkEmail(
  [
    { to: 'user1@example.com', context: { name: 'Alice' } },
    { to: 'user2@example.com', context: { name: 'Bob' } },
  ],
  'Monthly Newsletter',
  'newsletter',
  { month: 'February', year: 2026 }
);
```

### Queue Monitoring

```typescript
// Get queue statistics
const stats = await emailService.getQueueStats();
// Returns: { waiting, active, completed, failed, delayed }

// Check job status
const jobStatus = await emailService.getJobStatus('job-id-12345');
```

---

## 🔐 OTP System

### Features

- **Multi-Channel Support**: Email and SMS OTP delivery
- **Purpose-Scoped OTPs**: Different OTP codes for login, registration, password reset, etc.
- **Rate Limiting**: Max 10 OTP requests per hour per identifier
- **Resend Cooldown**: 60-second cooldown between resend attempts
- **Max Attempts**: 5 verification attempts before lockout
- **Auto-Lockout**: 30-minute lockout after exceeding max attempts
- **Expiration**: OTPs expire after 5 minutes
- **Constant-Time Comparison**: Prevents timing attacks
- **Masked Identifiers**: Hides full email/phone in responses

### OTP Purposes

```typescript
enum OtpPurpose {
    LOGIN = 'login',
    REGISTER = 'register',
    PASSWORD_RESET = 'password_reset',
    EMAIL_VERIFICATION = 'email_verification',
    PHONE_VERIFICATION = 'phone_verification',
    TWO_FACTOR = 'two_factor',
}
```

### API Endpoints

#### Generic OTP Endpoints

```
POST /otp/request
Body: { identifier: string, channel: 'email' | 'sms', purpose?: OtpPurpose }

POST /otp/verify
Body: { identifier: string, otp: string, purpose?: OtpPurpose }

GET /otp/status?identifier=user@example.com&channel=email&purpose=login
Returns: { hasActiveOtp, expiresInSeconds, canResend, resendAfterSeconds }
```

#### Email OTP Endpoints

```
POST /otp/email/request
Body: { email: string, purpose?: OtpPurpose }

POST /otp/email/verify
Body: { email: string, otp: string, purpose?: OtpPurpose }
```

#### SMS OTP Endpoints

```
POST /otp/sms/request
Body: { phone: string, purpose?: OtpPurpose }

POST /otp/sms/verify
Body: { phone: string, otp: string, purpose?: OtpPurpose }
```

### Auth Integration

The OTP system is integrated into the auth flow for passwordless login and password reset.

#### Passwordless Login (OTP)

```
1. POST /auth/otp/request
   Body: { email: "user@example.com" }
   
2. POST /auth/otp/verify
   Body: { email: "user@example.com", otp: "123456" }
   Returns: { accessToken, user }
```

#### Password Reset (OTP)

```
1. POST /auth/password/reset-request
   Body: { email: "user@example.com" }
   
2. POST /auth/password/reset
   Body: { email: "user@example.com", otp: "123456", newPassword: "newpass123" }
   Returns: { success: true, message: "..." }
```

### Security Features

1. **Email Enumeration Prevention**: Neutral messages on OTP request (doesn't reveal if email exists)
2. **Rate Limiting**: Via `@Throttle` decorator on all endpoints
3. **Lockout Protection**: Auto-lockout after 5 failed attempts for 30 minutes
4. **Constant-Time Comparison**: Prevents timing attacks on OTP verification
5. **One-Time Use**: OTPs are deleted after successful verification
6. **Redis Storage**: Fast, ephemeral storage with automatic expiration

---

## 🛠️ Configuration

### Environment Variables

```env
# Email (SMTP)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=your-email@gmail.com
MAIL_PASS=your-app-password
MAIL_FROM=noreply@presentationdesigner.com
MAIL_FROM_NAME=Presentation Designer

# SMS (Twilio)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Redis (for OTP storage & BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:3000
```

### Redis Setup

Ensure Redis is running:

```bash
# Windows (using WSL or Docker)
docker run -d -p 6379:6379 redis:alpine

# Or install Redis locally
```

---

## 📊 Monitoring & Debugging

### BullMQ Board (Optional)

For a visual dashboard of your email queue:

```bash
npm install -g bull-board
bull-board --redis redis://localhost:6379
```

### Logs

All email and OTP operations are logged:

```
[EmailService] Queued OTP email job abc123 → user@example.com
[EmailProcessor] ✓ Email sent → user@example.com [Your Verification Code]
[OtpService] OTP generated for user@example.com via email [purpose: login]
[OtpService] OTP verified for user@example.com [purpose: login]
```

### Redis Keys

- `otp:{purpose}:{identifier}` - Stored OTP value
- `otp:attempts:{identifier}:{purpose}` - Failed attempt counter
- `otp:cooldown:{identifier}:{purpose}` - Resend cooldown
- `otp:ratelimit:{identifier}` - Rate limit counter
- `otp:lockout:{identifier}:{purpose}` - Lockout flag

---

## 🧪 Testing

### Test OTP Flow (Development)

When Twilio is not configured, SMS messages are logged to console instead of sent.

```bash
# Start the backend
npm run start:dev

# Request OTP
curl -X POST http://localhost:4000/otp/email/request \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","purpose":"login"}'

# Check console logs for the OTP code, then verify:
curl -X POST http://localhost:4000/otp/email/verify \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","otp":"123456","purpose":"login"}'
```

### Test Email Templates

Email templates are located in `src/email/templates/`. They use Handlebars syntax.

---

## 🎨 Email Templates

All templates follow a consistent design with:

- **Responsive Layout**: Mobile-friendly table-based layout
- **Brand Colors**: Purple gradient (`#6366f1` → `#8b5cf6`)
- **Security Warnings**: Clear expiration and security notices
- **Professional Typography**: Clean, readable fonts
- **Accessible Design**: High contrast, semantic HTML

### Customizing Templates

Edit any `.hbs` file in `src/email/templates/`. Variables are passed via the `context` parameter.

Example:

```handlebars
<h1>Hello {{name}}!</h1>
<p>Your verification code is: <strong>{{otp}}</strong></p>
<p>Expires in {{expiresInMinutes}} minutes.</p>
```

---

## 🚀 Production Checklist

- [ ] Configure production SMTP server
- [ ] Set up Twilio for SMS (optional)
- [ ] Configure Redis with persistence
- [ ] Set strong `REDIS_PASSWORD`
- [ ] Review rate limits based on expected traffic
- [ ] Set up monitoring for BullMQ queue health
- [ ] Configure email template branding
- [ ] Test all email flows end-to-end
- [ ] Set up dead-letter queue alerts
- [ ] Review OTP expiration times for your use case

---

## 📚 Architecture

```
┌─────────────────┐
│   Controller    │  (Auth, OTP endpoints)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│     Service     │  (Business logic)
└────────┬────────┘
         │
         ├──────────► EmailService ──► BullMQ Queue ──► EmailProcessor ──► SMTP
         │
         └──────────► OtpService ────► Redis (storage) ──► EmailService/SmsService
```

---

## 🤝 Support

For issues or questions:
- Check logs in console
- Review Redis keys with `redis-cli`
- Monitor BullMQ queue stats
- Verify environment variables are set correctly
