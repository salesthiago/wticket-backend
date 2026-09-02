
import express from 'express'
import { authenticate, blockCustomerScope } from '../middleware/auth.middleware.js'
import * as planController from '../controller/plan.controller.js'
import * as moduleController from '../controller/module.controller.js'
import * as companyController from '../controller/company.controller.js'
import * as paymentController from '../controller/billing/payment.controller.js'
import usersRoutes from './users.routes.js'
import authRoutes from './auth.routes.js';
// import whatsappRoutes from './whatsapp.routes.js' // desabilitado: será serviço separado
import contactRoutes from './contact.routes.js'
import ticketRoutes from './ticket.routes.js'
import ticketCategoryRoutes from './ticket-category.routes.js'
import ticketSubjectRoutes from './ticket-subject.routes.js'
import ticketStatusRoutes from './ticket-status.routes.js'
import projectRoutes from './project.routes.js'
import projectStatusRoutes from './project-status.routes.js'
import homeRoutes from './home.routes.js'
import profileRoutes from './profile.routes.js'
// import botConfig from './bot-config.routes.js' // desabilitado: dependente do WhatsApp
import appointmentRoutes from './appointment.routes.js'
import productRoutes from './product.routes.js'
import customerRoutes from './customer.routes.js'
import vehicleRoutes from './vehicle.routes.js'
import leadRoutes from './lead.routes.js'
import aiAgentRoutes from './ai-agent.routes.js'
import aiProvidersRoutes from './ai-providers.routes.js'
import serviceOrderRoutes from './service-order.routes.js'
import companyRoutes from './company.routes.js'
import moduleRoutes from './module.routes.js'
import nfseRoutes from './nfse/index.js'
import financialRoutes from './financial/index.js'
import billingRoutes from './billing.routes.js'
import planRoutes from './plan.routes.js'
import dashboardRoutes from './dashboard.routes.js'
import emailConfigRoutes from './email-config.routes.js'
import swaggerUi from 'swagger-ui-express'
//import swaggerFile from './swagger.json'

const router = express.Router();

router.use('/auth', authRoutes);

// Público: a tela de cadastro (/register, sem login) precisa listar planos e
// módulos, e submeter o cadastro em si, antes de qualquer autenticação. O
// webhook de pagamento também precisa ficar aqui — ele se autentica sozinho
// via ?webhookSecret=...+HMAC (a AbacatePay não envia JWT). Ficam antes do
// gate global abaixo para não exigir token — as demais rotas de /plans,
// /modules, /companies e /billing continuam protegidas normalmente lá embaixo.
router.get('/plans', planController.findAll);
router.get('/modules', moduleController.findAll);
router.post('/companies/register', companyController.register);
router.post('/billing/webhook', paymentController.webhook);
router.post('/billing/webhook/itau', paymentController.itauWebhook);

// A partir daqui todo mundo passa por authenticate. Logins de cliente (com
// customerId vinculado — ver models/user.model.js) só podem prosseguir além
// de blockCustomerScope se a rota for uma das liberadas logo abaixo
// (Projetos/Tickets + o próprio perfil).
router.use(authenticate);

router.use('/tickets', ticketRoutes);
router.use('/ticket-categories', ticketCategoryRoutes);
router.use('/ticket-subjects', ticketSubjectRoutes);
router.use('/ticket-statuses', ticketStatusRoutes);
router.use('/projects', projectRoutes);
router.use('/project-statuses', projectStatusRoutes);
router.use('/profile', profileRoutes);

router.use(blockCustomerScope);

router.use('/companies', companyRoutes);
router.use('/modules', moduleRoutes);
router.use('/plans', planRoutes);
router.use('/users', usersRoutes);
// router.use('/whatsapp', whatsappRoutes); // desabilitado: será serviço separado
router.use('/contacts', contactRoutes);
router.use('/home', homeRoutes);
// router.use('/bot-config', botConfig); // desabilitado: dependente do WhatsApp
router.use('/appointments', appointmentRoutes);
router.use('/products', productRoutes);
router.use('/customers', customerRoutes);
router.use('/vehicles', vehicleRoutes);
router.use('/leads', leadRoutes);
router.use('/ai-agents', aiAgentRoutes);
router.use('/ai-providers', aiProvidersRoutes);
router.use('/service-orders', serviceOrderRoutes);
router.use('/nfse', nfseRoutes);
router.use('/financial', financialRoutes);
router.use('/billing', billingRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/email-config', emailConfigRoutes);
//router.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerFile));

export default router