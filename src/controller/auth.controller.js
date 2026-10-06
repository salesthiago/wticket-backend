
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/user.model.js';
import Company from '../models/company.model.js';
import logger from '../utils/logger.js';
import emailService from '../services/email/email.service.js';

const RESET_TOKEN_EXPIRES_MINUTES = 60;



const generateToken = (user, { companyId, modules } = {}) => {
  const JWT_SECRET = process.env.JWT_SECRET;
  const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

  if (!JWT_SECRET) {
    logger.error('JWT_SECRET not set in .env');
  }
  const payload = {
    sub: user._id.toString(),
    email: user.email,
    role: user.role,
    companyId: companyId ? companyId.toString() : null,
    customerId: user.customerId ? user.customerId.toString() : null,
    modules: modules || []
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

const buildAuthContext = async (user) => {
  if (!user.companyId) return { companyId: null, modules: [], company: null };
  const company = await Company.findById(user.companyId);
  if (!company) return { companyId: user.companyId, modules: [], company: null };
  // Empresas isentas têm todos os módulos cadastrados ativos, sem verificar pagamento
  const modules = company.activeModuleCodes();
  return { companyId: user.companyId, modules, company };
};

export const register = async (req, res) => {
  return res.status(410).json({
    message: 'Direct user registration is disabled. Use POST /api/companies/register to create a company and its first user.'
  });
};

export const login = async (req, res) => {
  try {

    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'email and password required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    const { companyId, modules, company } = await buildAuthContext(user);

    if (user.role !== 'super_admin') {
      if (!company) {
        return res.status(403).json({ message: 'User has no company associated' });
      }
      // Empresa isenta de assinatura: acesso livre independente do status de pagamento.
      // 'suspended'/'pending_payment' (trial vencido ou 1ª cobrança pendente) NÃO
      // bloqueiam mais o login — o usuário precisa conseguir entrar para ver a
      // faixa de aviso e concluir o pagamento em /checkout (billing-guard.middleware
      // bloqueia as gravações e a tela de checkout libera o pagamento). Só
      // 'cancelled' (ação manual do super_admin) continua barrando o acesso.
      if (!company.subscriptionExempt && company.status === 'cancelled') {
        return res.status(403).json({
          message: 'Empresa cancelada. Entre em contato com o suporte.',
          companyStatus: company.status
        });
      }
    }

    const token = generateToken(user, { companyId, modules });
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: companyId || null,
        customerId: user.customerId || null
      },
      modules
    });
  } catch (err) {
    logger.error('Login error', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const GENERIC_FORGOT_MESSAGE = 'Se o e-mail informado estiver cadastrado, você receberá um link para redefinir a senha.';

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'email é obrigatório' });

    const user = await User.findOne({ email });
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      user.passwordResetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
      user.passwordResetExpiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRES_MINUTES * 60 * 1000);
      await user.save();

      const link = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
      try {
        await emailService.sendTemplated('forgot_password', user.email, {
          name: user.name,
          link,
          expiresInMinutes: RESET_TOKEN_EXPIRES_MINUTES
        });
      } catch (err) {
        logger.warn(`forgotPassword :: e-mail não enviado p/ ${user.email}: ${err.message}`);
      }
    }

    return res.json({ message: GENERIC_FORGOT_MESSAGE });
  } catch (err) {
    logger.error('forgotPassword error', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ message: 'token e password são obrigatórios' });

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() }
    });
    if (!user) return res.status(400).json({ message: 'Token inválido ou expirado' });

    user.password = password;
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    await user.save();

    return res.json({ message: 'Senha redefinida com sucesso' });
  } catch (err) {
    logger.error('resetPassword error', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};
