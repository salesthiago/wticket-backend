import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/user.model.js';
import Contact from '../models/contact.model.js';
import Session from '../models/session.model.js';
import Ticket from '../models/ticket.model.js';
import Message from '../models/message.model.js';
import License from '../models/license.model.js';

// Carregar variáveis de ambiente
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/wticket';

// Conectar ao MongoDB
async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Conectado ao MongoDB com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao conectar ao MongoDB:', error);
    process.exit(1);
  }
}

// Limpar banco de dados
async function clearDatabase() {
  console.log('\n🗑️  Limpando banco de dados...');

  await User.deleteMany({});
  await Contact.deleteMany({});
  await Session.deleteMany({});
  await Ticket.deleteMany({});
  await Message.deleteMany({});
  await License.deleteMany({});

  console.log('✅ Banco de dados limpo!');
}

// Criar usuários
async function createUsers() {
  console.log('\n👥 Criando usuários...');

  const usersData = [
    {
      name: 'Administrador',
      email: 'admin@wticket.com',
      password: 'admin123',
      role: 'administrator',
      status: 'enabled'
    },
    {
      name: 'João Silva',
      email: 'joao@wticket.com',
      password: 'joao123',
      role: 'default',
      status: 'enabled'
    },
    {
      name: 'Maria Santos',
      email: 'maria@wticket.com',
      password: 'maria123',
      role: 'default',
      status: 'enabled'
    },
    {
      name: 'Pedro Oliveira',
      email: 'pedro@wticket.com',
      password: 'pedro123',
      role: 'default',
      status: 'disabled'
    }
  ];

  // Usar create() em vez de insertMany() para disparar os hooks do Mongoose
  const createdUsers = await User.create(usersData);
  console.log(`✅ ${createdUsers.length} usuários criados!`);

  return createdUsers;
}

// Criar sessões do WhatsApp
async function createSessions() {
  console.log('\n📱 Criando sessões do WhatsApp...');

  const sessions = [
    {
      name: 'atendimento-principal',
      status: 'notConnected',
      number: null,
      qrCode: null
    },
    {
      name: 'vendas',
      status: 'notConnected',
      number: null,
      qrCode: null
    },
    {
      name: 'suporte',
      status: 'notConnected',
      number: null,
      qrCode: null
    }
  ];

  const createdSessions = await Session.insertMany(sessions);
  console.log(`✅ ${createdSessions.length} sessões criadas!`);

  return createdSessions;
}

// Criar contatos
async function createContacts() {
  console.log('\n📇 Criando contatos...');

  const contacts = [
    {
      name: 'Carlos Mendes',
      phone: '5511987654321',
      email: 'carlos@email.com',
      status: 'enabled',
      city: 'São Paulo',
      state: 'SP',
      sessionName: 'atendimento-principal'
    },
    {
      name: 'Ana Paula',
      phone: '5521976543210',
      email: 'ana@email.com',
      status: 'enabled',
      city: 'Rio de Janeiro',
      state: 'RJ',
      sessionName: 'atendimento-principal'
    },
    {
      name: 'Roberto Costa',
      phone: '5531965432109',
      email: 'roberto@email.com',
      status: 'enabled',
      city: 'Belo Horizonte',
      state: 'MG',
      sessionName: 'vendas'
    },
    {
      name: 'Fernanda Lima',
      phone: '5541954321098',
      email: 'fernanda@email.com',
      status: 'enabled',
      city: 'Curitiba',
      state: 'PR',
      sessionName: 'suporte'
    },
    {
      name: 'Ricardo Alves',
      phone: '5551943210987',
      email: 'ricardo@email.com',
      status: 'enabled',
      city: 'Porto Alegre',
      state: 'RS',
      sessionName: 'atendimento-principal'
    }
  ];

  const createdContacts = await Contact.insertMany(contacts);
  console.log(`✅ ${createdContacts.length} contatos criados!`);

  return createdContacts;
}

// Criar tickets
async function createTickets(users, contacts) {
  console.log('\n🎫 Criando tickets...');

  const tickets = [
    {
      contactNumber: contacts[0].phone,
      contactName: contacts[0].name,
      sessionName: 'atendimento-principal',
      subject: 'Dúvida sobre produto',
      status: 'opened',
      priority: 'medium',
      assignedTo: users[1]._id,
      tags: ['vendas', 'produto'],
      lastMessage: new Date()
    },
    {
      contactNumber: contacts[1].phone,
      contactName: contacts[1].name,
      sessionName: 'atendimento-principal',
      subject: 'Problema com entrega',
      status: 'in_progress',
      priority: 'high',
      assignedTo: users[2]._id,
      tags: ['suporte', 'entrega'],
      lastMessage: new Date(Date.now() - 3600000) // 1 hora atrás
    },
    {
      contactNumber: contacts[2].phone,
      contactName: contacts[2].name,
      sessionName: 'vendas',
      subject: 'Orçamento',
      status: 'opened',
      priority: 'low',
      assignedTo: users[1]._id,
      tags: ['vendas', 'orçamento'],
      lastMessage: new Date(Date.now() - 7200000) // 2 horas atrás
    },
    {
      contactNumber: contacts[3].phone,
      contactName: contacts[3].name,
      sessionName: 'suporte',
      subject: 'Reclamação',
      status: 'finished',
      priority: 'urgent',
      assignedTo: users[2]._id,
      tags: ['suporte', 'reclamação'],
      lastMessage: new Date(Date.now() - 86400000), // 1 dia atrás
      resolvedAt: new Date(Date.now() - 3600000),
      closedAt: new Date(Date.now() - 3600000)
    },
    {
      contactNumber: contacts[4].phone,
      contactName: contacts[4].name,
      sessionName: 'atendimento-principal',
      subject: 'Informações gerais',
      status: 'paused',
      priority: 'low',
      assignedTo: users[1]._id,
      tags: ['informação'],
      lastMessage: new Date(Date.now() - 10800000) // 3 horas atrás
    }
  ];

  const createdTickets = await Ticket.insertMany(tickets);
  console.log(`✅ ${createdTickets.length} tickets criados!`);

  return createdTickets;
}

// Criar mensagens
async function createMessages(tickets) {
  console.log('\n💬 Criando mensagens...');

  const messages = [];

  // Mensagens para o primeiro ticket
  messages.push({
    ticketId: tickets[0]._id,
    messageId: `msg_${Date.now()}_1`,
    from: tickets[0].contactNumber,
    to: '551199999999',
    body: 'Olá! Gostaria de saber mais sobre o produto X',
    type: 'text',
    timestamp: new Date(Date.now() - 600000), // 10 min atrás
    isFromMe: false,
    status: 'delivered'
  });

  messages.push({
    ticketId: tickets[0]._id,
    messageId: `msg_${Date.now()}_2`,
    from: '551199999999',
    to: tickets[0].contactNumber,
    body: 'Olá! Claro, o produto X tem as seguintes características...',
    type: 'text',
    timestamp: new Date(Date.now() - 300000), // 5 min atrás
    isFromMe: true,
    status: 'read'
  });

  // Mensagens para o segundo ticket
  messages.push({
    ticketId: tickets[1]._id,
    messageId: `msg_${Date.now()}_3`,
    from: tickets[1].contactNumber,
    to: '551199999999',
    body: 'Minha entrega não chegou ainda',
    type: 'text',
    timestamp: new Date(Date.now() - 3600000), // 1 hora atrás
    isFromMe: false,
    status: 'delivered'
  });

  messages.push({
    ticketId: tickets[1]._id,
    messageId: `msg_${Date.now()}_4`,
    from: '551199999999',
    to: tickets[1].contactNumber,
    body: 'Vou verificar o status da sua entrega',
    type: 'text',
    timestamp: new Date(Date.now() - 3000000), // 50 min atrás
    isFromMe: true,
    status: 'read'
  });

  // Mensagens para o terceiro ticket
  messages.push({
    ticketId: tickets[2]._id,
    messageId: `msg_${Date.now()}_5`,
    from: tickets[2].contactNumber,
    to: '551199999999',
    body: 'Preciso de um orçamento para 100 unidades',
    type: 'text',
    timestamp: new Date(Date.now() - 7200000), // 2 horas atrás
    isFromMe: false,
    status: 'delivered'
  });

  const createdMessages = await Message.insertMany(messages);

  // Atualizar tickets com as mensagens
  for (const ticket of tickets) {
    const ticketMessages = createdMessages.filter(
      msg => msg.ticketId.toString() === ticket._id.toString()
    );

    if (ticketMessages.length > 0) {
      ticket.messages = ticketMessages.map(msg => msg._id);
      await ticket.save();
    }
  }

  console.log(`✅ ${createdMessages.length} mensagens criadas!`);

  return createdMessages;
}

// Criar licença
async function createLicense() {
  console.log('\n🔑 Criando licença...');

  const expirationDate = new Date();
  expirationDate.setFullYear(expirationDate.getFullYear() + 1); // Válida por 1 ano

  const license = await License.create({
    key: 'WTICKET-PRO-2024-DEMO-' + Math.random().toString(36).substring(7).toUpperCase(),
    type: 'pro',
    status: 'active',
    expiresAt: expirationDate,
    maxUsers: 10,
    features: [
      'unlimited_tickets',
      'multiple_sessions',
      'auto_response',
      'reports',
      'integrations'
    ]
  });

  console.log(`✅ Licença criada: ${license.key}`);
  console.log(`   Tipo: ${license.type}`);
  console.log(`   Expira em: ${license.expiresAt.toLocaleDateString('pt-BR')}`);

  return license;
}

// Função principal
async function seed() {
  console.log('\n🌱 Iniciando seed do banco de dados...\n');
  console.log('=' .repeat(50));

  try {
    await connectDB();
    await clearDatabase();

    const users = await createUsers();
    const sessions = await createSessions();
    const contacts = await createContacts();
    const tickets = await createTickets(users, contacts);
    const messages = await createMessages(tickets);
    const license = await createLicense();

    console.log('\n' + '=' .repeat(50));
    console.log('\n✅ Seed concluído com sucesso!\n');
    console.log('📊 Resumo:');
    console.log(`   - ${users.length} usuários`);
    console.log(`   - ${sessions.length} sessões`);
    console.log(`   - ${contacts.length} contatos`);
    console.log(`   - ${tickets.length} tickets`);
    console.log(`   - ${messages.length} mensagens`);
    console.log(`   - 1 licença\n`);

    console.log('🔐 Credenciais de acesso:\n');
    console.log('   👤 Administrador:');
    console.log('      Email: admin@wticket.com');
    console.log('      Senha: admin123\n');
    console.log('   👤 Usuário João:');
    console.log('      Email: joao@wticket.com');
    console.log('      Senha: joao123\n');
    console.log('   👤 Usuária Maria:');
    console.log('      Email: maria@wticket.com');
    console.log('      Senha: maria123\n');

  } catch (error) {
    console.error('\n❌ Erro durante o seed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Conexão com MongoDB fechada.');
    process.exit(0);
  }
}

// Executar seed
seed();
