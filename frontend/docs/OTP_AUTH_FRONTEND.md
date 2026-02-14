# Frontend: OTP Authentication & Password Reset

This document covers the frontend implementation of OTP-based authentication and password reset functionality.

---

## 📁 Files Added/Modified

### New Files
```
src/app/password-reset/page.tsx    # Password reset flow (2-step)
```

### Modified Files
```
src/app/login/page.tsx              # Added OTP login tab
src/lib/api.ts                      # Added 4 new API methods
src/stores/auth-store.ts            # Added loginWithOtp action
src/app/globals.css                 # Enhanced with Tailwind variables
```

---

## 🔐 Authentication Features

### 1. **Traditional Email/Password Login**
- Standard login with email and password
- Form validation using `react-hook-form` + `zod`
- Error handling with toast notifications

### 2. **OTP (Passwordless) Login**
- **Two-step process:**
  1. Request OTP code by email
  2. Verify OTP code to login
- Tab-based UI to switch between Password and OTP modes
- 6-digit numeric code validation
- Resend capability (with cooldown)
- Rate limiting feedback

### 3. **Password Reset via OTP**
- **Two-step process:**
  1. Request reset code by email
  2. Verify code and set new password
- Password confirmation validation
- Security messaging

### 4. **Google OAuth**
- One-click Google sign-in
- Server-side OAuth flow

---

## 🎨 UI Components

### Login Page (`/login`)

**Features:**
- Split-screen design (form left, gradient right)
- Tab switcher for Password vs OTP login
- Responsive layout
- Dark mode support
- Modern gradient backgrounds
- Icon-enhanced inputs
- Password visibility toggle

**Tabs:**
- **Password Tab:** Email + Password fields
- **OTP Tab:** 
  - Step 1: Email input → Send code
  - Step 2: 6-digit code input → Verify & login

### Password Reset Page (`/password-reset`)

**Features:**
- Centered card layout
- Two-step flow:
  - **Step 1:** Enter email → Request code
  - **Step 2:** Enter code + new password → Reset
- Password confirmation matching
- Clean, focused UI

---

## 🔌 API Integration

### New API Methods (`src/lib/api.ts`)

```typescript
// Request OTP for passwordless login
async requestOtpLogin(email: string): Promise<{
  success: boolean;
  message: string;
  expiresInSeconds?: number;
}>

// Verify OTP and login
async verifyOtpLogin(email: string, otp: string): Promise<AuthResponse>

// Request password reset code
async requestPasswordReset(email: string): Promise<{
  success: boolean;
  message: string;
  expiresInSeconds?: number;
}>

// Reset password with OTP
async resetPassword(
  email: string,
  otp: string,
  newPassword: string
): Promise<{ success: boolean; message: string }>
```

### Auth Store Integration (`src/stores/auth-store.ts`)

**New Action:**
```typescript
loginWithOtp: async (email: string, otp: string) => Promise<void>
```

**How it works:**
1. Calls `api.verifyOtpLogin(email, otp)`
2. Sets JWT token in localStorage via API client
3. Updates Zustand store with user data
4. Marks user as authenticated
5. Fetches subscription data

---

## 🎯 User Flows

### OTP Login Flow

```
1. User clicks "One-Time Code" tab
2. Enters email → Clicks "Send Login Code"
   ↓
3. Frontend calls: POST /auth/otp/request
   ↓
4. Backend sends 6-digit code via email
   ↓
5. User receives email (from otp.hbs template)
   ↓
6. User enters code → Clicks "Verify & Login"
   ↓
7. Frontend calls: POST /auth/otp/verify
   ↓
8. Backend validates code
   ↓
9. Frontend receives JWT token + user data
   ↓
10. User redirected to /dashboard
```

### Password Reset Flow

```
1. User navigates to /password-reset
2. Enters email → Clicks "Send Reset Code"
   ↓
3. Frontend calls: POST /auth/password/reset-request
   ↓
4. Backend sends 6-digit code via email
   ↓
5. User receives email (from password-reset.hbs template)
   ↓
6. User enters code + new password → Clicks "Reset Password"
   ↓
7. Frontend calls: POST /auth/password/reset
   ↓
8. Backend validates code and updates password
   ↓
9. User redirected to /login with success message
```

---

## 🛡️ Security Features

### Client-Side Validation

**OTP Input:**
- Exactly 6 digits required
- Numeric only
- Pattern: `^[0-9]{6}$`

**Password:**
- Minimum 8 characters
- Confirmation must match

**Email:**
- Valid email format required

### Error Handling

```typescript
try {
  await loginWithOtp(email, otp);
  toast.success("Logged in successfully!");
  router.push("/dashboard");
} catch (error: any) {
  // Display backend error message or fallback
  toast.error(error.response?.data?.message || "Invalid code");
}
```

### Rate Limiting Feedback

- Backend rate limits are transparent to users
- Error messages show cooldown periods:
  - "Please wait 45 seconds before requesting another code"
  - "Too many attempts. Try again in 28 minutes"

---

## 🎨 Styling

### Tailwind Configuration

Updated `globals.css` with:
- Complete design token system
- Light/dark mode variables
- Custom gradient utilities:
  ```css
  .bg-linear-to-br { /* gradient to bottom-right */ }
  .bg-linear-to-r  { /* gradient to right */ }
  ```

### Color Palette

**Light Mode:**
- Background: `hsl(0 0% 100%)`
- Foreground: `hsl(222.2 84% 4.9%)`
- Primary: `hsl(222.2 47.4% 11.2%)`

**Dark Mode:**
- Background: `hsl(222.2 84% 4.9%)`
- Foreground: `hsl(210 40% 98%)`
- Primary: `hsl(210 40% 98%)`

---

## 📦 Dependencies Used

```json
{
  "react-hook-form": "Form state management",
  "@hookform/resolvers": "Zod integration",
  "zod": "Schema validation",
  "sonner": "Toast notifications",
  "lucide-react": "Icons",
  "@radix-ui/react-tabs": "Tab UI component",
  "zustand": "State management",
  "axios": "HTTP client"
}
```

---

## 🧪 Testing Checklist

### OTP Login
- [ ] Request OTP with valid email
- [ ] Request OTP with invalid email
- [ ] Verify correct OTP code
- [ ] Verify incorrect OTP code
- [ ] Test rate limiting (multiple requests)
- [ ] Test cooldown period
- [ ] Test OTP expiration (after 5 minutes)
- [ ] Test max attempts lockout

### Password Reset
- [ ] Request reset with valid email
- [ ] Request reset with invalid email
- [ ] Reset with correct OTP
- [ ] Reset with incorrect OTP
- [ ] Password confirmation matching
- [ ] Password validation (min 8 chars)

### UI/UX
- [ ] Tab switching works smoothly
- [ ] Form validation shows errors
- [ ] Loading states display correctly
- [ ] Toast notifications appear
- [ ] Responsive on mobile
- [ ] Dark mode works
- [ ] Icons render correctly

---

## 🚀 Running Locally

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies (if needed)
npm install

# Start development server
npm run dev

# Open browser
http://localhost:3000/login
```

### Environment Variables

Create `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

---

## 📱 Mobile Responsive

All components are fully responsive:
- **Desktop:** Split-screen layout with gradient
- **Mobile:** Single column, full-width forms
- **Tablet:** Adaptive layout

Tailwind breakpoints:
- `lg:` - Desktop (gradient sidebar shows)
- Default - Mobile/tablet (form only)

---

## 🎨 Design Highlights

### Modern UI Features
- **Glassmorphism cards** with subtle borders
- **Smooth gradients** (blue → purple)
- **Icon-enhanced inputs** for better UX
- **Animated loading states** with spinners
- **Micro-animations** on hover/focus
- **Professional typography** (Inter font)

### Accessibility
- Proper ARIA labels
- Keyboard navigation support
- Focus indicators
- High contrast colors
- Semantic HTML

---

## 🔗 Related Documentation

- **Backend API:** `backend-nest/docs/API_REFERENCE_OTP.md`
- **Email System:** `backend-nest/docs/EMAIL_OTP_SYSTEM.md`
- **Implementation Summary:** `backend-nest/docs/IMPLEMENTATION_SUMMARY.md`

---

## 💡 Tips for Developers

1. **Always validate on both client and server**
   - Client validation for UX
   - Server validation for security

2. **Use the auth store for consistency**
   - Don't bypass the store with direct API calls
   - Keeps state synchronized

3. **Handle errors gracefully**
   - Show user-friendly messages
   - Don't expose technical details

4. **Test rate limiting**
   - Ensure cooldown messages are clear
   - Test both success and error states

5. **Update email templates**
   - Keep branding consistent
   - Test on multiple email clients

---

**Frontend Implementation Complete! 🎉**
