import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// we don't have official TS types for samlify so define minimal interfaces
interface ServiceProviderInstance {
  createLoginRequest(
    idp: unknown,
    binding: string,
  ): { context: string; relayState?: string };
  parseLoginResponse(
    idp: unknown,
    binding: string,
    req: { body: { SAMLResponse: string } },
  ): Promise<{
    extract: { nameID?: string; attributes?: Record<string, unknown> };
  }>;
  createLogoutRequest(
    idp: unknown,
    binding: string,
    user: { name_id: string },
  ): { context: string };
  getMetadata?: () => string;
}

interface IdentityProviderInstance {
  getMetadata?: () => string;
}

interface SamlifyStatic {
  ServiceProvider: (opts: Record<string, unknown>) => ServiceProviderInstance;
  IdentityProvider: (opts: Record<string, unknown>) => IdentityProviderInstance;
  Constants: {
    BindingNamespace: {
      Post: string;
      Redirect: string;
    };
  };
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const saml: SamlifyStatic = require('samlify');

export interface SamlConfig {
  entityId: string;
  ssoServiceUrl: string;
  certificate: string;
  privateKey?: string;
}

export interface SamlUserProfile {
  nameId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  attributes?: Record<string, unknown>;
}

/**
 * SAML (Security Assertion Markup Language) Service
 * Enables Enterprise Single Sign-On (SSO)
 */
@Injectable()
export class SamlService {
  private readonly logger = new Logger(SamlService.name);
  private readonly serviceProvider: ServiceProviderInstance;
  private readonly identityProviders: Map<string, IdentityProviderInstance> =
    new Map();

  constructor(private readonly configService: ConfigService) {
    // Initialize Service Provider (SP) - this is our application
    const spEntityId =
      this.configService.get<string>('SAML_SP_ENTITY_ID') ||
      'presentation-designer-saas';
    const spAssertionUrl =
      this.configService.get<string>('SAML_SP_ASSERTION_URL') ||
      'https://yourdomain.com/api/auth/saml/callback';

    this.serviceProvider = saml.ServiceProvider({
      entityID: spEntityId,
      authnRequestsSigned: false,
      wantAssertionsSigned: true,
      wantMessageSigned: true,
      wantLogoutResponseSigned: true,
      wantLogoutRequestSigned: true,
      assertionConsumerService: [
        {
          Binding: saml.Constants.BindingNamespace.Post,
          Location: spAssertionUrl,
        },
      ],
    });

    this.logger.log('✓ SAML service initialized');
  }

  /**
   * Register Identity Provider (IdP)
   * Used for enterprise customers with their own IdP (Okta, Azure AD, etc.)
   */
  registerIdentityProvider(tenantId: string, config: SamlConfig): void {
    const idp = saml.IdentityProvider({
      entityID: config.entityId,
      singleSignOnService: [
        {
          Binding: saml.Constants.BindingNamespace.Redirect,
          Location: config.ssoServiceUrl,
        },
      ],
      signingCert: config.certificate,
    });

    this.identityProviders.set(tenantId, idp);
    this.logger.log(`✓ Identity Provider registered for tenant: ${tenantId}`);
  }

  /**
   * Generate SAML authentication request
   * Redirects user to IdP login page
   */
  generateAuthRequest(tenantId: string): {
    loginUrl: string;
    relayState?: string;
  } {
    const idp = this.identityProviders.get(tenantId);
    if (!idp) {
      throw new Error(`Identity Provider not found for tenant: ${tenantId}`);
    }

    const sp = this.serviceProvider as {
      createLoginRequest: (
        idp: unknown,
        binding: string,
      ) => { context: string; relayState?: string };
    };

    const { context, relayState } = sp.createLoginRequest(
      idp,
      saml.Constants.BindingNamespace.Redirect,
    );

    return {
      loginUrl: context,
      relayState,
    };
  }

  /**
   * Process SAML response from IdP
   * Validates assertion and extracts user profile
   */
  async processSamlResponse(
    tenantId: string,
    samlResponse: string,
  ): Promise<SamlUserProfile> {
    const idp = this.identityProviders.get(tenantId);
    if (!idp) {
      throw new Error(`Identity Provider not found for tenant: ${tenantId}`);
    }

    const sp = this.serviceProvider as {
      parseLoginResponse: (
        idp: unknown,
        binding: string,
        req: { body: { SAMLResponse: string } },
      ) => Promise<{
        extract: { nameID?: string; attributes?: Record<string, unknown> };
      }>;
    };

    try {
      const { extract } = await sp.parseLoginResponse(
        idp,
        saml.Constants.BindingNamespace.Post,
        { body: { SAMLResponse: samlResponse } },
      );

      const profile: SamlUserProfile = {
        nameId: extract.nameID || '',
        email: (extract.attributes?.email as string) || '',
        firstName: (extract.attributes?.firstName as string) || undefined,
        lastName: (extract.attributes?.lastName as string) || undefined,
        attributes: extract.attributes,
      };

      this.logger.log(`SAML authentication successful for: ${profile.email}`);

      return profile;
    } catch (error) {
      this.logger.error('SAML response validation failed:', error);
      // preserve original error as cause for diagnostics
      throw new Error('Invalid SAML response', { cause: error as Error });
    }
  }

  /**
   * Generate SAML logout request
   */
  generateLogoutRequest(tenantId: string, nameId: string): string {
    const idp = this.identityProviders.get(tenantId);
    if (!idp) {
      throw new Error(`Identity Provider not found for tenant: ${tenantId}`);
    }

    const sp = this.serviceProvider as {
      createLogoutRequest: (
        idp: unknown,
        binding: string,
        user: { name_id: string },
      ) => { context: string };
    };

    const { context } = sp.createLogoutRequest(
      idp,
      saml.Constants.BindingNamespace.Redirect,
      { name_id: nameId },
    );

    return context;
  }

  /**
   * Get IdP metadata for tenant
   */
  getIdentityProviderMetadata(tenantId: string): string {
    const idp = this.identityProviders.get(tenantId) as {
      getMetadata?: () => string;
    };
    if (!idp || !idp.getMetadata) {
      throw new Error(`Identity Provider not found for tenant: ${tenantId}`);
    }

    return idp.getMetadata();
  }

  /**
   * Get SP metadata
   */
  getServiceProviderMetadata(): string {
    const sp = this.serviceProvider as {
      getMetadata?: () => string;
    };
    if (!sp || !sp.getMetadata) {
      throw new Error('Service Provider not initialized');
    }

    return sp.getMetadata();
  }

  /**
   * Remove Identity Provider
   */
  removeIdentityProvider(tenantId: string): void {
    this.identityProviders.delete(tenantId);
    this.logger.log(`Identity Provider removed for tenant: ${tenantId}`);
  }

  /**
   * Check if tenant has SSO enabled
   */
  isSsoEnabled(tenantId: string): boolean {
    return this.identityProviders.has(tenantId);
  }

  /**
   * Get all registered tenants
   */
  getRegisteredTenants(): string[] {
    return Array.from(this.identityProviders.keys());
  }
}
