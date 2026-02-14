# Auth & Monitoring Enhancement - Complete Implementation Guide

## Overview

This document covers all the monitoring, security, and email infrastructure enhancements implemented for the Presentation Designer backend.

---

## 📦 New Files Created

| # | File | Purpose |
|---|------|---------|
| 1 | `src/email/email-provider.service.ts` | Multi-provider SMTP with automatic fallback |
| 2 | `src/email/email-tracking.service.ts` | Email delivery tracking with Redis |
| 3 | `src/otp/otp-metrics.service.ts` | OTP operation metrics |
| 4 | `src/common/monitoring/monitoring.module.ts` | Monitoring module (Sentry + Prometheus + Datadog) |
| 5 | `src/common/monitoring/monitoring.service.ts` | Unified monitoring service |
| 6 | `src/common/monitoring/metrics.service.ts` | Prometheus metrics (counters, histograms, gauges) |
| 7 | `src/common/monitoring/sentry.service.ts` | Sentry error tracking |
| 8 | `src/common/monitoring/monitoring.controller.ts` | `/monitoring/metrics` endpoint for Prometheus |
| 9 | `src/common/monitoring/admin-monitoring.controller.ts` | Admin dashboard API endpoints |
| 10 | `src/common/guards/recaptcha.guard.ts` | reCAPTCHA v2/v3 guard with `@RequireRecaptcha()` |
| 11 | `monitoring/prometheus.yml` | Prometheus scrape configuration |

## 📝 Modified Files

| File | Changes |
|------|---------|
| `src/email/email.processor.ts` | Multi-provider fallback + tracking + monitoring hooks |
| `src/email/email.module.ts` | Added EmailProviderService + EmailTrackingService |
| `src/email/templates/otp.hbs` | Enhanced with logo placeholder + security banner |
| `src/otp/otp.service.ts` | Integrated OTP metrics + monitoring |
| `src/otp/otp.module.ts` | Added OtpMetricsService |
| `src/auth/auth.controller.ts` | Added `@RequireRecaptcha()` to OTP endpoints |
| `src/auth/auth.module.ts` | Registered RecaptchaGuard |
| `src/common/redis/redis.module.ts` | Enhanced with auth toggle + retry strategy |
| `src/app.module.ts` | Added MonitoringModule |
| `.env` | Added 50+ new config variables |

---

## 🔌 Feature #2: Multi-Provider Email with Fallback

### How It Works

```
Primary SMTP → SendGrid → Mailgun → AWS SES → Brevo
     ↓              ↓           ↓         ↓        ↓
  Success?      Success?    Success?  Success? Success?
     ↓              ↓           ↓         ↓        ↓
   Done         Done         Done      Done     Done
```

### Circuit Breaker Pattern

- After **5 consecutive failures**, a provider's circuit breaker opens
- Circuit stays open for **5 minutes**, then enters half-open state
- One test request is allowed; success resets the circuit

### Configuration

```env
# Primary SMTP
MAIL_HOST="smtp.gmail.com"
MAIL_PORT=587
MAIL_ENABLED=true

# SendGrid (Fallback 1)
SENDGRID_API_KEY="your-api-key"
SENDGRID_ENABLED=true

# Mailgun (Fallback 2)
MAILGUN_SMTP_USER="your-user"
MAILGUN_SMTP_PASS="your-pass"
MAILGUN_ENABLED=true

# AWS SES (Fallback 3)
SES_SMTP_USER="your-user"
SES_SMTP_PASS="your-pass"
SES_ENABLED=true

# Brevo (Fallback 4)
BREVO_SMTP_USER="your-user"
BREVO_SMTP_PASS="your-pass"
BREVO_ENABLED=true
```

---

## 🎨 Feature #3: Email Template Customization

### Logo Support

All email templates now support a conditional `{{logoUrl}}` variable:

```handlebars
{{#if logoUrl}}
  <img src="{{logoUrl}}" alt="Logo" height="40" />
{{else}}
  <!-- Fallback icon -->
{{/if}}
```

### Configuration

```env
EMAIL_LOGO_URL="https://your-cdn.com/logo.png"
EMAIL_BRAND_COLOR="#6366f1"
```

---

## 🔒 Feature #4: Redis Password with Toggle

### Configuration

```env
REDIS_HOST="localhost"
REDIS_PORT=6379
REDIS_PASSWORD="your-secure-password"
REDIS_AUTH_ENABLED=true    # Set to false to skip auth
REDIS_DB=0
REDIS_KEY_PREFIX=""
```

### Features
- Automatic retry with exponential backoff
- Connection event logging (connect, error, close)
- Configurable key prefix for multi-tenant setups

---

## 🔑 Feature #5: Password Security Toggle

```env
PASSWORD_SECURITY_ENABLED=true  # Set to false to disable password complexity requirements
```

---

## 🤖 Feature #6: reCAPTCHA for OTP Requests

### Protected Endpoints

The `@RequireRecaptcha()` decorator is applied to:

| Endpoint | Purpose |
|----------|---------|
| `POST /auth/otp/request` | Request email OTP login |
| `POST /auth/otp/request-multi` | Request multi-channel OTP |
| `POST /auth/password/reset-request` | Request password reset |

### Frontend Integration

Send the reCAPTCHA token in the request body or header:

```typescript
// Option 1: In request body
const response = await api.post('/auth/otp/request', {
  email: 'user@example.com',
  recaptchaToken: token  // From reCAPTCHA widget
});

// Option 2: In header
const response = await api.post('/auth/otp/request', data, {
  headers: { 'x-recaptcha-token': token }
});
```

### Configuration

```env
RECAPTCHA_ENABLED=false          # Toggle on/off
RECAPTCHA_SECRET_KEY="your-key"
RECAPTCHA_SITE_KEY="your-key"
RECAPTCHA_MIN_SCORE=0.5          # v3 score threshold (0.0-1.0)
RECAPTCHA_FAIL_OPEN=true         # Allow requests if reCAPTCHA API is down
```

---

## 📊 Feature #7: Email Delivery Tracking

### What's Tracked

| Event | Description |
|-------|-------------|
| `sent` | Email successfully sent |
| `failed` | Send attempt failed |
| `delivered` | Delivery confirmed (webhook) |
| `opened` | Email opened (webhook) |
| `clicked` | Link clicked (webhook) |
| `bounced` | Email bounced (webhook) |

### API Endpoints

```
GET /admin/monitoring/email/stats         # Overall stats
GET /admin/monitoring/email/daily?days=30 # Daily trend data
GET /admin/monitoring/email/recipient?email=user@... # Per-recipient history
GET /admin/monitoring/email/providers     # Provider health
GET /admin/monitoring/email/queue         # Queue status
```

### Sample Response `GET /admin/monitoring/email/stats`

```json
{
  "totalSent": 1523,
  "totalFailed": 12,
  "totalBounced": 3,
  "totalOpened": 890,
  "totalClicked": 234,
  "deliveryRate": 99.2,
  "openRate": 58.4,
  "clickRate": 26.3,
  "byProvider": {
    "primary": { "sent": 1500, "failed": 10 },
    "sendgrid": { "sent": 23, "failed": 2 }
  },
  "byType": {
    "send-otp": { "sent": 500, "failed": 3 },
    "send-welcome": { "sent": 200, "failed": 1 }
  }
}
```

---

## 📈 Feature #8: OTP Metrics

### What's Tracked

| Event | Description |
|-------|-------------|
| `requested` | OTP code requested |
| `sent` | OTP code sent successfully |
| `verified` | OTP verification successful |
| `failed` | OTP verification failed (wrong code) |
| `expired` | OTP expired |
| `locked_out` | Account locked after max attempts |
| `rate_limited` | Request rate limited |

### API Endpoints

```
GET /admin/monitoring/otp/stats          # Overall OTP metrics
GET /admin/monitoring/otp/daily?days=30  # Daily trend data
GET /admin/monitoring/otp/recent?limit=20 # Recent events
```

---

## 📡 Feature #9: Monitoring Integration

### Sentry (Error Tracking)

```env
SENTRY_DSN="https://xxxx@sentry.io/xxxx"
SENTRY_ENABLED=true
SENTRY_TRACES_SAMPLE_RATE=0.1
```

Features:
- Automatic exception capture
- Sensitive data scrubbing (auth headers, cookies)
- User context tracking
- Breadcrumbs for debugging
- Transaction tracing

### Prometheus / Grafana (Metrics)

**Scrape endpoint:** `GET /monitoring/metrics`

```env
METRICS_ENABLED=true
```

Pre-defined metrics:
- `http_request_duration_seconds` — HTTP latency histogram
- `http_requests_total` — Request counter by method/route/status
- `email_sent_total` — Emails sent by type/provider
- `email_failed_total` — Email failures
- `otp_requested_total` — OTP requests by channel/purpose
- `otp_verified_total` — Successful OTP verifications
- `otp_failed_total` — Failed OTP verifications
- `queue_jobs_total` — Queue job completion/failure
- `queue_job_duration_seconds` — Job processing time
- `redis_command_duration_seconds` — Redis latency
- `db_query_duration_seconds` — Database query latency

### Grafana Setup

1. Start Prometheus with the provided `monitoring/prometheus.yml`
2. Add Prometheus as a data source in Grafana
3. Import dashboards using the pre-defined metrics above

### Datadog (APM)

```env
DATADOG_API_KEY="your-key"
DATADOG_APP_KEY="your-key"
```

### Public Endpoints

| Endpoint | Purpose | Auth |
|----------|---------|------|
| `GET /monitoring/metrics` | Prometheus scrape | None |
| `GET /monitoring/health` | Health check | None |
| `GET /monitoring/metrics/json` | JSON metrics | None |

### Admin Endpoints (JWT Required)

| Endpoint | Purpose |
|----------|---------|
| `GET /admin/monitoring/dashboard` | Full dashboard data |
| `GET /admin/monitoring/email/stats` | Email statistics |
| `GET /admin/monitoring/email/daily` | Email daily trends |
| `GET /admin/monitoring/email/providers` | Provider health |
| `GET /admin/monitoring/email/queue` | Queue status |
| `GET /admin/monitoring/otp/stats` | OTP metrics |
| `GET /admin/monitoring/otp/daily` | OTP daily trends |
| `GET /admin/monitoring/otp/recent` | Recent OTP events |

---

## 🏃 Rate Limiting Summary

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /auth/otp/request` | 3 req | 60s |
| `POST /auth/otp/verify` | 5 req | 60s |
| `POST /auth/otp/request-multi` | 3 req | 60s |
| `POST /auth/otp/verify-multi` | 5 req | 60s |
| `POST /auth/password/reset-request` | 3 req | 60s |
| `POST /auth/password/reset` | 5 req | 60s |
| Global (short) | 10 req | 1s |
| Global (medium) | 50 req | 10s |
| Global (long) | 100 req | 60s |
| OTP per identifier | 10 req | 1 hour |

---

## 🧪 Testing

```bash
# Verify build
npx tsc --noEmit

# Check monitoring health
curl http://localhost:3001/monitoring/health

# Check Prometheus metrics
curl http://localhost:3001/monitoring/metrics

# Check admin dashboard (requires JWT)
curl -H "Authorization: Bearer <token>" http://localhost:3001/admin/monitoring/dashboard
```
