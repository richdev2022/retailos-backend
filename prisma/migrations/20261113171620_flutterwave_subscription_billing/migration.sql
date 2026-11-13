-- CreateEnum
CREATE TYPE "SubscriptionChargeStatus" AS ENUM ('PENDING', 'REQUIRES_OTP', 'SUCCESSFUL', 'FAILED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubscriptionEventType" AS ENUM ('TRIAL_STARTED', 'TRIAL_ENDED', 'PLAN_CHANGED', 'SUBSCRIPTION_RENEWED', 'CHARGE_SUCCESSFUL', 'CHARGE_FAILED', 'CHARGE_REFUNDED', 'CARD_ADDED', 'CARD_REMOVED', 'CARD_SET_DEFAULT', 'SUBSCRIPTION_CANCELLED', 'SUBSCRIPTION_REACTIVATED');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "saved_cards" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "emailUsed" TEXT NOT NULL,
    "first6" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "issuer" TEXT,
    "country" TEXT,
    "cardType" TEXT,
    "expiry" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "lastUsedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_charges" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "planId" TEXT,
    "savedCardId" TEXT,
    "flwTransactionId" BIGINT,
    "txRef" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" "SubscriptionChargeStatus" NOT NULL DEFAULT 'PENDING',
    "narration" TEXT,
    "chargeResponseCode" TEXT,
    "chargeResponseMessage" TEXT,
    "authUrl" TEXT,
    "failureReason" TEXT,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizedAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_events" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "type" "SubscriptionEventType" NOT NULL,
    "description" TEXT NOT NULL,
    "amountMinor" BIGINT,
    "currency" TEXT,
    "chargeId" TEXT,
    "planId" TEXT,
    "cardId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "userId" TEXT,
    "businessId" TEXT,
    "from" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "template" TEXT,
    "status" "EmailStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saved_cards_businessId_idx" ON "saved_cards"("businessId");

-- CreateIndex
CREATE INDEX "saved_cards_isDefault_idx" ON "saved_cards"("isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "saved_cards_business_token_unique" ON "saved_cards"("businessId", "token");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_charges_txref_unique" ON "subscription_charges"("txRef");

-- CreateIndex
CREATE INDEX "subscription_charges_businessId_idx" ON "subscription_charges"("businessId");

-- CreateIndex
CREATE INDEX "subscription_charges_subscriptionId_idx" ON "subscription_charges"("subscriptionId");

-- CreateIndex
CREATE INDEX "subscription_charges_status_idx" ON "subscription_charges"("status");

-- CreateIndex
CREATE INDEX "subscription_charges_attemptedAt_idx" ON "subscription_charges"("attemptedAt");

-- CreateIndex
CREATE INDEX "subscription_events_businessId_idx" ON "subscription_events"("businessId");

-- CreateIndex
CREATE INDEX "subscription_events_type_idx" ON "subscription_events"("type");

-- CreateIndex
CREATE INDEX "subscription_events_createdAt_idx" ON "subscription_events"("createdAt");

-- CreateIndex
CREATE INDEX "email_logs_userId_idx" ON "email_logs"("userId");

-- CreateIndex
CREATE INDEX "email_logs_businessId_idx" ON "email_logs"("businessId");

-- CreateIndex
CREATE INDEX "email_logs_status_idx" ON "email_logs"("status");

-- AddForeignKey
ALTER TABLE "saved_cards" ADD CONSTRAINT "saved_cards_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_charges" ADD CONSTRAINT "subscription_charges_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_charges" ADD CONSTRAINT "subscription_charges_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_charges" ADD CONSTRAINT "subscription_charges_planId_fkey" FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_charges" ADD CONSTRAINT "subscription_charges_savedCardId_fkey" FOREIGN KEY ("savedCardId") REFERENCES "saved_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_planId_fkey" FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
