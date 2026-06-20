import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Payment from '../models/billing/payment.model.js';
dotenv.config();

// Smoke test ponta-a-ponta do fluxo de ASSINATURA via AbacatePay v2 (modo dev).
// Requer: backend rodando em API_BASE, Mongo de pé e super_admin seedado.
//   node src/scripts/abacatepay-smoke-test.js
const API = process.env.API_BASE || 'http://localhost:3000/api';
const ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'sales.go@gmail.com';
const ADMIN_PASS = process.env.SUPER_ADMIN_PASSWORD || 'root!@#123';
const WEBHOOK_SECRET = process.env.ABACATEPAY_WEBHOOK_SECRET || '';

const log = (...a) => console.log(...a);
const die = (msg, extra) => { console.error('❌', msg, extra ?? ''); process.exit(1); };

async function call(method, path, { token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  return { status: res.status, data };
}

async function fireWebhook(body) {
  return call('POST', `/billing/webhook?webhookSecret=${encodeURIComponent(WEBHOOK_SECRET)}`, { body });
}

async function main() {
  const stamp = Date.now();
  const subId = `subs_smoke_${stamp}`;
  if (!WEBHOOK_SECRET) die('ABACATEPAY_WEBHOOK_SECRET não definido no .env');

  // 1) Login super_admin
  log('\n1) Login super_admin...');
  const login = await call('POST', '/auth/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PASS } });
  if (login.status !== 200 || !login.data?.token) die('login falhou', login);
  const token = login.data.token;
  log('   ✔ token obtido');

  // 2) Criar plano (assinatura) → deve criar o Product recorrente no AbacatePay
  log('\n2) Criar plano (assinatura) → sincroniza produto no AbacatePay...');
  const planBody = {
    name: `Smoke Plan ${stamp}`,
    description: 'Plano gerado pelo smoke test',
    moduleCodes: ['service_order', 'financial'],
    price: 149.9,
    cycle: 'MONTHLY',
    isActive: true
  };
  const plan = await call('POST', '/plans', { token, body: planBody });
  if (plan.status !== 201) die('criar plano falhou', plan);
  const planId = plan.data._id;
  log(`   ✔ plano ${planId} | abacateProductId=${plan.data.abacateProductId || '—'}${plan.data.abacateError ? ' | abacateError=' + plan.data.abacateError : ''}`);

  // 3) Registrar empresa com o plano → cria customer + assinatura no AbacatePay
  log('\n3) Registrar empresa → cria customer + assinatura...');
  const reg = await call('POST', '/companies/register', {
    body: {
      company: { name: `Empresa Smoke ${stamp}`, email: `empresa${stamp}@smoke.test`, documentType: 'cnpj' },
      owner: { name: 'Dono Smoke', email: `dono${stamp}@smoke.test`, password: 'senha123' },
      planId
    }
  });
  if (reg.status !== 201) die('register falhou', reg);
  const companyId = reg.data.company.id;
  log(`   ✔ empresa criada: ${companyId} status=${reg.data.company.status}`);

  let billingId;
  if (reg.data.checkout) {
    billingId = reg.data.checkout.providerBillingId;
    log(`   ✔ assinatura AbacatePay: billingId=${billingId} amount=R$ ${reg.data.checkout.amount}`);
    log(`     url=${reg.data.checkout.url}`);
  } else {
    // AbacatePay indisponível: valida a ativação criando o Payment direto no Mongo.
    log(`   ⚠ checkout real falhou: ${reg.data.checkoutError}`);
    log('   ↪ fallback: criando Payment sintético no Mongo p/ testar a ativação...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/wticket');
    billingId = `bill_smoke_${stamp}`;
    await Payment.create({
      companyId, planId, provider: 'abacatepay', providerBillingId: billingId,
      kind: 'subscription', amount: planBody.price, moduleCodes: planBody.moduleCodes,
      periodDays: 30, status: 'pending', metadata: { externalId: String(companyId) }
    });
    await mongoose.disconnect();
    log(`   ✔ Payment sintético criado: ${billingId}`);
  }

  // 4) Estado ANTES
  const before = await call('GET', `/companies/${companyId}`, { token });
  log(`\n4) Antes: company.status=${before.data.status}`);
  before.data.modules.forEach(m => log(`     - ${m.code}: ${m.subscriptionStatus}`));

  // 5) Webhook subscription.completed → ativa
  log('\n5) Webhook subscription.completed...');
  const completed = await fireWebhook({
    id: `log_done_${stamp}`, event: 'subscription.completed', apiVersion: 2,
    data: {
      subscription: { id: subId, status: 'ACTIVE', frequency: 'MONTHLY' },
      customer: { id: 'cust_smoke' },
      payment: { id: billingId, externalId: String(companyId), status: 'PAID', amount: 14990 }
    }
  });
  if (completed.status !== 200) die('webhook completed falhou', completed);
  log('   ✔ processado (200)');

  const after = await call('GET', `/companies/${companyId}`, { token });
  const exp1 = after.data.modules[0]?.expiresAt;
  log(`\n6) Depois: company.status=${after.data.status}`);
  after.data.modules.forEach(m => log(`     - ${m.code}: ${m.subscriptionStatus} (expira ${m.expiresAt || '—'})`));

  // 7) Idempotência: reenvio do MESMO evento (mesmo log id) não deve estender
  await fireWebhook({
    id: `log_done_${stamp}`, event: 'subscription.completed', apiVersion: 2,
    data: { subscription: { id: subId }, payment: { id: billingId, externalId: String(companyId), status: 'PAID' } }
  });
  const afterDup = await call('GET', `/companies/${companyId}`, { token });
  const expDup = afterDup.data.modules[0]?.expiresAt;
  log(`\n7) Idempotência (mesmo evento): expira ${expDup} ${expDup === exp1 ? '(inalterado ✔)' : '(MUDOU ✗)'}`);

  // 8) Renovação: subscription.renewed (novo evento) → estende o expiresAt
  log('\n8) Webhook subscription.renewed (renovação)...');
  await fireWebhook({
    id: `log_renew_${stamp}`, event: 'subscription.renewed', apiVersion: 2,
    data: { subscription: { id: subId, status: 'ACTIVE' }, payment: { id: `char_${stamp}`, externalId: String(companyId), status: 'PAID' } }
  });
  const afterRenew = await call('GET', `/companies/${companyId}`, { token });
  const exp2 = afterRenew.data.modules[0]?.expiresAt;
  const extended = new Date(exp2) > new Date(exp1);
  log(`   expira agora ${exp2} ${extended ? '(estendido ✔)' : '(NÃO estendeu ✗)'}`);

  // Veredito
  const ok = after.data.status === 'active'
    && after.data.modules.every(m => m.subscriptionStatus === 'active' && m.expiresAt)
    && expDup === exp1
    && extended;
  log(`\n${ok ? '✅ SUCESSO' : '❌ FALHA'}: ativação + idempotência + renovação ${ok ? 'OK' : 'com problema'}.`);
  process.exit(ok ? 0 : 1);
}

main().catch(e => die('erro inesperado', e?.message || e));
