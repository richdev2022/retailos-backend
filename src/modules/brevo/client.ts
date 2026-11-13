/**
 * Brevo (formerly Sendinblue) API client.
 *
 * Wraps Brevo's v3 REST API for:
 *   - Sending transactional emails (POST /smtp/email)
 *   - Sending transactional SMS (POST /transactionalSMS/sms)
 *   - Creating contacts (POST /contacts) — optional, used for marketing lists
 *
 * Auth: every request includes `api-key: <BREVO_API_KEY>` header.
 *
 * When Brevo is disabled (BREVO_ENABLED=false), all send attempts are recorded
 * in the email_logs table with status=QUEUED and a debug log is emitted, so the
 * integration is fully testable without a Brevo account.
 *
 * Docs: https://developers.brevo.com/reference/quickstart-reference
 */
import axios, { type AxiosInstance } from 'axios';
import { config } from '../../config/index.js';

export class BrevoError extends Error {
  code: string;
  statusCode: number;
  brevoResponse?: unknown;
  constructor(message: string, code = 'BREVO_ERROR', statusCode = 502, brevoResponse?: unknown) {
    super(message);
    this.name = 'BrevoError';
    this.code = code;
    this.statusCode = statusCode;
    this.brevoResponse = brevoResponse;
  }
}

function client(): AxiosInstance {
  if (!config.brevo.apiKey) {
    throw new BrevoError('Brevo API key is not configured (set BREVO_API_KEY)', 'BREVO_NOT_CONFIGURED', 503);
  }
  return axios.create({
    baseURL: config.brevo.baseUrl,
    timeout: 30_000,
    headers: {
      'api-key': config.brevo.apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });
}

// =====================================================
// Send a transactional email
// =====================================================

export interface BrevoEmailRecipient {
  email: string;
  name?: string;
}

export interface BrevoAttachment {
  name: string;
  content: string; // base64-encoded
}

export interface SendEmailInput {
  to: BrevoEmailRecipient[];
  cc?: BrevoEmailRecipient[];
  bcc?: BrevoEmailRecipient[];
  sender?: BrevoEmailRecipient;
  replyTo?: BrevoEmailRecipient;
  subject: string;
  htmlContent?: string;
  textContent?: string;
  templateId?: number;
  params?: Record<string, unknown>;
  tags?: string[];
  attachments?: BrevoAttachment[];
  messageId?: string;
}

export interface SendEmailResult {
  messageId: string;
  brevoResponse: unknown;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const c = client();
  const sender = input.sender ?? { email: config.brevo.senderEmail, name: config.brevo.senderName };
  const replyTo = input.replyTo ?? { email: config.brevo.replyToEmail };

  const payload: Record<string, unknown> = {
    sender,
    to: input.to,
    replyTo,
    subject: input.subject,
  };
  if (input.cc) payload.cc = input.cc;
  if (input.bcc) payload.bcc = input.bcc;
  if (input.htmlContent) payload.htmlContent = input.htmlContent;
  if (input.textContent) payload.textContent = input.textContent;
  if (input.templateId) payload.templateId = input.templateId;
  if (input.params) payload.params = input.params;
  if (input.tags) payload.tags = input.tags;
  if (input.attachments) payload.attachments = input.attachments;
  if (input.messageId) payload.messageId = input.messageId;

  let res;
  try {
    res = await c.post('/smtp/email', payload);
  } catch (err) {
    const responseData = (err as { response?: { data?: unknown; status?: number } }).response?.data;
    const status = (err as { response?: { status?: number } }).response?.status ?? 502;
    const message = (responseData as { message?: string } | undefined)?.message ?? (err instanceof Error ? err.message : 'Brevo request failed');
    throw new BrevoError(message, 'BREVO_REQUEST_FAILED', status, responseData);
  }
  return {
    messageId: res.data?.messageId ?? 'unknown',
    brevoResponse: res.data,
  };
}

// =====================================================
// Send a transactional SMS
// =====================================================

export interface SendSmsInput {
  recipient: string;
  content: string;
  sender?: string;
  templateId?: number;
  params?: Record<string, unknown>;
  tag?: string;
  type?: 'transactional' | 'marketing';
}

export interface SendSmsResult {
  reference: string;
  brevoResponse: unknown;
}

export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  const c = client();
  const payload: Record<string, unknown> = {
    recipient: input.recipient,
    content: input.content,
    sender: input.sender ?? config.brevo.smsSender,
    type: input.type ?? 'transactional',
  };
  if (input.templateId) payload.templateId = input.templateId;
  if (input.params) payload.params = input.params;
  if (input.tag) payload.tag = input.tag;

  let res;
  try {
    res = await c.post('/transactionalSMS/sms', payload);
  } catch (err) {
    const responseData = (err as { response?: { data?: unknown; status?: number } }).response?.data;
    const status = (err as { response?: { status?: number } }).response?.status ?? 502;
    const message = (responseData as { message?: string } | undefined)?.message ?? (err instanceof Error ? err.message : 'Brevo SMS request failed');
    throw new BrevoError(message, 'BREVO_SMS_FAILED', status, responseData);
  }
  return {
    reference: res.data?.reference ?? res.data?.messageId ?? 'unknown',
    brevoResponse: res.data,
  };
}

// =====================================================
// Create a contact in Brevo (optional)
// =====================================================

export interface CreateContactInput {
  email: string;
  attributes?: Record<string, unknown>;
  listIds?: number[];
  doubleOptin?: boolean;
}

export async function createContact(input: CreateContactInput): Promise<{ id: number | string; brevoResponse: unknown }> {
  const c = client();
  const payload: Record<string, unknown> = { email: input.email };
  if (input.attributes) payload.attributes = input.attributes;
  if (input.listIds) payload.listIds = input.listIds;
  if (input.doubleOptin) payload.doubleOptin = true;

  let res;
  try {
    res = await c.post('/contacts', payload);
  } catch (err) {
    const responseData = (err as { response?: { data?: unknown; status?: number } }).response?.data;
    const status = (err as { response?: { status?: number } }).response?.status ?? 502;
    const message = (responseData as { message?: string } | undefined)?.message ?? (err instanceof Error ? err.message : 'Brevo create contact failed');
    throw new BrevoError(message, 'BREVO_CONTACT_FAILED', status, responseData);
  }
  return {
    id: res.data?.id ?? 'unknown',
    brevoResponse: res.data,
  };
}

/** Verify the API key works (calls GET /account). */
export async function verifyApiKey(): Promise<boolean> {
  if (!config.brevo.apiKey) return false;
  const c = client();
  try {
    await c.get('/account');
    return true;
  } catch {
    return false;
  }
}
