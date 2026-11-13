/**
 * Flutterwave service — wraps the Flutterwave v3 REST API for tokenized charges.
 *
 * Two flows supported:
 *
 *  1. Tokenize + first charge (charge a card for the first time, get back a token):
 *     POST /v3/charges?type=card with card details + email + amount + tx_ref.
 *     If the response status is "success" the card token is in `data.card.token`.
 *     If the response status is "pending" or "send" the charge needs OTP/3DS:
 *       use `data.flwRef` + `OTP` to call POST /v3/validate-charge, or redirect
 *       to `data.authurl` for 3DS.
 *
 *  2. Subsequent charge (charge a saved token):
 *     POST /v3/tokenized-charges with the saved token + email + amount + tx_ref.
 *
 * Verification:
 *   GET /v3/transactions/:id/verify returns the canonical status of any charge.
 *
 * Webhook:
 *   POST /api/v1/webhooks/flutterwave — Flutterwave sends `charge.completed`
 *   events with `data.id` we can verify.
 *
 * Refunds:
 *   POST /v3/charges/refund with `id` (Flutterwave transaction id) + amount.
 *
 * Docs: https://developer.flutterwave.com/api
 */
import axios, { type AxiosInstance } from 'axios';
import { config } from '../../config/index.js';
import { AppError } from '../../utils/errors.js';

export class FlutterwaveError extends AppError {
  flwResponse?: unknown;
  constructor(message: string, code = 'FLW_ERROR', statusCode = 502, flwResponse?: unknown) {
    super(statusCode, message, code);
    this.name = 'FlutterwaveError';
    this.flwResponse = flwResponse;
  }
}

function client(): AxiosInstance {
  if (!config.flutterwave.secretKey) {
    throw new FlutterwaveError('Flutterwave secret key is not configured (set FLW_SECRET_KEY)', 'FLW_NOT_CONFIGURED', 503);
  }
  return axios.create({
    baseURL: config.flutterwave.baseUrl,
    timeout: 30_000,
    headers: {
      Authorization: `Bearer ${config.flutterwave.secretKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });
}

/** Generate a unique transaction reference for Flutterwave. */
export function generateTxRef(prefix = 'FLW'): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}-retailos-${ts}-${rand}`;
}

// =====================================================
// Charge a card directly (tokenizes on success — returns the card token)
// =====================================================

export interface DirectChargeInput {
  cardNumber: string;
  cvv: string;
  expiryMonth: string; // "MM"
  expiryYear: string; // "YY"
  amount: number; // major units (NGN)
  currency: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  txRef: string;
  narration?: string;
  redirectUrl?: string;
  /** PIN for Nigerian cards (4 digits). Required by some NG banks. */
  pin?: string;
  /** Billing address — sometimes required for AVS. */
  billingAddress?: {
    city?: string;
    address?: string;
    state?: string;
    country?: string;
    zipcode?: string;
  };
}

export interface DirectChargeResult {
  status: 'success' | 'pending_otp' | 'pending_3ds' | 'failed';
  flwTransactionId?: number;
  txRef: string;
  flwRef?: string;
  authUrl?: string;
  chargeResponseCode?: string;
  chargeResponseMessage?: string;
  /** Card token (only present if charge succeeded). */
  cardToken?: string;
  card?: {
    first6: string;
    last4: string;
    brand: string;
    issuer?: string;
    country?: string;
    type?: string;
    expiry?: string;
  };
  raw: unknown;
}

export async function chargeCardDirectly(input: DirectChargeInput): Promise<DirectChargeResult> {
  const c = client();
  const payload: Record<string, unknown> = {
    card_number: input.cardNumber,
    cvv: input.cvv,
    expiry_month: input.expiryMonth,
    expiry_year: input.expiryYear,
    currency: input.currency,
    amount: input.amount,
    email: input.email,
    tx_ref: input.txRef,
    enckey: config.flutterwave.encryptionKey || undefined,
  };
  if (input.firstName) payload.first_name = input.firstName;
  if (input.lastName) payload.last_name = input.lastName;
  if (input.phoneNumber) payload.phone_number = input.phoneNumber;
  if (input.narration) payload.narration = input.narration;
  if (input.redirectUrl) payload.redirect_url = input.redirectUrl;
  if (input.pin) payload.pin = input.pin;
  if (input.billingAddress) payload.billing = input.billingAddress;

  let res;
  try {
    res = await c.post('/v3/charges?type=card', payload);
  } catch (err) {
    throw new FlutterwaveError(
      err instanceof Error ? `Flutterwave charge failed: ${err.message}` : 'Flutterwave charge failed',
      'FLW_REQUEST_FAILED',
      502,
    );
  }
  const data = res.data?.data ?? {};
  const status = res.data?.status as string;
  const chargeResponseCode = data.chargeResponseCode ?? data.charge_response_code;
  const authModel = data.authModelUsed ?? data.authmodel;
  const authUrl = data.authurl ?? data.auth_url;

  // success means the charge went through AND we got a token
  if (status === 'success' && data.card?.token) {
    return {
      status: 'success',
      flwTransactionId: data.id,
      txRef: input.txRef,
      flwRef: data.flwRef,
      chargeResponseCode,
      chargeResponseMessage: data.chargeResponseMessage ?? data.charged_amount,
      cardToken: data.card.token,
      card: {
        first6: data.card.first_6digits ?? data.card.first6,
        last4: data.card.last_4digits ?? data.card.last4,
        brand: data.card.type ?? data.card.brand,
        issuer: data.card.issuer,
        country: data.card.country,
        type: data.card.type,
        expiry: data.card.expiry,
      },
      raw: res.data,
    };
  }

  // pending OTP validation
  if (status === 'pending' || (chargeResponseCode && chargeResponseCode !== '00')) {
    if (authUrl && (authModel === 'vbv' || authModel === '3DS')) {
      return {
        status: 'pending_3ds',
        flwTransactionId: data.id,
        txRef: input.txRef,
        flwRef: data.flwRef,
        authUrl,
        chargeResponseCode,
        chargeResponseMessage: data.chargeResponseMessage ?? '3DS authentication required',
        raw: res.data,
      };
    }
    return {
      status: 'pending_otp',
      flwTransactionId: data.id,
      txRef: input.txRef,
      flwRef: data.flwRef,
      chargeResponseCode,
      chargeResponseMessage: data.chargeResponseMessage ?? 'OTP validation required',
      raw: res.data,
    };
  }

  // failed
  return {
    status: 'failed',
    flwTransactionId: data.id,
    txRef: input.txRef,
    flwRef: data.flwRef,
    chargeResponseCode,
    chargeResponseMessage: data.chargeResponseMessage ?? res.data?.message ?? 'Charge failed',
    raw: res.data,
  };
}

/** Validate a charge with the OTP sent to the customer's phone. */
export async function validateOtp(flwRef: string, otp: string): Promise<{ status: 'success' | 'failed'; raw: unknown }> {
  const c = client();
  const res = await c.post('/v3/validate-charge', { flw_ref: flwRef, otp });
  const status = res.data?.status as string;
  return { status: status === 'success' ? 'success' : 'failed', raw: res.data };
}

// =====================================================
// Charge a saved token (recurring subscription)
// =====================================================

export interface TokenizedChargeInput {
  token: string;
  email: string; // MUST match the email used to tokenize the card
  amount: number; // major units
  currency: string;
  txRef: string;
  narration?: string;
  redirectUrl?: string;
}

export interface TokenizedChargeResult {
  status: 'success' | 'pending_otp' | 'pending_3ds' | 'failed';
  flwTransactionId?: number;
  txRef: string;
  flwRef?: string;
  authUrl?: string;
  chargeResponseCode?: string;
  chargeResponseMessage?: string;
  failureReason?: string;
  raw: unknown;
}

export async function chargeTokenizedCard(input: TokenizedChargeInput): Promise<TokenizedChargeResult> {
  const c = client();
  const payload: Record<string, unknown> = {
    token: input.token,
    email: input.email,
    currency: input.currency,
    amount: input.amount,
    tx_ref: input.txRef,
  };
  if (input.narration) payload.narration = input.narration;
  if (input.redirectUrl) payload.redirect_url = input.redirectUrl;

  let res;
  try {
    res = await c.post('/v3/tokenized-charges', payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Flutterwave charge failed';
    const responseData = (err as { response?: { data?: unknown } }).response?.data;
    return {
      status: 'failed',
      txRef: input.txRef,
      failureReason: msg,
      raw: responseData ?? null,
    };
  }
  const status = res.data?.status as string;
  const data = res.data?.data ?? {};
  const chargeResponseCode = data.chargeResponseCode ?? data.charge_response_code;
  const authUrl = data.authurl ?? data.auth_url;
  const authModel = data.authModelUsed ?? data.authmodel;

  if (status === 'success') {
    return {
      status: 'success',
      flwTransactionId: data.id,
      txRef: input.txRef,
      flwRef: data.flwRef,
      chargeResponseCode,
      chargeResponseMessage: data.chargeResponseMessage ?? 'Approved',
      raw: res.data,
    };
  }
  if (authUrl && (authModel === 'vbv' || authModel === '3DS')) {
    return {
      status: 'pending_3ds',
      flwTransactionId: data.id,
      txRef: input.txRef,
      flwRef: data.flwRef,
      authUrl,
      chargeResponseCode,
      chargeResponseMessage: data.chargeResponseMessage ?? '3DS required',
      raw: res.data,
    };
  }
  if (status === 'pending' || (chargeResponseCode && chargeResponseCode !== '00')) {
    return {
      status: 'pending_otp',
      flwTransactionId: data.id,
      txRef: input.txRef,
      flwRef: data.flwRef,
      chargeResponseCode,
      chargeResponseMessage: data.chargeResponseMessage ?? 'OTP required',
      raw: res.data,
    };
  }
  return {
    status: 'failed',
    flwTransactionId: data.id,
    txRef: input.txRef,
    flwRef: data.flwRef,
    chargeResponseCode,
    chargeResponseMessage: data.chargeResponseMessage ?? res.data?.message ?? 'Charge failed',
    failureReason: data.vbvrespmessage ?? data.chargeResponseMessage ?? 'Charge failed',
    raw: res.data,
  };
}

// =====================================================
// Verify a transaction (canonical source of truth)
// =====================================================

export interface VerifyTransactionResult {
  status: 'success' | 'failed' | 'pending';
  flwTransactionId: number;
  txRef: string;
  amount: number;
  currency: string;
  chargedAmount: number;
  narration: string;
  createdAt: string;
  card?: {
    first6: string;
    last4: string;
    brand: string;
    issuer?: string;
    country?: string;
    type?: string;
    expiry?: string;
    token?: string;
  };
  customer?: {
    email: string;
    name?: string;
    phone?: string;
  };
  raw: unknown;
}

export async function verifyTransaction(flwTransactionId: number): Promise<VerifyTransactionResult> {
  const c = client();
  const res = await c.get(`/v3/transactions/${flwTransactionId}/verify`);
  const data = res.data?.data ?? {};
  const status = (data.status as string) ?? 'failed';
  return {
    status: status === 'successful' ? 'success' : status === 'failed' ? 'failed' : 'pending',
    flwTransactionId: data.id,
    txRef: data.tx_ref ?? data.txRef,
    amount: Number(data.amount) ?? 0,
    currency: data.currency ?? 'NGN',
    chargedAmount: Number(data.charged_amount) ?? 0,
    narration: data.narration ?? '',
    createdAt: data.created_at,
    card: data.card
      ? {
          first6: data.card.first_6digits ?? data.card.first6,
          last4: data.card.last_4digits ?? data.card.last4,
          brand: data.card.type ?? data.card.brand,
          issuer: data.card.issuer,
          country: data.card.country,
          type: data.card.type,
          expiry: data.card.expiry,
          token: data.card.token ?? data.card.life_time_token,
        }
      : undefined,
    customer: data.customer
      ? { email: data.customer.email, name: data.customer.name, phone: data.customer.phone_number }
      : undefined,
    raw: res.data,
  };
}

// =====================================================
// Refund
// =====================================================

export async function refundCharge(flwTransactionId: number, amountMinor?: number): Promise<{ status: 'success' | 'failed'; raw: unknown }> {
  const c = client();
  const payload: Record<string, unknown> = { id: flwTransactionId };
  if (amountMinor) payload.amount = amountMinor / 100; // Flutterwave refunds use major units
  const res = await c.post('/v3/charges/refund', payload);
  return { status: res.data?.status === 'success' ? 'success' : 'failed', raw: res.data };
}

/**
 * Verify that the `verif-hash` header on a webhook request matches our secret.
 */
export function verifyWebhookSignature(verifHash: string | undefined): boolean {
  if (!config.flutterwave.webhookHash) return false;
  return verifHash === config.flutterwave.webhookHash;
}
