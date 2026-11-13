/**
 * Subscriptions seed — idempotently seeds the four canonical SubscriptionPlan
 * rows defined in PRD section 9 (free / pro / business / enterprise).
 *
 * Money is stored as integer minor units (kobo for NGN):
 *   ₦5,000    → 500_000 minor
 *   ₦55,000   → 5_500_000 minor
 *   ₦15,000   → 1_500_000 minor
 *   ₦165,000  → 16_500_000 minor
 *   ₦35,000   → 3_500_000 minor
 *   ₦385,000  → 38_500_000 minor
 *
 * `trialDays` for paid plans defaults to `config.subscription.defaultTrialDays`
 * and `gracePeriodDays` to `config.subscription.defaultGracePeriodDays`.
 * The free plan has trialDays=0 (no trial — it is permanently free).
 *
 * Idempotent: re-runs `upsert` by `code` and syncs scalar fields. Safe to call
 * on every boot.
 */
import { prisma } from '../../db/index.js';
import { config } from '../../config/index.js';

// =====================================================
// Plan definitions (PRD section 9)
// =====================================================

export interface PlanSeed {
  code: string;
  name: string;
  description: string;
  productLimit: number | null;
  staffLimit: number | null;
  branchLimit: number | null;
  cloudSync: boolean;
  advancedReports: boolean;
  multiUserPerms: boolean;
  branchAnalytics: boolean;
  monthlyPriceMinor: bigint;
  annualPriceMinor: bigint;
  trialDays: number;
  gracePeriodDays: number;
  sortOrder: number;
}

const DEFAULT_TRIAL_DAYS = config.subscription.defaultTrialDays;
const DEFAULT_GRACE_DAYS = config.subscription.defaultGracePeriodDays;

const PLANS: PlanSeed[] = [
  {
    code: 'free',
    name: 'Free',
    description: 'Free forever plan for small shops getting started with RetailOS.',
    productLimit: 50,
    staffLimit: 1,
    branchLimit: 1,
    cloudSync: true,
    advancedReports: false,
    multiUserPerms: false,
    branchAnalytics: false,
    monthlyPriceMinor: 0n,
    annualPriceMinor: 0n,
    trialDays: 0,
    gracePeriodDays: DEFAULT_GRACE_DAYS,
    sortOrder: 1,
  },
  {
    code: 'pro',
    name: 'Pro',
    description: 'For growing single-branch retailers that need advanced reports.',
    productLimit: null, // unlimited
    staffLimit: 1,
    branchLimit: 1,
    cloudSync: true,
    advancedReports: true,
    multiUserPerms: false,
    branchAnalytics: false,
    monthlyPriceMinor: 500_000n,
    annualPriceMinor: 5_500_000n,
    trialDays: DEFAULT_TRIAL_DAYS,
    gracePeriodDays: DEFAULT_GRACE_DAYS,
    sortOrder: 2,
  },
  {
    code: 'business',
    name: 'Business',
    description: 'For small teams that need multi-user permissions and roles.',
    productLimit: null,
    staffLimit: 5,
    branchLimit: 1,
    cloudSync: true,
    advancedReports: true,
    multiUserPerms: true,
    branchAnalytics: false,
    monthlyPriceMinor: 1_500_000n,
    annualPriceMinor: 16_500_000n,
    trialDays: DEFAULT_TRIAL_DAYS,
    gracePeriodDays: DEFAULT_GRACE_DAYS,
    sortOrder: 3,
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    description: 'For multi-branch retail chains that need branch analytics.',
    productLimit: null,
    staffLimit: null,
    branchLimit: null,
    cloudSync: true,
    advancedReports: true,
    multiUserPerms: true,
    branchAnalytics: true,
    monthlyPriceMinor: 3_500_000n,
    annualPriceMinor: 38_500_000n,
    trialDays: DEFAULT_TRIAL_DAYS,
    gracePeriodDays: DEFAULT_GRACE_DAYS,
    sortOrder: 4,
  },
];

// =====================================================
// seedPlans — idempotent upsert by code
// =====================================================

export async function seedPlans(): Promise<void> {
  for (const plan of PLANS) {
    await prisma.subscriptionPlan.upsert({
      where: { code: plan.code },
      update: {
        name: plan.name,
        description: plan.description,
        monthlyPriceMinor: plan.monthlyPriceMinor,
        annualPriceMinor: plan.annualPriceMinor,
        productLimit: plan.productLimit,
        staffLimit: plan.staffLimit,
        branchLimit: plan.branchLimit,
        cloudSync: plan.cloudSync,
        advancedReports: plan.advancedReports,
        multiUserPerms: plan.multiUserPerms,
        branchAnalytics: plan.branchAnalytics,
        trialDays: plan.trialDays,
        gracePeriodDays: plan.gracePeriodDays,
        sortOrder: plan.sortOrder,
        isActive: true,
      },
      create: {
        code: plan.code,
        name: plan.name,
        description: plan.description,
        monthlyPriceMinor: plan.monthlyPriceMinor,
        annualPriceMinor: plan.annualPriceMinor,
        productLimit: plan.productLimit,
        staffLimit: plan.staffLimit,
        branchLimit: plan.branchLimit,
        cloudSync: plan.cloudSync,
        advancedReports: plan.advancedReports,
        multiUserPerms: plan.multiUserPerms,
        branchAnalytics: plan.branchAnalytics,
        trialDays: plan.trialDays,
        gracePeriodDays: plan.gracePeriodDays,
        sortOrder: plan.sortOrder,
        isActive: true,
      },
    });
  }
}

/** Return the canonical plan definitions (used by tests / docs). */
export function getPlanSeedDefinitions(): readonly PlanSeed[] {
  return PLANS;
}
