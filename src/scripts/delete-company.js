// Apaga um cadastro de empresa (Company) + todos os Users vinculados a ela,
// para permitir um recadastro limpo com o mesmo e-mail (ex.: testar o fluxo
// de trial após o fix de plan.controller.js).
//
// Por segurança, roda em modo "dry-run" por padrão: só mostra o que seria
// apagado. Para apagar de fato, passe --confirm.
//
// Uso:
//   node src/scripts/delete-company.js <emailDaEmpresaOuDoDono>            (dry-run)
//   node src/scripts/delete-company.js <emailDaEmpresaOuDoDono> --confirm  (apaga de verdade)

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Company from '../models/company.model.js';
import User from '../models/user.model.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/wticket';

async function main() {
  const [, , identifier, flag] = process.argv;
  const confirm = flag === '--confirm';

  if (!identifier) {
    console.error('Uso: node src/scripts/delete-company.js <emailDaEmpresaOuDoDono> [--confirm]');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log(`Conectado a ${MONGO_URI}`);

  try {
    const email = identifier.toLowerCase().trim();
    let company = await Company.findOne({ email });

    if (!company) {
      const owner = await User.findOne({ email });
      if (owner?.companyId) company = await Company.findById(owner.companyId);
    }

    if (!company) {
      console.error(`Nenhuma empresa encontrada para "${identifier}"`);
      process.exit(1);
    }

    const users = await User.find({ companyId: company._id });

    console.log(`Empresa: ${company.name} (${company._id}) — email: ${company.email} — status: ${company.status}`);
    console.log(`Usuários vinculados (${users.length}):`);
    users.forEach(u => console.log(`  - ${u.name} <${u.email}> (${u.role})`));

    if (!confirm) {
      console.log('\nDRY-RUN: nada foi apagado. Rode novamente com --confirm para excluir de verdade.');
      return;
    }

    await User.deleteMany({ companyId: company._id });
    await Company.deleteOne({ _id: company._id });

    console.log(`\nExcluído: empresa "${company.name}" e ${users.length} usuário(s) vinculado(s).`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(err => {
  console.error('Erro ao excluir empresa:', err);
  process.exit(1);
});
