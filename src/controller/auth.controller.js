
import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import Company from '../models/company.model.js';
import logger from '../utils/logger.js';



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
      // Empresa isenta de assinatura: acesso livre independente do status de pagamento
      if (!company.subscriptionExempt && company.status !== 'active') {
        return res.status(403).json({
          message: `Company is not active (status: ${company.status})`,
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
        companyId: companyId || null
      },
      modules
    });
  } catch (err) {
    logger.error('Login error', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};
