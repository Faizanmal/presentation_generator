# API Quick Reference: Email & OTP

## 🔐 Authentication Endpoints

### Traditional Auth

```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "name": "John Doe",
  "password": "strongpassword123"
}
```

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "strongpassword123"
}
```

### OTP Login (Passwordless)

**Step 1: Request OTP**
```http
POST /auth/otp/request
Content-Type: application/json

{
  "email": "user@example.com"
}

Response: {
  "success": true,
  "message": "Verification code sent to your email.",
  "expiresInSeconds": 300
}
```

**Step 2: Verify OTP & Login**
```http
POST /auth/otp/verify
Content-Type: application/json

{
  "email": "user@example.com",
  "otp": "123456"
}

Response: {
  "accessToken": "eyJhbG...",
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "name": "John Doe",
    "image": null
  }
}
```

### Password Reset (OTP-Based)

**Step 1: Request Reset Code**
```http
POST /auth/password/reset-request
Content-Type: application/json

{
  "email": "user@example.com"
}

Response: {
  "success": true,
  "message": "Password reset code sent to your email.",
  "expiresInSeconds": 300
}
```

**Step 2: Reset Password with OTP**
```http
POST /auth/password/reset
Content-Type: application/json

{
  "email": "user@example.com",
  "otp": "123456",
  "newPassword": "newstrongpassword456"
}

Response: {
  "success": true,
  "message": "Password has been reset successfully..."
}
```

---

## 📧 OTP Endpoints (Generic)

### Email OTP

```http
# Request OTP
POST /otp/email/request
Content-Type: application/json

{
  "email": "user@example.com",
  "purpose": "email_verification"  // optional
}
```

```http
# Verify OTP
POST /otp/email/verify
Content-Type: application/json

{
  "email": "user@example.com",
  "otp": "123456",
  "purpose": "email_verification"  // optional
}
```

### SMS OTP

```http
# Request OTP
POST /otp/sms/request
Content-Type: application/json

{
  "phone": "+1234567890",
  "purpose": "phone_verification"  // optional
}
```

```http
# Verify OTP
POST /otp/sms/verify
Content-Type: application/json

{
  "phone": "+1234567890",
  "otp": "123456",
  "purpose": "phone_verification"  // optional
}
```

### OTP Status

```http
GET /otp/status?identifier=user@example.com&channel=email&purpose=login

Response: {
  "hasActiveOtp": true,
  "expiresInSeconds": 245,
  "canResend": false,
  "resendAfterSeconds": 32
}
```

---

## 🎯 OTP Purposes

- `login` - Passwordless login
- `register` - Registration verification
- `password_reset` - Password reset flow
- `email_verification` - Verify email address
- `phone_verification` - Verify phone number
- `two_factor` - Two-factor authentication

---

## ⚡ Rate Limits

| Endpoint | Limit |
|----------|-------|
| `/auth/otp/request` | 3 requests/minute |
| `/auth/otp/verify` | 5 attempts/minute |
| `/auth/password/reset-request` | 3 requests/minute |
| `/auth/password/reset` | 5 attempts/minute |
| `/otp/email/request` | 3 requests/minute |
| `/otp/email/verify` | 5 attempts/minute |
| `/otp/sms/request` | 3 requests/minute |
| `/otp/sms/verify` | 5 attempts/minute |

---

## 🛡️ Security Features

- ✅ **Rate Limiting**: Prevents spam and abuse
- ✅ **Resend Cooldown**: 60 seconds between OTP requests
- ✅ **Max Attempts**: 5 verification attempts before lockout
- ✅ **Auto Lockout**: 30-minute lockout after max attempts
- ✅ **Constant-Time Comparison**: Prevents timing attacks
- ✅ **Email Enumeration Protection**: Neutral responses
- ✅ **One-Time Use**: OTPs deleted after verification
- ✅ **Automatic Expiration**: 5-minute OTP validity

---

## 📋 Common Response Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `400` | Invalid OTP or request |
| `409` | Email already registered |
| `429` | Too many requests (rate limit) |
| `401` | Invalid credentials |

---

## 🧪 Frontend Integration Example

```typescript
// Passwordless Login Flow
async function loginWithOTP(email: string, otp: string) {
  try {
    // Step 1: Request OTP
    const requestRes = await fetch('/api/auth/otp/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const requestData = await requestRes.json();
    
    if (!requestData.success) {
      throw new Error(requestData.message);
    }
    
    // User receives OTP via email, enters it in UI
    
    // Step 2: Verify OTP
    const verifyRes = await fetch('/api/auth/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp })
    });
    const verifyData = await verifyRes.json();
    
    if (verifyData.accessToken) {
      // Store token, redirect to dashboard
      localStorage.setItem('token', verifyData.accessToken);
      router.push('/dashboard');
    }
  } catch (error) {
    console.error('Login failed:', error);
  }
}
```

---

## 💡 Tips

1. **Check OTP status** before allowing resend
2. **Display countdown timer** using `expiresInSeconds`
3. **Show remaining attempts** on failed verification
4. **Handle lockout gracefully** with clear messaging
5. **Validate OTP format** (6 digits) on frontend before submitting
