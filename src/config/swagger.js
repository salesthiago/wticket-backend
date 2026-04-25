import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'WTicket API',
      version: '1.0.0',
      description: 'API do sistema WTicket - Gestão de atendimento, WhatsApp e ordens de serviço'
    },
    servers: [
      {
        url: '/api',
        description: 'API Base'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [{ bearerAuth: [] }]
  },
  apis: ['./src/docs/*.js']
};

export default swaggerJsdoc(options);
