import logger from '../../utils/logger.js';
import platformBillingService from '../../services/billing/platform-billing.service.js';

function sendError(res, err, fallback = 'Internal server error') {
  const status = err?.status || 500;
  if (status >= 500) logger.error('Platform billing controller error', err);
  return res.status(status).json({ message: err?.message || fallback });
}

const userId = (req) => req.user?.sub || req.user?.id;

// GET /platform/billing/overview
export const overview = async (_req, res) => {
  try {
    return res.status(200).json(await platformBillingService.overview());
  } catch (err) {
    return sendError(res, err);
  }
};

// GET /platform/billing/payments?companyId=&status=&provider=
export const listPayments = async (req, res) => {
  try {
    const { companyId, status, provider } = req.query;
    return res.status(200).json(await platformBillingService.listPayments({ companyId, status, provider }));
  } catch (err) {
    return sendError(res, err);
  }
};

// POST /platform/billing/charges  { companyId, method, amount?, dueDate?, description? }
export const createCharge = async (req, res) => {
  try {
    const { companyId, method, amount, dueDate, description } = req.body || {};
    if (!companyId) return res.status(422).json({ message: 'companyId é obrigatório' });
    const payment = await platformBillingService.createCharge({
      companyId, method, amount, dueDate, description, userId: userId(req)
    });
    return res.status(201).json(payment);
  } catch (err) {
    return sendError(res, err);
  }
};

// POST /platform/billing/payments/:id/mark-paid  { paidAt? }
export const markPaid = async (req, res) => {
  try {
    const payment = await platformBillingService.markPaid(req.params.id, { paidAt: req.body?.paidAt, userId: userId(req) });
    return res.status(200).json(payment);
  } catch (err) {
    return sendError(res, err);
  }
};

// POST /platform/billing/payments/:id/cancel
export const cancel = async (req, res) => {
  try {
    return res.status(200).json(await platformBillingService.cancel(req.params.id, { userId: userId(req) }));
  } catch (err) {
    return sendError(res, err);
  }
};

// POST /platform/billing/payments/:id/refund  { reason, revokeAccess? }
export const refund = async (req, res) => {
  try {
    const { reason, revokeAccess } = req.body || {};
    const payment = await platformBillingService.refund(req.params.id, {
      reason, revokeAccess: revokeAccess !== false, userId: userId(req)
    });
    return res.status(200).json(payment);
  } catch (err) {
    return sendError(res, err);
  }
};
