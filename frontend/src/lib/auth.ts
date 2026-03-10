/**
 * @deprecated - Use `@/stores/auth-store` directly instead.
 * This file re-exports from the canonical auth store for backward compatibility.
 */
export { useAuthStore } from '@/stores/auth-store';

import type { AuthResponse as _AuthResponse, LoginCredentials as _LoginCredentials, RegisterCredentials as _RegisterCredentials } from '@/types';

export type { _AuthResponse as AuthResponse, _LoginCredentials as LoginCredentials, _RegisterCredentials as RegisterCredentials };

/** @deprecated Use RegisterCredentials from @/types */
export type SignUpData = _RegisterCredentials;
/** @deprecated Use LoginCredentials from @/types */
export type SignInData = _LoginCredentials;
