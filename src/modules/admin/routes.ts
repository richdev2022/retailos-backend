/**
 * @openapi
 * components:
 *   schemas:
 *     AdminUser:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         fullName: { type: string }
 *         email: { type: string, nullable: true }
 *         phone: { type: string, nullable: true }
 *         status: { type: string, enum: [ACTIVE, SUSPENDED, DEACTIVATED, PENDING] }
 *         lastLoginAt: { type: string, format: date-time, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *     AdminAuthLoginResponse:
 *       type: object
 *       properties:
 *         user: { $ref: "#/components/schemas/AdminUser" }
 *         accessToken: { type: string }
 *         expiresIn: { type: integer, description: "Seconds until the access token expires" }
 *         roles: { type: array, items: { type: string }, description: "Admin role codes (e.g. SUPER_ADMIN)" }
 *     AdminDashboard:
 *       type: object
 *       properties:
 *         registeredBusinesses: { type: integer }
 *         registeredUsers: { type: integer }
 *         activeBusinesses: { type: integer }
 *         freePlanBusinesses: { type: integer }
 *         paidSubscribers: { type: integer }
 *         expiredSubscriptions: { type: integer }
 *         cancellations: { type: integer }
 *         newRegistrations30d: { type: integer }
 *         mrrMinor: { type: string, description: "Monthly recurring revenue in minor units (kobo)" }
 *         subscriptionRevenueMinor: { type: string, description: "Total approved payment submissions in minor units" }
 *         platformUsage:
 *           type: object
 *           properties:
 *             products: { type: integer }
 *             sales: { type: integer }
 *             customers: { type: integer }
 *             branches: { type: integer }
 *             supportTicketsOpen: { type: integer }
 *         recentErrors:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id: { type: string }
 *               action: { type: string }
 *               createdAt: { type: string, format: date-time }
 *               resourceId: { type: string, nullable: true }
 *     AdminBusinessListItem:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         name: { type: string }
 *         category: { type: string, nullable: true }
 *         status: { type: string, enum: [ACTIVE, SUSPENDED] }
 *         ownerId: { type: string, format: uuid }
 *         createdAt: { type: string, format: date-time }
 *         suspendedAt: { type: string, format: date-time, nullable: true }
 *         subscription:
 *           type: object
 *           nullable: true
 *           properties:
 *             status: { type: string }
 *             planCode: { type: string }
 *             endDate: { type: string, format: date-time, nullable: true }
 *         _count:
 *           type: object
 *           properties:
 *             members: { type: integer }
 *             products: { type: integer }
 *             sales: { type: integer }
 *     AdminPlan:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         code: { type: string }
 *         name: { type: string }
 *         description: { type: string, nullable: true }
 *         monthlyPriceMinor: { type: string }
 *         annualPriceMinor: { type: string }
 *         productLimit: { type: integer, nullable: true }
 *         staffLimit: { type: integer, nullable: true }
 *         branchLimit: { type: integer, nullable: true }
 *         cloudSync: { type: boolean }
 *         advancedReports: { type: boolean }
 *         multiUserPerms: { type: boolean }
 *         branchAnalytics: { type: boolean }
 *         trialDays: { type: integer }
 *         gracePeriodDays: { type: integer }
 *         isActive: { type: boolean }
 *         sortOrder: { type: integer }
 *     AdminPaymentSubmission:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         businessId: { type: string, format: uuid }
 *         planId: { type: string, format: uuid }
 *         amountMinor: { type: string }
 *         paymentMethod: { type: string }
 *         reference: { type: string }
 *         proofUrl: { type: string, nullable: true }
 *         submittedById: { type: string, format: uuid }
 *         status: { type: string, enum: [PENDING, APPROVED, REJECTED] }
 *         reviewedById: { type: string, format: uuid, nullable: true }
 *         reviewNote: { type: string, nullable: true }
 *         reviewedAt: { type: string, format: date-time, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *     AdminAuditLog:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         businessId: { type: string, format: uuid, nullable: true }
 *         actorId: { type: string, format: uuid, nullable: true }
 *         adminActorId: { type: string, format: uuid, nullable: true }
 *         action: { type: string }
 *         resourceType: { type: string, nullable: true }
 *         resourceId: { type: string, nullable: true }
 *         change: { type: object, nullable: true }
 *         ipAddress: { type: string, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *     AdminSupportTicket:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         businessId: { type: string, format: uuid, nullable: true }
 *         subject: { type: string }
 *         description: { type: string }
 *         category: { type: string, nullable: true }
 *         priority: { type: string }
 *         status: { type: string, enum: [OPEN, IN_PROGRESS, WAITING_FOR_CUSTOMER, RESOLVED, CLOSED] }
 *         createdById: { type: string, format: uuid }
 *         assignedToId: { type: string, format: uuid, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *         resolvedAt: { type: string, format: date-time, nullable: true }
 *         closedAt: { type: string, format: date-time, nullable: true }
 *     AdminPlatformConfig:
 *       type: object
 *       properties:
 *         key: { type: string }
 *         value: { type: string }
 *         updatedAt: { type: string, format: date-time }
 *
 * /admin/auth/login:
 *   post:
 *     tags: [Admin Auth]
 *     summary: Admin login (separate from retailer login)
 *     description: |
 *       Verifies credentials, ensures the user is on the `admin_users` list
 *       (stored in `PlatformConfig`), then issues an access token with
 *       `scope='admin'` and a refresh token in the `retailos_admin_rt`
 *       httpOnly cookie (separate from the retailer cookie).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [identifier, password]
 *             properties:
 *               identifier: { type: string, description: "Email or phone" }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/AdminAuthLoginResponse" }
 *       401: { description: Invalid credentials }
 *       403: { description: User is not an admin (NOT_ADMIN) or account suspended }
 *
 * /admin/auth/refresh:
 *   post:
 *     tags: [Admin Auth]
 *     summary: Rotate admin refresh token and issue a new access token
 *     description: |
 *       Reads the `retailos_admin_rt` cookie, verifies it belongs to an admin
 *       user, revokes the old refresh token, and issues a new one (rotation).
 *     responses:
 *       200:
 *         description: New access token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken: { type: string }
 *                 expiresIn: { type: integer }
 *       401: { description: Invalid or expired refresh token }
 *
 * /admin/auth/logout:
 *   post:
 *     tags: [Admin Auth]
 *     summary: Revoke the current admin session
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Logged out }
 *
 * /admin/auth/me:
 *   get:
 *     tags: [Admin Auth]
 *     summary: Current admin user + role memberships
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Current admin profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user: { $ref: "#/components/schemas/AdminUser" }
 *                 roles: { type: array, items: { type: string } }
 *
 * /admin/dashboard:
 *   get:
 *     tags: [Admin Dashboard]
 *     summary: Platform-wide metrics
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Platform metrics
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/AdminDashboard" }
 *
 * /admin/businesses:
 *   get:
 *     tags: [Admin Businesses]
 *     summary: Paginated list of all businesses
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: status, schema: { type: string, enum: [ACTIVE, SUSPENDED] } }
 *       - { in: query, name: subscriptionStatus, schema: { type: string } }
 *       - { in: query, name: category, schema: { type: string } }
 *       - { in: query, name: createdFrom, schema: { type: string, format: date-time } }
 *       - { in: query, name: createdTo, schema: { type: string, format: date-time } }
 *     responses:
 *       200: { description: Paginated list }
 *
 * /admin/businesses/{id}:
 *   get:
 *     tags: [Admin Businesses]
 *     summary: Business profile + active users + recent activity
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Business detail }
 *       404: { description: Not found }
 *
 * /admin/businesses/{id}/suspend:
 *   post:
 *     tags: [Admin Businesses]
 *     summary: Suspend a business and cancel its active subscription
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string }
 *     responses:
 *       200: { description: Business suspended }
 *
 * /admin/businesses/{id}/reactivate:
 *   post:
 *     tags: [Admin Businesses]
 *     summary: Reactivate a previously-suspended business
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Business reactivated }
 *
 * /admin/businesses/{id}/audit:
 *   get:
 *     tags: [Admin Businesses]
 *     summary: Audit logs scoped to a business
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *     responses:
 *       200: { description: Paginated audit logs }
 *
 * /admin/users:
 *   get:
 *     tags: [Admin Users]
 *     summary: Paginated list of platform users
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: status, schema: { type: string, enum: [ACTIVE, SUSPENDED, DEACTIVATED, PENDING] } }
 *     responses:
 *       200: { description: Paginated list }
 *
 * /admin/users/{id}:
 *   get:
 *     tags: [Admin Users]
 *     summary: User profile + business memberships
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: User detail }
 *       404: { description: Not found }
 *
 * /admin/users/{id}/suspend:
 *   post:
 *     tags: [Admin Users]
 *     summary: Suspend a user account
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: User suspended }
 *
 * /admin/users/{id}/reactivate:
 *   post:
 *     tags: [Admin Users]
 *     summary: Reactivate a user account
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: User reactivated }
 *
 * /admin/users/{id}/revoke-sessions:
 *   post:
 *     tags: [Admin Users]
 *     summary: Revoke all sessions and refresh tokens for a user
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Sessions revoked }
 *
 * /admin/users/{id}/activity:
 *   get:
 *     tags: [Admin Users]
 *     summary: Authentication events + recent actions for a user
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: limit, schema: { type: integer, default: 50 } }
 *     responses:
 *       200: { description: Activity feed }
 *
 * /admin/plans:
 *   get:
 *     tags: [Admin Plans]
 *     summary: List all subscription plans (including inactive)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of plans }
 *   post:
 *     tags: [Admin Plans]
 *     summary: Create a new subscription plan
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, name, monthlyPrice, annualPrice]
 *             properties:
 *               code: { type: string }
 *               name: { type: string }
 *               description: { type: string }
 *               monthlyPrice: { type: string, description: "Decimal string, e.g. '5000.00'" }
 *               annualPrice: { type: string }
 *               productLimit: { type: integer, nullable: true }
 *               staffLimit: { type: integer, nullable: true }
 *               branchLimit: { type: integer, nullable: true }
 *               cloudSync: { type: boolean }
 *               advancedReports: { type: boolean }
 *               multiUserPerms: { type: boolean }
 *               branchAnalytics: { type: boolean }
 *               trialDays: { type: integer }
 *               gracePeriodDays: { type: integer }
 *               sortOrder: { type: integer }
 *     responses:
 *       201: { description: Plan created }
 *
 * /admin/plans/{id}:
 *   patch:
 *     tags: [Admin Plans]
 *     summary: Update plan configuration
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               monthlyPrice: { type: string }
 *               annualPrice: { type: string }
 *               productLimit: { type: integer, nullable: true }
 *               staffLimit: { type: integer, nullable: true }
 *               branchLimit: { type: integer, nullable: true }
 *               cloudSync: { type: boolean }
 *               advancedReports: { type: boolean }
 *               multiUserPerms: { type: boolean }
 *               branchAnalytics: { type: boolean }
 *               trialDays: { type: integer }
 *               gracePeriodDays: { type: integer }
 *               sortOrder: { type: integer }
 *     responses:
 *       200: { description: Plan updated }
 *
 * /admin/plans/{id}/activate:
 *   patch:
 *     tags: [Admin Plans]
 *     summary: Activate a plan
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Plan activated }
 *
 * /admin/plans/{id}/deactivate:
 *   patch:
 *     tags: [Admin Plans]
 *     summary: Deactivate a plan
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Plan deactivated }
 *
 * /admin/payment-submissions:
 *   get:
 *     tags: [Admin Payment Submissions]
 *     summary: Paginated list of payment submissions
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *       - { in: query, name: status, schema: { type: string, enum: [PENDING, APPROVED, REJECTED] } }
 *       - { in: query, name: planId, schema: { type: string, format: uuid } }
 *       - { in: query, name: createdFrom, schema: { type: string, format: date-time } }
 *       - { in: query, name: createdTo, schema: { type: string, format: date-time } }
 *     responses:
 *       200: { description: Paginated list }
 *
 * /admin/payment-submissions/{id}:
 *   get:
 *     tags: [Admin Payment Submissions]
 *     summary: Single payment submission with business + plan
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Payment submission detail }
 *       404: { description: Not found }
 *
 * /admin/payment-submissions/{id}/approve:
 *   post:
 *     tags: [Admin Payment Submissions]
 *     summary: Approve a payment submission and activate the business subscription
 *     description: |
 *       Atomic transaction:
 *       1. Set PaymentSubmission.status=APPROVED, reviewedById, reviewedAt, reviewNote.
 *       2. Find or create the business's current Subscription; set status=ACTIVE,
 *          startDate=now, endDate = extendDays ? now+extendDays : inferred from amount/plan.
 *       3. graceEndsAt = endDate + plan.gracePeriodDays.
 *       4. Create notification for the business owner: "Subscription activated".
 *       5. Audit log: action='admin.subscription.activate'.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reviewNote: { type: string }
 *               extendDays: { type: integer, minimum: 1 }
 *     responses:
 *       200: { description: Payment approved and subscription activated }
 *
 * /admin/payment-submissions/{id}/reject:
 *   post:
 *     tags: [Admin Payment Submissions]
 *     summary: Reject a payment submission
 *     description: |
 *       Atomic transaction:
 *       1. Set PaymentSubmission.status=REJECTED, reviewedById, reviewedAt, reviewNote.
 *       2. Create notification: "Payment submission rejected".
 *       3. Audit log: action='admin.subscription.reject'.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reviewNote]
 *             properties:
 *               reviewNote: { type: string }
 *     responses:
 *       200: { description: Payment rejected }
 *
 * /admin/audit-logs:
 *   get:
 *     tags: [Admin Audit Logs]
 *     summary: Platform audit log (paginated, filterable)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *       - { in: query, name: actorId, schema: { type: string, format: uuid } }
 *       - { in: query, name: adminActorId, schema: { type: string, format: uuid } }
 *       - { in: query, name: action, schema: { type: string } }
 *       - { in: query, name: resourceType, schema: { type: string } }
 *       - { in: query, name: createdFrom, schema: { type: string, format: date-time } }
 *       - { in: query, name: createdTo, schema: { type: string, format: date-time } }
 *     responses:
 *       200: { description: Paginated audit logs }
 *
 * /admin/support-tickets:
 *   get:
 *     tags: [Admin Support Tickets]
 *     summary: Paginated list of support tickets
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *       - { in: query, name: status, schema: { type: string } }
 *       - { in: query, name: priority, schema: { type: string } }
 *       - { in: query, name: category, schema: { type: string } }
 *       - { in: query, name: assignedToId, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Paginated list }
 *
 * /admin/support-tickets/{id}/assign:
 *   post:
 *     tags: [Admin Support Tickets]
 *     summary: Assign a support ticket to an admin user
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [assignedToId]
 *             properties:
 *               assignedToId: { type: string, format: uuid }
 *     responses:
 *       200: { description: Ticket assigned }
 *
 * /admin/support-tickets/{id}/messages:
 *   post:
 *     tags: [Admin Support Tickets]
 *     summary: Admin reply on a support ticket (creates SupportMessage)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [body]
 *             properties:
 *               body: { type: string }
 *               attachmentUrl: { type: string, format: uri }
 *     responses:
 *       201: { description: Message created }
 *
 * /admin/support-tickets/{id}/status:
 *   patch:
 *     tags: [Admin Support Tickets]
 *     summary: Change ticket status (IN_PROGRESS / RESOLVED / CLOSED)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [IN_PROGRESS, WAITING_FOR_CUSTOMER, RESOLVED, CLOSED] }
 *     responses:
 *       200: { description: Ticket status updated }
 *
 * /admin/config:
 *   get:
 *     tags: [Admin Config]
 *     summary: List all platform config keys
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of config entries }
 *   post:
 *     tags: [Admin Config]
 *     summary: Set or update a platform config key
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [key, value]
 *             properties:
 *               key: { type: string }
 *               value: { type: string }
 *     responses:
 *       201: { description: Config created or updated }
 *
 * /admin/config/{key}:
 *   get:
 *     tags: [Admin Config]
 *     summary: Get a specific config key
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: key, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Config entry }
 *       404: { description: Not found }
 *   delete:
 *     tags: [Admin Config]
 *     summary: Delete a config key
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: key, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Deleted }
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

import { prisma, type Tx } from '../../db/index.js';
import { config } from '../../config/index.js';
import { verifyPassword } from '../../utils/password.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../utils/jwt.js';
import { hashToken } from '../../utils/tokens.js';
import {
  Errors,
  asyncHandler,
  sendSuccess,
  sendError,
} from '../../utils/errors.js';
import {
  PaginationSchema,
  paginate,
  pageMeta,
  searchClause,
} from '../../utils/pagination.js';
import { toMinor } from '../../utils/money.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import {
  authMiddleware,
  requireAdmin,
} from '../../middleware/auth.js';

// =====================================================
// Router setup
// =====================================================

export const adminRouter = Router();

// =====================================================
// Constants
// =====================================================

const ADMIN_REFRESH_COOKIE = 'retailos_admin_rt';
const ADMIN_USERS_KEY = 'admin_users';
const ADMIN_USER_ROLES_KEY = 'admin_user_roles';
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const ACCESS_TTL_SECONDS = 15 * 60;

// =====================================================
// Zod schemas
// =====================================================

const IdParamsSchema = z.object({ id: z.string().uuid() });

const AdminLoginSchema = z.object({
  identifier: z.string().min(3),
  password: z.string().min(1).max(128),
});

const ApprovePaymentSubmissionSchema = z.object({
  reviewNote: z.string().max(2000).optional().nullable(),
  extendDays: z.number().int().min(1).max(3650).optional(),
});

const RejectPaymentSubmissionSchema = z.object({
  reviewNote: z.string().min(1).max(2000),
});

const SuspendBusinessSchema = z
  .object({
    reason: z.string().max(2000).optional().nullable(),
  })
  .default({});

const CreatePlanSchema = z.object({
  code: z.string().min(2).max(60).regex(/^[a-z0-9_-]+$/i, 'Invalid code'),
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional().nullable(),
  monthlyPrice: z
    .union([
      z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a decimal string like "1250.50"'),
      z.number().nonnegative().finite(),
    ])
    .transform((v: string | number) => String(v)),
  annualPrice: z
    .union([
      z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a decimal string like "1250.50"'),
      z.number().nonnegative().finite(),
    ])
    .transform((v: string | number) => String(v)),
  productLimit: z.number().int().min(0).nullable().optional(),
  staffLimit: z.number().int().min(0).nullable().optional(),
  branchLimit: z.number().int().min(0).nullable().optional(),
  cloudSync: z.boolean().optional().default(true),
  advancedReports: z.boolean().optional().default(false),
  multiUserPerms: z.boolean().optional().default(false),
  branchAnalytics: z.boolean().optional().default(false),
  trialDays: z.number().int().min(0).max(365).optional().default(0),
  gracePeriodDays: z.number().int().min(0).max(365).optional().default(7),
  sortOrder: z.number().int().min(0).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

const UpdatePlanSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(2000).optional().nullable(),
  monthlyPrice: z
    .union([
      z.string().regex(/^\d+(\.\d{1,2})?$/),
      z.number().nonnegative().finite(),
    ])
    .transform((v: string | number) => String(v))
    .optional(),
  annualPrice: z
    .union([
      z.string().regex(/^\d+(\.\d{1,2})?$/),
      z.number().nonnegative().finite(),
    ])
    .transform((v: string | number) => String(v))
    .optional(),
  productLimit: z.number().int().min(0).nullable().optional(),
  staffLimit: z.number().int().min(0).nullable().optional(),
  branchLimit: z.number().int().min(0).nullable().optional(),
  cloudSync: z.boolean().optional(),
  advancedReports: z.boolean().optional(),
  multiUserPerms: z.boolean().optional(),
  branchAnalytics: z.boolean().optional(),
  trialDays: z.number().int().min(0).max(365).optional(),
  gracePeriodDays: z.number().int().min(0).max(365).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const AssignTicketSchema = z.object({
  assignedToId: z.string().uuid(),
});

const CreateTicketMessageSchema = z.object({
  body: z.string().min(1).max(10000),
  attachmentUrl: z.string().url().optional().nullable(),
});

const UpdateTicketStatusSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED']),
});

const CreateConfigSchema = z.object({
  key: z.string().min(1).max(120).regex(/^[a-z0-9_.:-]+$/i, 'Invalid key'),
  value: z.string().max(100_000),
});

const dateQuery = z.preprocess(
  (v) => (v === '' || v === undefined || v === null ? undefined : v),
  z.coerce.date().optional(),
);

const ListBusinessesQuerySchema = PaginationSchema.extend({
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  subscriptionStatus: z
    .enum(['TRIAL', 'ACTIVE', 'PAST_DUE', 'GRACE_PERIOD', 'EXPIRED', 'SUSPENDED', 'CANCELLED'])
    .optional(),
  category: z.string().max(80).optional(),
  createdFrom: dateQuery,
  createdTo: dateQuery,
});

const ListUsersQuerySchema = PaginationSchema.extend({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED', 'PENDING']).optional(),
});

const ListPaymentSubmissionsQuerySchema = PaginationSchema.extend({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  planId: z.string().uuid().optional(),
  createdFrom: dateQuery,
  createdTo: dateQuery,
});

const ListAuditLogsQuerySchema = PaginationSchema.extend({
  actorId: z.string().uuid().optional(),
  adminActorId: z.string().uuid().optional(),
  action: z.string().max(120).optional(),
  resourceType: z.string().max(80).optional(),
  businessId: z.string().uuid().optional(),
  createdFrom: dateQuery,
  createdTo: dateQuery,
});

const ListSupportTicketsQuerySchema = PaginationSchema.extend({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.string().max(40).optional(),
  category: z.string().max(80).optional(),
  assignedToId: z.string().uuid().optional(),
});

const ListBusinessAuditQuerySchema = PaginationSchema.extend({
  action: z.string().max(120).optional(),
  resourceType: z.string().max(80).optional(),
  actorId: z.string().uuid().optional(),
});

const ListUserActivityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

// =====================================================
// Helpers
// =====================================================

function setAdminRefreshCookie(res: Response, token: string) {
  res.cookie(ADMIN_REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: config.cookies.secure,
    sameSite: config.cookies.sameSite,
    maxAge: REFRESH_TTL_MS,
    path: '/',
  });
}

function clearAdminRefreshCookie(res: Response) {
  res.clearCookie(ADMIN_REFRESH_COOKIE, { path: '/' });
}

function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/**
 * Fire-and-forget admin audit log. Always uses `adminActorId` (never `actorId`)
 * so platform audit entries are cleanly distinguishable from retailer actions.
 */
function writeAdminAudit(
  req: Request,
  opts: {
    action: string;
    businessId?: string | null;
    resourceType?: string | null;
    resourceId?: string | null;
    change?: unknown;
  },
) {
  if (!req.user) return;
  prisma.auditLog
    .create({
      data: {
        businessId: opts.businessId ?? null,
        actorId: null,
        adminActorId: req.user.id,
        action: opts.action,
        resourceType: opts.resourceType ?? null,
        resourceId: opts.resourceId ?? null,
        change: (opts.change as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        ipAddress: req.ip ?? null,
        userAgent: req.headers['user-agent'] ?? null,
      },
    })
    .catch(() => {
      /* never throw from audit */
    });
}

/** Serialise a plan so BigInt fields become JSON-safe strings. */
function serializePlan(p: any) {
  return {
    ...p,
    monthlyPriceMinor: p?.monthlyPriceMinor?.toString?.() ?? '0',
    annualPriceMinor: p?.annualPriceMinor?.toString?.() ?? '0',
  };
}

/** Serialise a payment submission so amountMinor becomes a string. */
function serializePaymentSubmission(ps: any) {
  return {
    ...ps,
    amountMinor: ps?.amountMinor?.toString?.() ?? '0',
    plan: ps?.plan ? serializePlan(ps.plan) : undefined,
  };
}

/** Serialise a subscription so any nested plan BigInt fields become strings. */
function serializeSubscription(s: any) {
  return {
    ...s,
    plan: s?.plan ? serializePlan(s.plan) : null,
  };
}

/** Public user shape (no passwordHash). */
function sanitizeUser(u: any) {
  return {
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    phone: u.phone,
    status: u.status,
    emailVerifiedAt: u.emailVerifiedAt,
    phoneVerifiedAt: u.phoneVerifiedAt,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

/** Load admin role codes for a user from PlatformConfig. */
async function loadAdminRoles(userId: string): Promise<string[]> {
  const cfg = await prisma.platformConfig.findUnique({
    where: { key: ADMIN_USER_ROLES_KEY },
  });
  if (!cfg) return [];
  const map = safeJsonParse<Record<string, string[]>>(cfg.value, {});
  return map[userId] ?? [];
}

/** Returns true if the user is on the admin_users list. */
async function isAdminUser(userId: string): Promise<boolean> {
  const cfg = await prisma.platformConfig.findUnique({
    where: { key: ADMIN_USERS_KEY },
  });
  const ids: string[] = cfg ? safeJsonParse<string[]>(cfg.value, []) : [];
  return ids.includes(userId);
}

// =====================================================
// === ADMIN AUTH (public endpoints — login + refresh) ===
// =====================================================

/**
 * POST /admin/auth/login
 * Body: { identifier: emailOrPhone, password }
 */
adminRouter.post(
  '/auth/login',
  validateBody(AdminLoginSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { identifier, password } = req.body as z.infer<typeof AdminLoginSchema>;

    const user = await prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { phone: identifier }] },
    });
    if (!user) {
      return sendError(res, Errors.unauthorized('Invalid credentials', 'INVALID_CREDENTIALS'));
    }
    if (user.status !== 'ACTIVE') {
      return sendError(res, Errors.forbidden('Account suspended', 'ACCOUNT_SUSPENDED'));
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return sendError(res, Errors.unauthorized('Invalid credentials', 'INVALID_CREDENTIALS'));
    }

    // Ensure user is on the admin_users list
    const isAdmin = await isAdminUser(user.id);
    if (!isAdmin) {
      return sendError(res, Errors.forbidden('Not an administrator', 'NOT_ADMIN'));
    }

    // Issue session + tokens (scope='admin')
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        userAgent: req.headers['user-agent'] ?? null,
        ipAddress: req.ip ?? null,
      },
    });
    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email ?? undefined,
      phone: user.phone ?? undefined,
      sid: session.id,
      scope: 'admin',
    });
    const refreshToken = signRefreshToken({ sub: user.id, sid: session.id });
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        sessionId: session.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      },
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    setAdminRefreshCookie(res, refreshToken);

    const roles = await loadAdminRoles(user.id);

    writeAdminAudit(req, {
      action: 'admin.login',
      resourceType: 'session',
      resourceId: session.id,
    });

    return sendSuccess(
      res,
      {
        user: sanitizeUser(user),
        accessToken,
        expiresIn: ACCESS_TTL_SECONDS,
        roles,
      },
      'Login successful',
    );
  }),
);

/**
 * POST /admin/auth/refresh
 * Reads `retailos_admin_rt` cookie, rotates refresh token, issues new access token.
 */
adminRouter.post(
  '/auth/refresh',
  asyncHandler(async (req: Request, res: Response) => {
    const refreshToken =
      (req.cookies?.[ADMIN_REFRESH_COOKIE] as string) || (req.body?.refreshToken as string);
    if (!refreshToken) {
      return sendError(res, Errors.unauthorized('No refresh token', 'NO_REFRESH_TOKEN'));
    }

    let payload: ReturnType<typeof verifyRefreshToken>;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      return sendError(res, Errors.unauthorized('Invalid refresh token', 'INVALID_REFRESH_TOKEN'));
    }
    if (payload.type !== 'refresh') {
      return sendError(res, Errors.unauthorized('Invalid refresh token', 'INVALID_REFRESH_TOKEN'));
    }

    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
    });
    if (!stored) {
      return sendError(res, Errors.unauthorized('Refresh token not recognized', 'INVALID_REFRESH_TOKEN'));
    }
    if (stored.revokedAt) {
      return sendError(res, Errors.unauthorized('Refresh token revoked', 'TOKEN_REVOKED'));
    }
    if (stored.expiresAt < new Date()) {
      return sendError(res, Errors.unauthorized('Refresh token expired', 'TOKEN_EXPIRED'));
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      return sendError(res, Errors.unauthorized('User not found'));
    }
    if (user.status !== 'ACTIVE') {
      return sendError(res, Errors.forbidden('Account suspended'));
    }

    // Verify still an admin
    const isAdmin = await isAdminUser(user.id);
    if (!isAdmin) {
      // Revoke the token — user is no longer an admin
      await prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });
      return sendError(res, Errors.forbidden('Not an administrator', 'NOT_ADMIN'));
    }

    // Rotate: revoke old, issue new
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    const newRefresh = signRefreshToken({ sub: payload.sub, sid: payload.sid });
    await prisma.refreshToken.create({
      data: {
        userId: payload.sub,
        sessionId: payload.sid,
        tokenHash: hashToken(newRefresh),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
        rotatedFrom: stored.id,
      },
    });

    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email ?? undefined,
      phone: user.phone ?? undefined,
      sid: payload.sid,
      scope: 'admin',
    });

    setAdminRefreshCookie(res, newRefresh);
    return sendSuccess(res, { accessToken, expiresIn: ACCESS_TTL_SECONDS }, 'Token refreshed');
  }),
);

// =====================================================
// === AUTH GUARD — every route below requires admin auth ===
// =====================================================

adminRouter.use(authMiddleware);
adminRouter.use(requireAdmin());

// =====================================================
// === ADMIN AUTH (protected) ===
// =====================================================

/**
 * POST /admin/auth/logout — revoke current admin session
 */
adminRouter.post(
  '/auth/logout',
  asyncHandler(async (req: Request, res: Response) => {
    const refreshToken =
      (req.cookies?.[ADMIN_REFRESH_COOKIE] as string) || (req.body?.refreshToken as string);
    if (refreshToken) {
      const stored = await prisma.refreshToken.findUnique({
        where: { tokenHash: hashToken(refreshToken) },
      });
      if (stored) {
        await prisma.refreshToken.update({
          where: { id: stored.id },
          data: { revokedAt: new Date() },
        });
        await prisma.session
          .update({
            where: { id: stored.sessionId },
            data: { revokedAt: new Date() },
          })
          .catch(() => {
            /* session may already be revoked */
          });
      }
    }
    clearAdminRefreshCookie(res);

    if (req.user) {
      writeAdminAudit(req, {
        action: 'admin.logout',
        resourceType: 'session',
        resourceId: req.user.sessionId ?? null,
      });
    }

    return sendSuccess(res, null, 'Logged out');
  }),
);

/**
 * GET /admin/auth/me — current admin user + role memberships
 */
adminRouter.get(
  '/auth/me',
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return sendError(res, Errors.unauthorized());
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return sendError(res, Errors.notFound('User not found'));

    const roles = await loadAdminRoles(user.id);

    return sendSuccess(
      res,
      {
        user: sanitizeUser(user),
        roles,
      },
      'OK',
    );
  }),
);

// =====================================================
// === DASHBOARD ===
// =====================================================

adminRouter.get(
  '/dashboard',
  asyncHandler(async (_req: Request, res: Response) => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      registeredBusinesses,
      registeredUsers,
      activeBusinesses,
      freePlanSubscriptions,
      paidActiveSubscriptions,
      expiredSubscriptions,
      cancelledSubscriptions,
      newRegistrations30d,
      productsCount,
      salesCount,
      customersCount,
      branchesCount,
      supportTicketsOpen,
      approvedPaymentsAgg,
      activeSubsWithPlans,
      recentErrors,
    ] = await Promise.all([
      prisma.business.count(),
      prisma.user.count(),
      prisma.business.count({ where: { status: 'ACTIVE' } }),
      prisma.subscription.count({
        where: { plan: { code: 'free' } },
      }),
      prisma.subscription.count({
        where: {
          status: 'ACTIVE',
          plan: { isNot: { code: 'free' } },
        },
      }),
      prisma.subscription.count({ where: { status: 'EXPIRED' } }),
      prisma.subscription.count({ where: { status: 'CANCELLED' } }),
      prisma.business.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.product.count(),
      prisma.sale.count(),
      prisma.customer.count(),
      prisma.branch.count(),
      prisma.supportTicket.count({
        where: { status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER'] } },
      }),
      prisma.paymentSubmission.aggregate({
        _sum: { amountMinor: true },
        where: { status: 'APPROVED' },
      }),
      prisma.subscription.findMany({
        where: { status: 'ACTIVE', plan: { isNot: { code: 'free' } } },
        include: { plan: { select: { monthlyPriceMinor: true, code: true } } },
      }),
      prisma.auditLog.findMany({
        where: {
          OR: [
            { action: { contains: 'error', mode: 'insensitive' } },
            { action: { contains: 'fail', mode: 'insensitive' } },
          ],
        },
        orderBy: { createdAt: 'desc' as const },
        take: 10,
        select: {
          id: true,
          action: true,
          createdAt: true,
          resourceId: true,
          resourceType: true,
          adminActorId: true,
          actorId: true,
        },
      }),
    ]);

    // MRR = sum of monthlyPriceMinor for active paid subscriptions.
    const mrrMinor = activeSubsWithPlans.reduce(
      (acc, s) => acc + (s.plan?.monthlyPriceMinor ?? 0n),
      0n,
    );
    const subscriptionRevenueMinor = approvedPaymentsAgg._sum.amountMinor ?? 0n;

    return sendSuccess(
      res,
      {
        registeredBusinesses,
        registeredUsers,
        activeBusinesses,
        freePlanBusinesses: freePlanSubscriptions,
        paidSubscribers: paidActiveSubscriptions,
        expiredSubscriptions,
        cancellations: cancelledSubscriptions,
        newRegistrations30d,
        mrrMinor: mrrMinor.toString(),
        subscriptionRevenueMinor: subscriptionRevenueMinor.toString(),
        platformUsage: {
          products: productsCount,
          sales: salesCount,
          customers: customersCount,
          branches: branchesCount,
          supportTicketsOpen,
        },
        recentErrors: recentErrors.map((e) => ({
          ...e,
          createdAt: e.createdAt.toISOString(),
        })),
      },
      'OK',
    );
  }),
);

// =====================================================
// === BUSINESSES ===
// =====================================================

adminRouter.get(
  '/businesses',
  validateQuery(ListBusinessesQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as z.infer<typeof ListBusinessesQuerySchema>;

    const where: Prisma.BusinessWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.category) where.category = { contains: q.category, mode: 'insensitive' };
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: 'insensitive' } },
        { email: { contains: q.search, mode: 'insensitive' } },
        { phone: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    if (q.createdFrom || q.createdTo) {
      where.createdAt = {};
      if (q.createdFrom) (where.createdAt as any).gte = q.createdFrom;
      if (q.createdTo) (where.createdAt as any).lte = q.createdTo;
    }
    if (q.subscriptionStatus) {
      where.subscriptions = { some: { status: q.subscriptionStatus } };
    }

    const total = await prisma.business.count({ where });
    const items = await prisma.business.findMany({
      ...paginate({ where, orderBy: { createdAt: 'desc' as const } }, q),
      include: {
        owner: { select: { id: true, fullName: true, email: true, phone: true } },
        subscriptions: {
          orderBy: { createdAt: 'desc' as const },
          take: 1,
          include: { plan: { select: { id: true, code: true, name: true } } },
        },
        _count: { select: { members: true, products: true, sales: true } },
      },
    });

    return sendSuccess(
      res,
      {
        items: items.map((b) => {
          const sub = b.subscriptions[0];
          return {
            id: b.id,
            name: b.name,
            category: b.category,
            status: b.status,
            ownerId: b.ownerId,
            owner: b.owner,
            createdAt: b.createdAt,
            suspendedAt: b.suspendedAt,
            subscription: sub
              ? {
                  id: sub.id,
                  status: sub.status,
                  planCode: sub.plan?.code ?? null,
                  planName: sub.plan?.name ?? null,
                  endDate: sub.endDate,
                }
              : null,
            _count: b._count,
          };
        }),
        meta: pageMeta(total, q),
      },
      'OK',
    );
  }),
);

adminRouter.get(
  '/businesses/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const business = await prisma.business.findUnique({
      where: { id: req.params.id },
      include: {
        owner: { select: { id: true, fullName: true, email: true, phone: true } },
        subscriptions: {
          orderBy: { createdAt: 'desc' as const },
          take: 1,
          include: { plan: true },
        },
        branches: { where: { status: 'ACTIVE' } },
        members: {
          include: {
            user: { select: { id: true, fullName: true, email: true, phone: true, status: true } },
            role: { select: { id: true, name: true } },
          },
        },
        _count: { select: { products: true, sales: true, customers: true, branches: true } },
      },
    });
    if (!business) return sendError(res, Errors.notFound('Business not found'));

    const recentActivity = await prisma.auditLog.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: 'desc' as const },
      take: 20,
      select: {
        id: true,
        action: true,
        actorId: true,
        adminActorId: true,
        resourceType: true,
        resourceId: true,
        createdAt: true,
      },
    });

    return sendSuccess(
      res,
      {
        ...business,
        subscriptions: business.subscriptions.map(serializeSubscription),
        recentActivity: recentActivity.map((a) => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
        })),
      },
      'OK',
    );
  }),
);

adminRouter.post(
  '/businesses/:id/suspend',
  validateBody(SuspendBusinessSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.params.id;
    const body = req.body as z.infer<typeof SuspendBusinessSchema>;

    const result = await prisma.$transaction(async (tx: Tx) => {
      const business = await tx.business.findUnique({ where: { id: bizId } });
      if (!business) return null;

      if (business.status === 'SUSPENDED') {
        return { business, alreadySuspended: true };
      }

      const updated = await tx.business.update({
        where: { id: bizId },
        data: { status: 'SUSPENDED', suspendedAt: new Date() },
      });

      // Cancel the active subscription with reason recorded in the audit log.
      const activeSub = await tx.subscription.findFirst({
        where: { businessId: bizId, status: { in: ['TRIAL', 'ACTIVE', 'PAST_DUE', 'GRACE_PERIOD'] } },
        orderBy: { createdAt: 'desc' as const },
      });
      if (activeSub) {
        await tx.subscription.update({
          where: { id: activeSub.id },
          data: { status: 'CANCELLED', cancelledAt: new Date() },
        });
      }

      // Notify the business owner.
      await tx.notification.create({
        data: {
          businessId: bizId,
          userId: business.ownerId,
          type: 'business_suspended',
          title: 'Business suspended',
          message: 'Your business has been suspended by the platform administrator.',
          payload: { reason: body.reason ?? null, businessId: bizId },
        },
      }).catch(() => { /* best effort */ });

      // Audit log (inside transaction so it commits with the change).
      await tx.auditLog.create({
        data: {
          businessId: bizId,
          actorId: null,
          adminActorId: req.user!.id,
          action: 'admin.business.suspend',
          resourceType: 'business',
          resourceId: bizId,
          change: { reason: body.reason ?? null } as Prisma.InputJsonValue,
          ipAddress: req.ip ?? null,
          userAgent: req.headers['user-agent'] ?? null,
        },
      });

      return { business: updated, alreadySuspended: false };
    });

    if (!result) return sendError(res, Errors.notFound('Business not found'));

    return sendSuccess(
      res,
      {
        id: result.business.id,
        status: result.business.status,
        suspendedAt: result.business.suspendedAt,
        alreadySuspended: result.alreadySuspended,
      },
      result.alreadySuspended ? 'Business already suspended' : 'Business suspended',
    );
  }),
);

adminRouter.post(
  '/businesses/:id/reactivate',
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.params.id;

    const result = await prisma.$transaction(async (tx: Tx) => {
      const business = await tx.business.findUnique({ where: { id: bizId } });
      if (!business) return null;

      const updated = await tx.business.update({
        where: { id: bizId },
        data: { status: 'ACTIVE', suspendedAt: null },
      });

      await tx.notification.create({
        data: {
          businessId: bizId,
          userId: business.ownerId,
          type: 'business_reactivated',
          title: 'Business reactivated',
          message: 'Your business has been reactivated by the platform administrator.',
          payload: { businessId: bizId },
        },
      }).catch(() => { /* best effort */ });

      await tx.auditLog.create({
        data: {
          businessId: bizId,
          actorId: null,
          adminActorId: req.user!.id,
          action: 'admin.business.reactivate',
          resourceType: 'business',
          resourceId: bizId,
          change: { previousStatus: business.status } as Prisma.InputJsonValue,
          ipAddress: req.ip ?? null,
          userAgent: req.headers['user-agent'] ?? null,
        },
      });

      return updated;
    });

    if (!result) return sendError(res, Errors.notFound('Business not found'));

    return sendSuccess(
      res,
      { id: result.id, status: result.status, suspendedAt: result.suspendedAt },
      'Business reactivated',
    );
  }),
);

adminRouter.get(
  '/businesses/:id/audit',
  validateQuery(ListBusinessAuditQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.params.id;
    const q = req.query as unknown as z.infer<typeof ListBusinessAuditQuerySchema>;

    const business = await prisma.business.findUnique({ where: { id: bizId } });
    if (!business) return sendError(res, Errors.notFound('Business not found'));

    const where: Prisma.AuditLogWhereInput = { businessId: bizId };
    if (q.actorId) where.actorId = q.actorId;
    if (q.action) where.action = { contains: q.action, mode: 'insensitive' };
    if (q.resourceType) where.resourceType = q.resourceType;

    const total = await prisma.auditLog.count({ where });
    const items = await prisma.auditLog.findMany({
      ...paginate({ where, orderBy: { createdAt: 'desc' as const } }, q),
      select: {
        id: true,
        action: true,
        actorId: true,
        adminActorId: true,
        resourceType: true,
        resourceId: true,
        change: true,
        ipAddress: true,
        createdAt: true,
      },
    });

    return sendSuccess(
      res,
      {
        items: items.map((a) => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
        })),
        meta: pageMeta(total, q),
      },
      'OK',
    );
  }),
);

// =====================================================
// === USERS ===
// =====================================================

adminRouter.get(
  '/users',
  validateQuery(ListUsersQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as z.infer<typeof ListUsersQuerySchema>;

    const where: Prisma.UserWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.search) {
      where.OR = [
        { fullName: { contains: q.search, mode: 'insensitive' } },
        { email: { contains: q.search, mode: 'insensitive' } },
        { phone: { contains: q.search, mode: 'insensitive' } },
      ];
    }

    const total = await prisma.user.count({ where });
    const items = await prisma.user.findMany({
      ...paginate({ where, orderBy: { createdAt: 'desc' as const } }, q),
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        status: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { memberships: true, ownedBusinesses: true } },
      },
    });

    return sendSuccess(
      res,
      {
        items: items.map((u) => ({
          ...u,
          emailVerifiedAt: u.emailVerifiedAt?.toISOString() ?? null,
          phoneVerifiedAt: u.phoneVerifiedAt?.toISOString() ?? null,
          lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
          createdAt: u.createdAt.toISOString(),
          updatedAt: u.updatedAt.toISOString(),
        })),
        meta: pageMeta(total, q),
      },
      'OK',
    );
  }),
);

adminRouter.get(
  '/users/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        memberships: {
          include: {
            business: { select: { id: true, name: true, status: true } },
            role: { select: { id: true, name: true, scope: true } },
            branch: { select: { id: true, name: true } },
          },
        },
        ownedBusinesses: { select: { id: true, name: true, status: true } },
        sessions: {
          orderBy: { lastSeenAt: 'desc' as const },
          take: 10,
          select: { id: true, ipAddress: true, userAgent: true, lastSeenAt: true, revokedAt: true, createdAt: true },
        },
      },
    });
    if (!user) return sendError(res, Errors.notFound('User not found'));

    const roles = await loadAdminRoles(user.id);

    return sendSuccess(
      res,
      {
        ...sanitizeUser(user),
        roles,
        memberships: user.memberships.map((m) => ({
          id: m.id,
          businessId: m.businessId,
          business: m.business,
          roleId: m.roleId,
          role: m.role,
          branchId: m.branchId,
          branch: m.branch,
          status: m.status,
        })),
        ownedBusinesses: user.ownedBusinesses,
        sessions: user.sessions.map((s) => ({
          ...s,
          lastSeenAt: s.lastSeenAt.toISOString(),
          revokedAt: s.revokedAt?.toISOString() ?? null,
          createdAt: s.createdAt.toISOString(),
        })),
      },
      'OK',
    );
  }),
);

adminRouter.post(
  '/users/:id/suspend',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.params.id;

    const result = await prisma.$transaction(async (tx: Tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) return null;

      const updated = await tx.user.update({
        where: { id: userId },
        data: { status: 'SUSPENDED' },
      });

      // Revoke all sessions + refresh tokens
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          actorId: null,
          adminActorId: req.user!.id,
          action: 'admin.user.suspend',
          resourceType: 'user',
          resourceId: userId,
          change: { previousStatus: user.status } as Prisma.InputJsonValue,
          ipAddress: req.ip ?? null,
          userAgent: req.headers['user-agent'] ?? null,
        },
      });

      return updated;
    });

    if (!result) return sendError(res, Errors.notFound('User not found'));

    return sendSuccess(
      res,
      { id: result.id, status: result.status },
      'User suspended',
    );
  }),
);

adminRouter.post(
  '/users/:id/reactivate',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.params.id;

    const result = await prisma.$transaction(async (tx: Tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) return null;

      const updated = await tx.user.update({
        where: { id: userId },
        data: { status: 'ACTIVE' },
      });

      await tx.auditLog.create({
        data: {
          actorId: null,
          adminActorId: req.user!.id,
          action: 'admin.user.reactivate',
          resourceType: 'user',
          resourceId: userId,
          change: { previousStatus: user.status } as Prisma.InputJsonValue,
          ipAddress: req.ip ?? null,
          userAgent: req.headers['user-agent'] ?? null,
        },
      });

      return updated;
    });

    if (!result) return sendError(res, Errors.notFound('User not found'));

    return sendSuccess(
      res,
      { id: result.id, status: result.status },
      'User reactivated',
    );
  }),
);

adminRouter.post(
  '/users/:id/revoke-sessions',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.params.id;

    const [sessionsCount, tokensCount] = await Promise.all([
      prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    writeAdminAudit(req, {
      action: 'admin.user.revoke_sessions',
      resourceType: 'user',
      resourceId: userId,
      change: {
        sessionsRevoked: sessionsCount.count,
        refreshTokensRevoked: tokensCount.count,
      },
    });

    return sendSuccess(
      res,
      {
        userId,
        sessionsRevoked: sessionsCount.count,
        refreshTokensRevoked: tokensCount.count,
      },
      'Sessions revoked',
    );
  }),
);

adminRouter.get(
  '/users/:id/activity',
  validateQuery(ListUserActivityQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.params.id;
    const q = req.query as unknown as z.infer<typeof ListUserActivityQuerySchema>;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return sendError(res, Errors.notFound('User not found'));

    const [sessions, auditLogs, refreshTokens] = await Promise.all([
      prisma.session.findMany({
        where: { userId },
        orderBy: { lastSeenAt: 'desc' as const },
        take: q.limit,
        select: {
          id: true,
          userAgent: true,
          ipAddress: true,
          lastSeenAt: true,
          revokedAt: true,
          createdAt: true,
        },
      }),
      prisma.auditLog.findMany({
        where: {
          OR: [{ actorId: userId }, { adminActorId: userId }],
        },
        orderBy: { createdAt: 'desc' as const },
        take: q.limit,
        select: {
          id: true,
          action: true,
          resourceType: true,
          resourceId: true,
          businessId: true,
          createdAt: true,
        },
      }),
      prisma.refreshToken.count({
        where: { userId, revokedAt: null },
      }),
    ]);

    return sendSuccess(
      res,
      {
        user: sanitizeUser(user),
        activeRefreshTokens: refreshTokens,
        sessions: sessions.map((s) => ({
          ...s,
          lastSeenAt: s.lastSeenAt.toISOString(),
          revokedAt: s.revokedAt?.toISOString() ?? null,
          createdAt: s.createdAt.toISOString(),
        })),
        auditLogs: auditLogs.map((a) => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
        })),
      },
      'OK',
    );
  }),
);

// =====================================================
// === PLANS ===
// =====================================================

adminRouter.get(
  '/plans',
  asyncHandler(async (_req: Request, res: Response) => {
    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: { sortOrder: 'asc' as const },
    });
    return sendSuccess(res, plans.map(serializePlan), 'OK');
  }),
);

adminRouter.post(
  '/plans',
  requireAdmin('admin:*'),
  validateBody(CreatePlanSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as z.infer<typeof CreatePlanSchema>;

    const monthlyPriceMinor = toMinor(body.monthlyPrice);
    const annualPriceMinor = toMinor(body.annualPrice);

    const plan = await prisma.subscriptionPlan.create({
      data: {
        code: body.code,
        name: body.name,
        description: body.description ?? null,
        monthlyPriceMinor,
        annualPriceMinor,
        productLimit: body.productLimit ?? null,
        staffLimit: body.staffLimit ?? null,
        branchLimit: body.branchLimit ?? null,
        cloudSync: body.cloudSync,
        advancedReports: body.advancedReports,
        multiUserPerms: body.multiUserPerms,
        branchAnalytics: body.branchAnalytics,
        trialDays: body.trialDays,
        gracePeriodDays: body.gracePeriodDays,
        sortOrder: body.sortOrder,
        isActive: body.isActive,
      },
    });

    writeAdminAudit(req, {
      action: 'admin.plan.create',
      resourceType: 'subscription_plan',
      resourceId: plan.id,
      change: {
        code: plan.code,
        name: plan.name,
        monthlyPriceMinor: monthlyPriceMinor.toString(),
        annualPriceMinor: annualPriceMinor.toString(),
      },
    });

    return sendSuccess(res, serializePlan(plan), 'Plan created', 201);
  }),
);

adminRouter.patch(
  '/plans/:id',
  requireAdmin('admin:config'),
  validateBody(UpdatePlanSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as z.infer<typeof UpdatePlanSchema>;

    const existing = await prisma.subscriptionPlan.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) return sendError(res, Errors.notFound('Plan not found'));

    const data: Prisma.SubscriptionPlanUpdateInput = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.monthlyPrice !== undefined) data.monthlyPriceMinor = toMinor(body.monthlyPrice);
    if (body.annualPrice !== undefined) data.annualPriceMinor = toMinor(body.annualPrice);
    if (body.productLimit !== undefined) data.productLimit = body.productLimit;
    if (body.staffLimit !== undefined) data.staffLimit = body.staffLimit;
    if (body.branchLimit !== undefined) data.branchLimit = body.branchLimit;
    if (body.cloudSync !== undefined) data.cloudSync = body.cloudSync;
    if (body.advancedReports !== undefined) data.advancedReports = body.advancedReports;
    if (body.multiUserPerms !== undefined) data.multiUserPerms = body.multiUserPerms;
    if (body.branchAnalytics !== undefined) data.branchAnalytics = body.branchAnalytics;
    if (body.trialDays !== undefined) data.trialDays = body.trialDays;
    if (body.gracePeriodDays !== undefined) data.gracePeriodDays = body.gracePeriodDays;
    if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;

    const updated = await prisma.subscriptionPlan.update({
      where: { id: req.params.id },
      data,
    });

    writeAdminAudit(req, {
      action: 'admin.plan.update',
      resourceType: 'subscription_plan',
      resourceId: updated.id,
      change: body as Prisma.InputJsonValue,
    });

    return sendSuccess(res, serializePlan(updated), 'Plan updated');
  }),
);

adminRouter.patch(
  '/plans/:id/activate',
  requireAdmin('admin:config'),
  asyncHandler(async (req: Request, res: Response) => {
    const existing = await prisma.subscriptionPlan.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) return sendError(res, Errors.notFound('Plan not found'));

    const updated = await prisma.subscriptionPlan.update({
      where: { id: req.params.id },
      data: { isActive: true },
    });

    writeAdminAudit(req, {
      action: 'admin.plan.activate',
      resourceType: 'subscription_plan',
      resourceId: updated.id,
      change: { previousIsActive: existing.isActive },
    });

    return sendSuccess(res, serializePlan(updated), 'Plan activated');
  }),
);

adminRouter.patch(
  '/plans/:id/deactivate',
  requireAdmin('admin:config'),
  asyncHandler(async (req: Request, res: Response) => {
    const existing = await prisma.subscriptionPlan.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) return sendError(res, Errors.notFound('Plan not found'));

    const updated = await prisma.subscriptionPlan.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    writeAdminAudit(req, {
      action: 'admin.plan.deactivate',
      resourceType: 'subscription_plan',
      resourceId: updated.id,
      change: { previousIsActive: existing.isActive },
    });

    return sendSuccess(res, serializePlan(updated), 'Plan deactivated');
  }),
);

// =====================================================
// === PAYMENT SUBMISSIONS ===
// =====================================================

adminRouter.get(
  '/payment-submissions',
  validateQuery(ListPaymentSubmissionsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as z.infer<typeof ListPaymentSubmissionsQuerySchema>;

    const where: Prisma.PaymentSubmissionWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.planId) where.planId = q.planId;
    if (q.createdFrom || q.createdTo) {
      where.createdAt = {};
      if (q.createdFrom) (where.createdAt as any).gte = q.createdFrom;
      if (q.createdTo) (where.createdAt as any).lte = q.createdTo;
    }

    const total = await prisma.paymentSubmission.count({ where });
    const items = await prisma.paymentSubmission.findMany({
      ...paginate({ where, orderBy: { createdAt: 'desc' as const } }, q),
      include: {
        business: { select: { id: true, name: true, status: true, ownerId: true } },
        plan: { select: { id: true, code: true, name: true, monthlyPriceMinor: true, annualPriceMinor: true } },
        submittedBy: { select: { id: true, fullName: true, email: true } },
        reviewedBy: { select: { id: true, fullName: true, email: true } },
      },
    });

    return sendSuccess(
      res,
      {
        items: items.map((ps) => ({
          ...serializePaymentSubmission(ps),
          plan: ps.plan
            ? {
                ...ps.plan,
                monthlyPriceMinor: ps.plan.monthlyPriceMinor.toString(),
                annualPriceMinor: ps.plan.annualPriceMinor.toString(),
              }
            : null,
        })),
        meta: pageMeta(total, q),
      },
      'OK',
    );
  }),
);

adminRouter.get(
  '/payment-submissions/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const ps = await prisma.paymentSubmission.findUnique({
      where: { id: req.params.id },
      include: {
        business: { select: { id: true, name: true, status: true, ownerId: true } },
        plan: true,
        submittedBy: { select: { id: true, fullName: true, email: true } },
        reviewedBy: { select: { id: true, fullName: true, email: true } },
      },
    });
    if (!ps) return sendError(res, Errors.notFound('Payment submission not found'));

    return sendSuccess(
      res,
      {
        ...serializePaymentSubmission(ps),
        business: ps.business,
        plan: serializePlan(ps.plan),
      },
      'OK',
    );
  }),
);

adminRouter.post(
  '/payment-submissions/:id/approve',
  requireAdmin('admin:subscription'),
  validateBody(ApprovePaymentSubmissionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as z.infer<typeof ApprovePaymentSubmissionSchema>;
    const submissionId = req.params.id;

    const result = await prisma.$transaction(async (tx: Tx) => {
      const submission = await tx.paymentSubmission.findUnique({
        where: { id: submissionId },
        include: { plan: true, business: true },
      });
      if (!submission) return { kind: 'not_found' as const };
      if (submission.status !== 'PENDING') {
        return { kind: 'bad_state' as const, status: submission.status };
      }

      const now = new Date();

      // 1. Mark submission approved
      const updated = await tx.paymentSubmission.update({
        where: { id: submissionId },
        data: {
          status: 'APPROVED',
          reviewedById: req.user!.id,
          reviewedAt: now,
          reviewNote: body.reviewNote ?? null,
        },
      });

      // 2. Compute endDate
      let days = 30;
      if (body.extendDays) {
        days = body.extendDays;
      } else if (submission.plan) {
        const monthly = submission.plan.monthlyPriceMinor;
        const annual = submission.plan.annualPriceMinor;
        // If amount looks like an annual payment (>= half of annual price), treat as annual.
        if (annual > 0n && submission.amountMinor >= annual / 2n) {
          days = 365;
        } else if (monthly > 0n && submission.amountMinor >= monthly / 2n) {
          days = 30;
        } else if (submission.plan.code === 'free') {
          days = 365; // free plans don't really expire; pick a long window
        }
      }

      const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      const graceDays = submission.plan?.gracePeriodDays ?? 7;
      const graceEndsAt = new Date(endDate.getTime() + graceDays * 24 * 60 * 60 * 1000);

      // 3. Find or create the business's current subscription
      let subscription = await tx.subscription.findFirst({
        where: { businessId: submission.businessId },
        orderBy: { createdAt: 'desc' as const },
      });

      if (subscription) {
        subscription = await tx.subscription.update({
          where: { id: subscription.id },
          data: {
            planId: submission.planId,
            status: 'ACTIVE',
            startDate: now,
            endDate,
            graceEndsAt,
            cancelledAt: null,
            trialEndsAt: null,
          },
          include: { plan: true },
        });
      } else {
        subscription = await tx.subscription.create({
          data: {
            businessId: submission.businessId,
            planId: submission.planId,
            status: 'ACTIVE',
            startDate: now,
            endDate,
            graceEndsAt,
          },
          include: { plan: true },
        });
      }

      // Link the submission to the subscription record
      await tx.paymentSubmission.update({
        where: { id: submissionId },
        data: { subscriptionId: subscription.id },
      });

      // 4. Notify the business owner
      const ownerId = submission.business?.ownerId;
      if (ownerId) {
        await tx.notification.create({
          data: {
            businessId: submission.businessId,
            userId: ownerId,
            type: 'subscription_activated',
            title: 'Subscription activated',
            message: 'Your subscription has been activated by the platform administrator.',
            payload: {
              submissionId,
              subscriptionId: subscription.id,
              planCode: submission.plan?.code ?? null,
              endDate: endDate.toISOString(),
              amountMinor: submission.amountMinor.toString(),
            },
          },
        }).catch(() => { /* best effort */ });
      }

      // 5. Audit log
      await tx.auditLog.create({
        data: {
          businessId: submission.businessId,
          actorId: null,
          adminActorId: req.user!.id,
          action: 'admin.subscription.activate',
          resourceType: 'subscription',
          resourceId: subscription.id,
          change: {
            submissionId,
            planCode: submission.plan?.code ?? null,
            amountMinor: submission.amountMinor.toString(),
            daysExtended: days,
            endDate: endDate.toISOString(),
            graceEndsAt: graceEndsAt.toISOString(),
            reviewNote: body.reviewNote ?? null,
          } as Prisma.InputJsonValue,
          ipAddress: req.ip ?? null,
          userAgent: req.headers['user-agent'] ?? null,
        },
      });

      return {
        kind: 'ok' as const,
        submission: updated,
        subscription,
      };
    });

    if (result.kind === 'not_found') {
      return sendError(res, Errors.notFound('Payment submission not found'));
    }
    if (result.kind === 'bad_state') {
      return sendError(
        res,
        Errors.badRequest(
          `Payment submission is not PENDING (current status: ${result.status})`,
          'INVALID_STATE',
        ),
      );
    }

    return sendSuccess(
      res,
      {
        submission: serializePaymentSubmission(result.submission),
        subscription: serializeSubscription(result.subscription),
      },
      'Payment approved and subscription activated',
    );
  }),
);

adminRouter.post(
  '/payment-submissions/:id/reject',
  requireAdmin('admin:subscription'),
  validateBody(RejectPaymentSubmissionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as z.infer<typeof RejectPaymentSubmissionSchema>;
    const submissionId = req.params.id;

    const result = await prisma.$transaction(async (tx: Tx) => {
      const submission = await tx.paymentSubmission.findUnique({
        where: { id: submissionId },
        include: { business: true, plan: true },
      });
      if (!submission) return { kind: 'not_found' as const };
      if (submission.status !== 'PENDING') {
        return { kind: 'bad_state' as const, status: submission.status };
      }

      const updated = await tx.paymentSubmission.update({
        where: { id: submissionId },
        data: {
          status: 'REJECTED',
          reviewedById: req.user!.id,
          reviewedAt: new Date(),
          reviewNote: body.reviewNote,
        },
      });

      // Notify the submitter
      await tx.notification.create({
        data: {
          businessId: submission.businessId,
          userId: submission.submittedById,
          type: 'payment_submission_rejected',
          title: 'Payment submission rejected',
          message: 'Your payment submission has been rejected. Please contact support for details.',
          payload: {
            submissionId,
            reference: submission.reference,
            reviewNote: body.reviewNote,
            amountMinor: submission.amountMinor.toString(),
            planCode: submission.plan?.code ?? null,
          },
        },
      }).catch(() => { /* best effort */ });

      await tx.auditLog.create({
        data: {
          businessId: submission.businessId,
          actorId: null,
          adminActorId: req.user!.id,
          action: 'admin.subscription.reject',
          resourceType: 'payment_submission',
          resourceId: submissionId,
          change: {
            reference: submission.reference,
            amountMinor: submission.amountMinor.toString(),
            reviewNote: body.reviewNote,
          } as Prisma.InputJsonValue,
          ipAddress: req.ip ?? null,
          userAgent: req.headers['user-agent'] ?? null,
        },
      });

      return { kind: 'ok' as const, submission: updated };
    });

    if (result.kind === 'not_found') {
      return sendError(res, Errors.notFound('Payment submission not found'));
    }
    if (result.kind === 'bad_state') {
      return sendError(
        res,
        Errors.badRequest(
          `Payment submission is not PENDING (current status: ${result.status})`,
          'INVALID_STATE',
        ),
      );
    }

    return sendSuccess(
      res,
      serializePaymentSubmission(result.submission),
      'Payment submission rejected',
    );
  }),
);

// =====================================================
// === AUDIT LOGS (platform-wide) ===
// =====================================================

adminRouter.get(
  '/audit-logs',
  validateQuery(ListAuditLogsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as z.infer<typeof ListAuditLogsQuerySchema>;

    const where: Prisma.AuditLogWhereInput = {};
    if (q.actorId) where.actorId = q.actorId;
    if (q.adminActorId) where.adminActorId = q.adminActorId;
    if (q.businessId) where.businessId = q.businessId;
    if (q.action) where.action = { contains: q.action, mode: 'insensitive' };
    if (q.resourceType) where.resourceType = q.resourceType;
    if (q.createdFrom || q.createdTo) {
      where.createdAt = {};
      if (q.createdFrom) (where.createdAt as any).gte = q.createdFrom;
      if (q.createdTo) (where.createdAt as any).lte = q.createdTo;
    }

    const total = await prisma.auditLog.count({ where });
    const items = await prisma.auditLog.findMany({
      ...paginate({ where, orderBy: { createdAt: 'desc' as const } }, q),
      include: {
        business: { select: { id: true, name: true } },
        actor: { select: { id: true, fullName: true, email: true } },
        adminActor: { select: { id: true, fullName: true, email: true } },
      },
    });

    return sendSuccess(
      res,
      {
        items: items.map((a) => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
        })),
        meta: pageMeta(total, q),
      },
      'OK',
    );
  }),
);

// =====================================================
// === SUPPORT TICKETS ===
// =====================================================

adminRouter.get(
  '/support-tickets',
  validateQuery(ListSupportTicketsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as z.infer<typeof ListSupportTicketsQuerySchema>;

    const where: Prisma.SupportTicketWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.priority) where.priority = q.priority;
    if (q.category) where.category = { contains: q.category, mode: 'insensitive' };
    if (q.assignedToId) where.assignedToId = q.assignedToId;
    if (q.search) {
      where.OR = [
        { subject: { contains: q.search, mode: 'insensitive' } },
        { description: { contains: q.search, mode: 'insensitive' } },
      ];
    }

    const total = await prisma.supportTicket.count({ where });
    const items = await prisma.supportTicket.findMany({
      ...paginate({ where, orderBy: { createdAt: 'desc' as const } }, q),
      include: {
        business: { select: { id: true, name: true } },
        createdBy: { select: { id: true, fullName: true, email: true } },
        assignedTo: { select: { id: true, fullName: true, email: true } },
        _count: { select: { messages: true } },
      },
    });

    return sendSuccess(
      res,
      {
        items: items.map((t) => ({
          ...t,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
          resolvedAt: t.resolvedAt?.toISOString() ?? null,
          closedAt: t.closedAt?.toISOString() ?? null,
        })),
        meta: pageMeta(total, q),
      },
      'OK',
    );
  }),
);

adminRouter.post(
  '/support-tickets/:id/assign',
  validateBody(AssignTicketSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as z.infer<typeof AssignTicketSchema>;

    const [existing, assignee] = await Promise.all([
      prisma.supportTicket.findUnique({ where: { id: req.params.id } }),
      prisma.user.findUnique({ where: { id: body.assignedToId } }),
    ]);
    if (!existing) return sendError(res, Errors.notFound('Ticket not found'));
    if (!assignee) return sendError(res, Errors.badRequest('Assignee user not found', 'USER_NOT_FOUND'));

    const status = existing.status === 'OPEN' ? 'IN_PROGRESS' : existing.status;
    const updated = await prisma.supportTicket.update({
      where: { id: req.params.id },
      data: { assignedToId: body.assignedToId, status },
    });

    writeAdminAudit(req, {
      action: 'admin.support_ticket.assign',
      resourceType: 'support_ticket',
      resourceId: updated.id,
      change: { assignedToId: body.assignedToId, previousAssigneeId: existing.assignedToId },
    });

    return sendSuccess(
      res,
      {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        resolvedAt: updated.resolvedAt?.toISOString() ?? null,
        closedAt: updated.closedAt?.toISOString() ?? null,
      },
      'Ticket assigned',
    );
  }),
);

adminRouter.post(
  '/support-tickets/:id/messages',
  validateBody(CreateTicketMessageSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as z.infer<typeof CreateTicketMessageSchema>;

    const ticket = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });
    if (!ticket) return sendError(res, Errors.notFound('Ticket not found'));

    const result = await prisma.$transaction(async (tx: Tx) => {
      const message = await tx.supportMessage.create({
        data: {
          ticketId: ticket.id,
          senderId: req.user!.id,
          body: body.body,
          attachmentUrl: body.attachmentUrl ?? null,
        },
      });

      // Move ticket to WAITING_FOR_CUSTOMER if currently IN_PROGRESS
      const updatedTicket =
        ticket.status === 'IN_PROGRESS'
          ? await tx.supportTicket.update({
              where: { id: ticket.id },
              data: { status: 'WAITING_FOR_CUSTOMER' },
            })
          : ticket;

      return { message, ticket: updatedTicket };
    });

    writeAdminAudit(req, {
      action: 'admin.support_ticket.message',
      resourceType: 'support_ticket',
      resourceId: ticket.id,
      change: { messageId: result.message.id },
    });

    return sendSuccess(
      res,
      {
        ...result.message,
        createdAt: result.message.createdAt.toISOString(),
      },
      'Message created',
      201,
    );
  }),
);

adminRouter.patch(
  '/support-tickets/:id/status',
  validateBody(UpdateTicketStatusSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as z.infer<typeof UpdateTicketStatusSchema>;

    const existing = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });
    if (!existing) return sendError(res, Errors.notFound('Ticket not found'));

    const now = new Date();
    const data: Prisma.SupportTicketUpdateInput = { status: body.status };
    if (body.status === 'RESOLVED' && !existing.resolvedAt) {
      data.resolvedAt = now;
    }
    if (body.status === 'CLOSED' && !existing.closedAt) {
      data.closedAt = now;
      if (!existing.resolvedAt) data.resolvedAt = now;
    }

    const updated = await prisma.supportTicket.update({
      where: { id: req.params.id },
      data,
    });

    writeAdminAudit(req, {
      action: 'admin.support_ticket.status',
      resourceType: 'support_ticket',
      resourceId: updated.id,
      change: { previousStatus: existing.status, newStatus: body.status },
    });

    return sendSuccess(
      res,
      {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        resolvedAt: updated.resolvedAt?.toISOString() ?? null,
        closedAt: updated.closedAt?.toISOString() ?? null,
      },
      'Ticket status updated',
    );
  }),
);

// =====================================================
// === PLATFORM CONFIG ===
// =====================================================

adminRouter.get(
  '/config',
  asyncHandler(async (_req: Request, res: Response) => {
    const items = await prisma.platformConfig.findMany({
      orderBy: { key: 'asc' as const },
    });
    return sendSuccess(
      res,
      items.map((c) => ({ ...c, updatedAt: c.updatedAt.toISOString() })),
      'OK',
    );
  }),
);

adminRouter.post(
  '/config',
  validateBody(CreateConfigSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as z.infer<typeof CreateConfigSchema>;

    // Protect admin_users / admin_user_roles from accidental overwrite
    if (body.key === ADMIN_USERS_KEY || body.key === ADMIN_USER_ROLES_KEY) {
      return sendError(
        res,
        Errors.badRequest(
          'Use the dedicated admin user management endpoints to modify this key',
          'PROTECTED_KEY',
        ),
      );
    }

    const updated = await prisma.platformConfig.upsert({
      where: { key: body.key },
      update: { value: body.value },
      create: { key: body.key, value: body.value },
    });

    writeAdminAudit(req, {
      action: 'admin.config.set',
      resourceType: 'platform_config',
      resourceId: body.key,
      change: { key: body.key, value: body.value },
    });

    return sendSuccess(
      res,
      { ...updated, updatedAt: updated.updatedAt.toISOString() },
      'Config saved',
      201,
    );
  }),
);

adminRouter.get(
  '/config/:key',
  asyncHandler(async (req: Request, res: Response) => {
    const cfg = await prisma.platformConfig.findUnique({
      where: { key: req.params.key },
    });
    if (!cfg) return sendError(res, Errors.notFound('Config key not found'));

    return sendSuccess(
      res,
      { ...cfg, updatedAt: cfg.updatedAt.toISOString() },
      'OK',
    );
  }),
);

adminRouter.delete(
  '/config/:key',
  asyncHandler(async (req: Request, res: Response) => {
    if (req.params.key === ADMIN_USERS_KEY || req.params.key === ADMIN_USER_ROLES_KEY) {
      return sendError(
        res,
        Errors.badRequest(
          'Cannot delete protected admin config key',
          'PROTECTED_KEY',
        ),
      );
    }

    const existing = await prisma.platformConfig.findUnique({
      where: { key: req.params.key },
    });
    if (!existing) return sendError(res, Errors.notFound('Config key not found'));

    await prisma.platformConfig.delete({ where: { key: req.params.key } });

    writeAdminAudit(req, {
      action: 'admin.config.delete',
      resourceType: 'platform_config',
      resourceId: req.params.key,
      change: { key: req.params.key, previousValue: existing.value },
    });

    return sendSuccess(res, { key: req.params.key }, 'Config deleted');
  }),
);
