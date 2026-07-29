import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  status: { type: String, default: 'disabled' },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['default', 'administrator', 'finance', 'company_admin', 'super_admin'],
    default: 'default'
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null,
    index: true
  },
  // Quando setado, restringe este login a ver apenas os Projetos vinculados
  // a este Cliente e os Tickets desses projetos ou vinculados diretamente a
  // ele (acesso tipo "portal do cliente").
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    default: null,
    index: true
  },
  passwordResetTokenHash: { type: String, default: null },
  passwordResetExpiresAt: { type: Date, default: null },
}, { timestamps: true });


UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    this.password = await bcrypt.hash(this.password, salt);
    return next();
  } catch (err) { return next(err); }
});

UserSchema.methods.comparePassword = function(candidate) {
  return bcrypt.compare(candidate, this.password);
};


export default mongoose.model('User', UserSchema);