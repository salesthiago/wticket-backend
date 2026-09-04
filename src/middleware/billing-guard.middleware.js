import subscriptionService from '../services/billing/subscription.service.js';
import logger from '../utils/logger.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Bloqueia gravação (POST/PUT/PATCH/DELETE) quando a empresa não é isenta e
// não tem nenhum módulo ativo (trial expirado ou assinatura vencida sem
// renovação). Devolve 402 com a cobrança pendente para o front redirecionar
// ao checkout — leitura (GET) continua liberada normalmente.
export const requireBillingOk = async (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  if (req.path.startsWith('/billing')) return next(); // libera o próprio checkout/webhook
  if (req.user?.role === 'super_admin') return next();
  if (req.user?.customerId) return next(); // portal de cliente: não é gate de assinatura da empresa
  if (!req.user?.companyId) return next();

  try {
    const status = await subscriptionService.getBillingStatus(req.user.companyId);
    if (status.blocked) {
      return res.status(402).json({
        message: 'Seu período de teste/assinatura expirou. Conclua o pagamento para continuar.',
        code: 'SUBSCRIPTION_PAYMENT_REQUIRED',
        billing: status
      });
    }
    return next();
  } catch (err) {
    // Falha aberta: um erro no gate não deve derrubar o app inteiro.
    logger.error('BillingGuard :: erro ao verificar assinatura', err);
    return next();
  }
};
