
import express from 'express'
import usersRoutes from './users.routes.js'
import authRoutes from './auth.routes.js';
// import whatsappRoutes from './whatsapp.routes.js' // desabilitado: será serviço separado
import contactRoutes from './contact.routes.js'
import ticketRoutes from './ticket.routes.js'
import ticketCategoryRoutes from './ticket-category.routes.js'
import ticketSubjectRoutes from './ticket-subject.routes.js'
import ticketStatusRoutes from './ticket-status.routes.js'
import homeRoutes from './home.routes.js'
import profileRoutes from './profile.routes.js'
// import botConfig from './bot-config.routes.js' // desabilitado: dependente do WhatsApp
import appointmentRoutes from './appointment.routes.js'
import geminiRoutes from './gemini.routes.js'
import productRoutes from './product.routes.js'
import customerRoutes from './customer.routes.js'
import leadRoutes from './lead.routes.js'
import aiAgentRoutes from './ai-agent.routes.js'
import aiProvidersRoutes from './ai-providers.routes.js'
import serviceOrderRoutes from './service-order.routes.js'

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
// router.use('/whatsapp', whatsappRoutes); // desabilitado: será serviço separado
router.use('/contacts', contactRoutes);
router.use('/tickets', ticketRoutes);
router.use('/ticket-categories', ticketCategoryRoutes);
router.use('/ticket-subjects', ticketSubjectRoutes);
router.use('/ticket-statuses', ticketStatusRoutes);
router.use('/home', homeRoutes);
router.use('/profile', profileRoutes);
// router.use('/bot-config', botConfig); // desabilitado: dependente do WhatsApp
router.use('/appointments', appointmentRoutes);
router.use('/gemini', geminiRoutes);
router.use('/products', productRoutes);
router.use('/customers', customerRoutes);
router.use('/leads', leadRoutes);
router.use('/ai-agents', aiAgentRoutes);
router.use('/ai-providers', aiProvidersRoutes);
router.use('/service-orders', serviceOrderRoutes);

export default router