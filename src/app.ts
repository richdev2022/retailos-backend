import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { config } from './config/index.js';
import { authMiddleware, optionalAuthMiddleware } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/error.js';
import { registerAuditFinishHook } from './middleware/audit.js';

// Routers
import { authRouter } from './modules/auth/routes.js';
import { businessRouter } from './modules/businesses/routes.js';
import { productRouter } from './modules/products/routes.js';
import { inventoryRouter } from './modules/inventory/routes.js';
import { saleRouter } from './modules/sales/routes.js';
import { purchaseRouter } from './modules/purchases/routes.js';
import { expenseRouter } from './modules/expenses/routes.js';
import { customerRouter } from './modules/customers/routes.js';
import { supplierRouter } from './modules/suppliers/routes.js';
import { reportRouter } from './modules/reports/routes.js';
import { subscriptionRouter } from './modules/subscriptions/routes.js';
import { branchRouter } from './modules/branches/routes.js';
import { syncRouter } from './modules/sync/routes.js';
import { staffRouter } from './modules/staff/routes.js';
import { notificationRouter } from './modules/notifications/routes.js';
import { supportRouter } from './modules/support/routes.js';
import { adminRouter } from './modules/admin/routes.js';
import { settingsRouter } from './modules/settings/routes.js';

import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './swagger.js';

export function createApp() {
  const app = express();

  // --- core middleware ---
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(compression());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(cookieParser());
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin || config.cors.origins.includes(origin)) {
          cb(null, true);
        } else {
          cb(null, false); // silently reject unknown origins
        }
      },
      credentials: config.cors.credentials,
    }),
  );
  app.use(morgan(config.isDev ? 'dev' : 'combined'));

  // --- static ---
  app.use('/uploads', express.static(config.storage.uploadDir));

  // --- global rate limit ---
  app.use(
    config.apiPrefix,
    rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.max,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  // --- health ---
  app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

  // --- API docs ---
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // --- routes (mounted under /api/v1) ---
  const v1 = express.Router();
  v1.use(optionalAuthMiddleware); // attach user if token present, but don't require

  // public-ish
  v1.use('/auth', authRouter);

  // business-scoped — require auth + active business
  v1.use('/businesses', authMiddleware, businessRouter);
  v1.use('/staff', authMiddleware, staffRouter);
  v1.use('/products', authMiddleware, productRouter);
  v1.use('/inventory', authMiddleware, inventoryRouter);
  v1.use('/sales', authMiddleware, saleRouter);
  v1.use('/purchases', authMiddleware, purchaseRouter);
  v1.use('/expenses', authMiddleware, expenseRouter);
  v1.use('/customers', authMiddleware, customerRouter);
  v1.use('/suppliers', authMiddleware, supplierRouter);
  v1.use('/reports', authMiddleware, reportRouter);
  v1.use('/subscriptions', authMiddleware, subscriptionRouter);
  v1.use('/branches', authMiddleware, branchRouter);
  v1.use('/sync', authMiddleware, syncRouter);
  v1.use('/notifications', authMiddleware, notificationRouter);
  v1.use('/support', authMiddleware, supportRouter);
  v1.use('/settings', authMiddleware, settingsRouter);

  // admin portal — separate auth scope (admin auth handled inside router)
  v1.use('/admin', adminRouter);

  app.use(config.apiPrefix, v1);

  // --- audit finish hook (after route handlers, before error handler) ---
  app.use((req: Request, res: Response, _next: NextFunction) => {
    registerAuditFinishHook(req, res);
    _next();
  });

  // --- error handling ---
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
