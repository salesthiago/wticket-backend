import leadRepository from '../repositories/lead.repository.js';
import customerRepository from '../repositories/customer.repository.js';
import serviceOrderRepository from '../repositories/service-order.repository.js';

const httpError = (status, message) => Object.assign(new Error(message), { status });

// Converte o lead em cliente. Reaproveita um cliente já existente com o mesmo
// documento ou telefone (evita duplicar quem já é cliente) e, por fim, liga ao
// cliente todas as OS/orçamentos que estavam no nome do lead.
// Idempotente: se o lead já foi convertido, devolve o cliente vinculado.
// Retorna { customer, created }.
const convertToCustomer = async (companyId, leadId) => {
  const lead = await leadRepository.findById(companyId, leadId);
  if (!lead) throw httpError(404, 'Lead not found');

  if (lead.status === 'converted' && lead.convertedTo) {
    const customerId = lead.convertedTo._id || lead.convertedTo;
    const customer = await customerRepository.findById(companyId, customerId);
    if (customer) {
      await serviceOrderRepository.assignCustomerFromLead(companyId, lead._id, customer._id);
      return { customer, created: false };
    }
  }

  if (!lead.phone) {
    throw httpError(422, 'Lead precisa de telefone para virar cliente');
  }

  let customer = null;
  if (lead.document) customer = await customerRepository.findByDocument(companyId, lead.document);
  if (!customer) customer = await customerRepository.findByPhone(companyId, lead.phone);

  const created = !customer;
  if (created) {
    customer = await customerRepository.create({
      companyId,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      documentType: lead.documentType,
      document: lead.document,
      address: lead.address,
      source: 'lead',
      leadId: lead._id
    });
  }

  await leadRepository.convertToCustomer(companyId, lead._id, customer._id);
  await serviceOrderRepository.assignCustomerFromLead(companyId, lead._id, customer._id);

  return { customer, created };
};

export default { convertToCustomer };
