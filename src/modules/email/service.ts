/**
 * Email service — backward-compatibility shim.
 *
 * The actual email templates + dispatch logic now live in
 * `src/modules/notifications/templates.ts`, which routes through Brevo when
 * BREVO_ENABLED=true and falls back to a queued email_logs entry otherwise.
 *
 * This file re-exports the public API so the existing payments module
 * (which imports from `../email/service.ts`) continues to work.
 */
export {
  sendChargeSuccessEmail,
  sendChargeFailedEmail,
  sendCardAddedEmail,
  sendCardRemovedEmail,
  getBusinessOwnerEmail,
} from '../notifications/templates.js';
