import swaggerJSDoc from 'swagger-jsdoc';

const spec = swaggerJSDoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'RetailOS API',
      version: '1.0.0',
      description:
        'Multi-tenant retail inventory, POS and business management SaaS.\n\n' +
        'All business-scoped endpoints require an `Authorization: Bearer <access-token>` header ' +
        'and (after business onboarding) an `X-Business-Id` header pointing to the active business.',
    },
    servers: [
      { url: '/api/v1', description: 'v1' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/modules/**/routes.ts', './src/modules/**/*.ts'],
});

export default spec;
