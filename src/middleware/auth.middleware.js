import jwt from "jsonwebtoken";
import logger from "../utils/logger.js";

export const authenticate = (req, res, next) => {
  const JWT_SECRET = process.env.JWT_SECRET;

  if (!JWT_SECRET) {
    logger.warn("JWT_SECRET not set — auth will fail if used");
  }

  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "Missing or invalid Authorization header" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // contains sub, email, role
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

// For socket.io: verify token and return payload or null
export const verifyToken = (token) => {
  const JWT_SECRET = process.env.JWT_SECRET;

  if (!JWT_SECRET) {
    logger.warn("JWT_SECRET not set — auth will fail if used");
  }
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
};

// Require the authenticated user to belong to a Company (tenant scope)
export const requireTenant = (req, res, next) => {
  if (!req.user?.companyId) {
    return res.status(403).json({ message: "Tenant access required" });
  }
  next();
};

// Require the authenticated user to be a super_admin
export const requireSuperAdmin = (req, res, next) => {
  if (req.user?.role !== "super_admin") {
    return res.status(403).json({ message: "Super admin only" });
  }
  next();
};

// Require the company to have a specific module active.
// Relies on JWT carrying `modules` array of active module codes.
export const requireModule = (code) => (req, res, next) => {
  const modules = req.user?.modules || [];
  if (!modules.includes(code)) {
    return res.status(403).json({ message: `Module '${code}' is not active for this company` });
  }
  next();
};

// Require the user to have one of the listed roles.
// `super_admin` is implicitly allowed everywhere (platform owner).
export const requireRole = (...allowedRoles) => (req, res, next) => {
  const role = req.user?.role;
  if (role === 'super_admin') return next();
  if (allowedRoles.includes(role)) return next();
  return res.status(403).json({ message: `Role '${role}' is not allowed for this resource` });
};
