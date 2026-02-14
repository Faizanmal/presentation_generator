/**
 * TestMail Configuration
 * Setup for testing email functionality in development/staging
 * 
 * API: https://testmail.app/
 * Docs: https://testmail.app/api/
 */

interface TestMailConfig {
  enabled: boolean;
  apiKey: string;
  namespace: string;
  webhookUrl: string;
}

export const testMailConfig: TestMailConfig = {
  enabled: process.env.REACT_APP_TESTMAIL_ENABLED === 'true',
  apiKey: process.env.REACT_APP_TESTMAIL_API_KEY || '',
  namespace: process.env.REACT_APP_TESTMAIL_NAMESPACE || 'presentation-designer',
  webhookUrl: process.env.REACT_APP_TESTMAIL_WEBHOOK_URL || `${process.env.REACT_APP_BACKEND_URL}/webhooks/testmail`,
};

/**
 * Get TestMail test inbox email address
 * Pattern: {namespace}.{tag}@inbox.testmail.app
 */
export function getTestMailAddress(tag: string = 'default'): string {
  return `${testMailConfig.namespace}.${tag}@inbox.testmail.app`;
}

interface TestEmail {
  to: { address: string }[];
  subject: string;
  [key: string]: unknown;
}

/**
 * Fetch test emails from TestMail inbox
 */
export async function fetchTestEmails(tag: string = 'default'): Promise<TestEmail[]> {
  if (!testMailConfig.enabled || !testMailConfig.apiKey) {
    throw new Error('TestMail not configured');
  }

  try {
    const response = await fetch('https://api.testmail.app/api/json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apikey: testMailConfig.apiKey,
        namespace: testMailConfig.namespace,
        tag,
        limit: 50,
      }),
    });

    const data = await response.json();

    if (data.ok) {
      return data.result.emails || [];
    } else {
      throw new Error(data.error || 'Failed to fetch TestMail emails');
    }
  } catch (error) {
    console.error('TestMail fetch error:', error);
    throw error;
  }
}

/**
 * Verify email was sent (typically used in E2E tests)
 */
export async function verifyEmailSent(recipient: string, options: { tag?: string; subject?: string } = {}): Promise<boolean> {
  try {
    const emails = await fetchTestEmails(options.tag || 'default');
    return emails.some(
      (email) =>
        email.to[0]?.address === recipient &&
        (!options.subject || email.subject.includes(options.subject)),
    );
  } catch (error) {
    console.error('Email verification error:', error);
    return false;
  }
}

export default testMailConfig;
