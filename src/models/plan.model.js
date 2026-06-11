import mongoose from 'mongoose';
import { MODULE_CODES } from './module.model.js';

// Ciclos de cobrança aceitos pelo AbacatePay (assinaturas) e a duração
// aproximada em dias usada para calcular o expiresAt dos módulos.
export const PLAN_CYCLES = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUALLY', 'ANNUALLY'];
export const CYCLE_DAYS = {
  WEEKLY: 7,
  MONTHLY: 30,
  QUARTERLY: 90,
  SEMIANNUALLY: 180,
  ANNUALLY: 365
};
export function cycleToDays(cycle) {
  return CYCLE_DAYS[cycle] || 30;
}

// Um Plano (Assinatura) agrupa vários módulos do sistema sob um ÚNICO preço,
// cobrado de forma recorrente (ciclo). É um catálogo reutilizável e cada plano
// corresponde a um Product recorrente no AbacatePay (abacateProductId).
const PlanSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, unique: true },
  description: { type: String, trim: true },
  moduleCodes: {
    type: [{ type: String, enum: MODULE_CODES }],
    validate: {
      validator: (arr) => Array.isArray(arr) && arr.length > 0,
      message: 'O plano precisa de ao menos um módulo'
    }
  },
  // Preço único do bundle, em BRL (reais).
  price: { type: Number, required: true, min: 0 },
  // Ciclo de cobrança recorrente (define a recorrência no AbacatePay).
  cycle: { type: String, enum: PLAN_CYCLES, default: 'MONTHLY' },
  // Vínculo com o Product recorrente criado no AbacatePay.
  abacateProductId: { type: String, trim: true },
  abacateProductExternalId: { type: String, trim: true },
  isActive: { type: Boolean, default: true, index: true }
}, { timestamps: true });

export default mongoose.model('Plan', PlanSchema);
