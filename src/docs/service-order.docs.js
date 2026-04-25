/**
 * @swagger
 * tags:
 *   - name: Service Orders
 *     description: Gestão de ordens de serviço para assistência técnica
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     ServiceItem:
 *       type: object
 *       required:
 *         - description
 *         - quantity
 *         - unitPrice
 *         - total
 *       properties:
 *         description:
 *           type: string
 *           example: "Troca de tela LCD"
 *         quantity:
 *           type: number
 *           minimum: 1
 *           example: 1
 *         unitPrice:
 *           type: number
 *           minimum: 0
 *           example: 150.00
 *         total:
 *           type: number
 *           minimum: 0
 *           example: 150.00
 *
 *     Part:
 *       type: object
 *       required:
 *         - name
 *         - quantity
 *         - unitPrice
 *         - total
 *       properties:
 *         name:
 *           type: string
 *           example: "Tela LCD 15.6 polegadas"
 *         quantity:
 *           type: number
 *           minimum: 1
 *           example: 1
 *         unitPrice:
 *           type: number
 *           minimum: 0
 *           example: 320.00
 *         total:
 *           type: number
 *           minimum: 0
 *           example: 320.00
 *
 *     StatusHistory:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *         changedBy:
 *           type: string
 *           description: ID do usuário ou objeto populado
 *         notes:
 *           type: string
 *         changedAt:
 *           type: string
 *           format: date-time
 *
 *     Equipment:
 *       type: object
 *       required:
 *         - type
 *       properties:
 *         type:
 *           type: string
 *           description: Tipo do equipamento
 *           example: "Notebook"
 *         brand:
 *           type: string
 *           description: Marca
 *           example: "Dell"
 *         model:
 *           type: string
 *           description: Modelo
 *           example: "Inspiron 15 3000"
 *         serialNumber:
 *           type: string
 *           description: Número de série
 *           example: "SN123456789"
 *         accessories:
 *           type: string
 *           description: Acessórios entregues junto
 *           example: "Carregador, mouse USB"
 *         condition:
 *           type: string
 *           description: Estado físico na entrada
 *           example: "Tela trincada, sem riscos no gabinete"
 *
 *     ServiceOrder:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "665a1b2c3d4e5f6a7b8c9d0e"
 *         orderNumber:
 *           type: string
 *           description: Número sequencial gerado automaticamente
 *           example: "OS-2026-00001"
 *         customerId:
 *           oneOf:
 *             - type: string
 *             - type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 phone:
 *                   type: string
 *                 email:
 *                   type: string
 *                 document:
 *                   type: string
 *           description: Cliente (ID ou objeto populado)
 *         equipment:
 *           $ref: '#/components/schemas/Equipment'
 *         reportedIssue:
 *           type: string
 *           description: Problema relatado pelo cliente
 *           example: "Notebook não liga, tela piscando"
 *         diagnosis:
 *           type: string
 *           description: Diagnóstico técnico
 *           example: "Flex da tela rompido, necessária troca completa do display"
 *         services:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ServiceItem'
 *         parts:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Part'
 *         estimatedCost:
 *           type: number
 *           description: Valor do orçamento
 *           example: 470.00
 *         finalCost:
 *           type: number
 *           description: Custo final cobrado
 *           example: 450.00
 *         status:
 *           type: string
 *           enum: [open, diagnosing, quoted, approved, in_progress, completed, delivered, cancelled]
 *           description: |
 *             Status da OS:
 *             - `open` - Aberta (recém criada)
 *             - `diagnosing` - Em diagnóstico
 *             - `quoted` - Orçamento enviado
 *             - `approved` - Orçamento aprovado pelo cliente
 *             - `in_progress` - Em execução
 *             - `completed` - Serviço concluído
 *             - `delivered` - Entregue ao cliente
 *             - `cancelled` - Cancelada
 *           example: "open"
 *         priority:
 *           type: string
 *           enum: [low, normal, high, urgent]
 *           example: "normal"
 *         technicianId:
 *           oneOf:
 *             - type: string
 *             - type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 email:
 *                   type: string
 *           description: Técnico responsável (ID ou objeto populado)
 *         estimatedCompletionDate:
 *           type: string
 *           format: date-time
 *           description: Previsão de conclusão
 *         completedAt:
 *           type: string
 *           format: date-time
 *           description: Data de conclusão real
 *         deliveredAt:
 *           type: string
 *           format: date-time
 *           description: Data de entrega ao cliente
 *         warrantyDays:
 *           type: number
 *           description: Dias de garantia
 *           example: 90
 *         warrantyExpiresAt:
 *           type: string
 *           format: date-time
 *           description: Data de expiração da garantia (calculada na entrega)
 *         internalNotes:
 *           type: string
 *           description: Observações internas
 *         cancelReason:
 *           type: string
 *           description: Motivo do cancelamento
 *         statusHistory:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/StatusHistory'
 *         isActive:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     ServiceOrderList:
 *       type: object
 *       properties:
 *         records:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ServiceOrder'
 *         total:
 *           type: number
 *           example: 25
 *         page:
 *           type: number
 *           example: 0
 *         limit:
 *           type: number
 *           example: 10
 *
 *     DashboardSummary:
 *       type: object
 *       properties:
 *         open:
 *           type: number
 *           example: 5
 *         diagnosing:
 *           type: number
 *           example: 3
 *         quoted:
 *           type: number
 *           example: 2
 *         approved:
 *           type: number
 *           example: 4
 *         in_progress:
 *           type: number
 *           example: 6
 *         completed:
 *           type: number
 *           example: 8
 *         delivered:
 *           type: number
 *           example: 15
 *         cancelled:
 *           type: number
 *           example: 1
 *         total:
 *           type: number
 *           example: 44
 */

// ==================== ENDPOINTS ====================

/**
 * @swagger
 * /service-orders:
 *   get:
 *     summary: Listar ordens de serviço
 *     description: Retorna lista paginada de ordens de serviço com filtros opcionais
 *     tags: [Service Orders]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Busca por número da OS, problema, diagnóstico, equipamento (tipo, marca, modelo, serial)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, diagnosing, quoted, approved, in_progress, completed, delivered, cancelled]
 *         description: Filtrar por status
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, normal, high, urgent]
 *         description: Filtrar por prioridade
 *       - in: query
 *         name: technicianId
 *         schema:
 *           type: string
 *         description: Filtrar por técnico responsável (ID)
 *       - in: query
 *         name: customerId
 *         schema:
 *           type: string
 *         description: Filtrar por cliente (ID)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Página (começa em 1)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Registros por página
 *     responses:
 *       200:
 *         description: Lista de ordens de serviço
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServiceOrderList'
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */

/**
 * @swagger
 * /service-orders/dashboard:
 *   get:
 *     summary: Dashboard de ordens de serviço
 *     description: Retorna resumo com contagem de OS por status
 *     tags: [Service Orders]
 *     responses:
 *       200:
 *         description: Resumo do dashboard
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DashboardSummary'
 *       500:
 *         description: Erro interno
 */

/**
 * @swagger
 * /service-orders/number/{orderNumber}:
 *   get:
 *     summary: Buscar OS por número
 *     description: Retorna uma ordem de serviço pelo número sequencial (ex. OS-2026-00001)
 *     tags: [Service Orders]
 *     parameters:
 *       - in: path
 *         name: orderNumber
 *         required: true
 *         schema:
 *           type: string
 *         description: Número da OS
 *         example: "OS-2026-00001"
 *     responses:
 *       200:
 *         description: Ordem de serviço encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServiceOrder'
 *       404:
 *         description: OS não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Service order not found"
 *       500:
 *         description: Erro interno
 */

/**
 * @swagger
 * /service-orders/customer/{customerId}:
 *   get:
 *     summary: Listar OS de um cliente
 *     description: Retorna todas as ordens de serviço de um cliente específico
 *     tags: [Service Orders]
 *     parameters:
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do cliente
 *     responses:
 *       200:
 *         description: Lista de ordens de serviço do cliente
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ServiceOrder'
 *       500:
 *         description: Erro interno
 */

/**
 * @swagger
 * /service-orders/{id}:
 *   get:
 *     summary: Buscar OS por ID
 *     description: Retorna os detalhes completos de uma ordem de serviço, incluindo cliente, técnico e histórico de status populados
 *     tags: [Service Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da OS
 *     responses:
 *       200:
 *         description: Ordem de serviço encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServiceOrder'
 *       404:
 *         description: OS não encontrada
 *       500:
 *         description: Erro interno
 */

/**
 * @swagger
 * /service-orders:
 *   post:
 *     summary: Criar nova ordem de serviço
 *     description: |
 *       Cria uma nova OS vinculada a um cliente existente.
 *       O número da OS (orderNumber) é gerado automaticamente no formato `OS-YYYY-NNNNN`.
 *       O status inicial é sempre `open`.
 *     tags: [Service Orders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customerId
 *               - equipment
 *               - reportedIssue
 *             properties:
 *               customerId:
 *                 type: string
 *                 description: ID do cliente
 *                 example: "665a1b2c3d4e5f6a7b8c9d0e"
 *               equipment:
 *                 $ref: '#/components/schemas/Equipment'
 *               reportedIssue:
 *                 type: string
 *                 description: Problema relatado pelo cliente
 *                 example: "Notebook não liga após queda"
 *               priority:
 *                 type: string
 *                 enum: [low, normal, high, urgent]
 *                 default: normal
 *               technicianId:
 *                 type: string
 *                 description: ID do técnico responsável
 *               estimatedCompletionDate:
 *                 type: string
 *                 format: date-time
 *                 description: Previsão de conclusão
 *               internalNotes:
 *                 type: string
 *                 description: Observações internas
 *           example:
 *             customerId: "665a1b2c3d4e5f6a7b8c9d0e"
 *             equipment:
 *               type: "Notebook"
 *               brand: "Dell"
 *               model: "Inspiron 15 3000"
 *               serialNumber: "SN123456789"
 *               accessories: "Carregador original"
 *               condition: "Gabinete com marcas de queda no canto inferior esquerdo"
 *             reportedIssue: "Notebook não liga após queda. Cliente relata que caiu da mesa."
 *             priority: "high"
 *             estimatedCompletionDate: "2026-04-20T00:00:00.000Z"
 *             internalNotes: "Verificar placa-mãe e conectores internos"
 *     responses:
 *       201:
 *         description: OS criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServiceOrder'
 *       404:
 *         description: Cliente não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Customer not found"
 *       422:
 *         description: Campos obrigatórios ausentes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Fields customerId, equipment.type and reportedIssue are required"
 *       500:
 *         description: Erro interno
 */

/**
 * @swagger
 * /service-orders/{id}:
 *   put:
 *     summary: Atualizar ordem de serviço
 *     description: |
 *       Atualiza os dados de uma OS. Os campos `status`, `statusHistory` e `orderNumber` são ignorados neste endpoint.
 *       Para alterar o status, use `PATCH /{id}/status`.
 *     tags: [Service Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da OS
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               equipment:
 *                 $ref: '#/components/schemas/Equipment'
 *               reportedIssue:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [low, normal, high, urgent]
 *               technicianId:
 *                 type: string
 *               estimatedCompletionDate:
 *                 type: string
 *                 format: date-time
 *               warrantyDays:
 *                 type: number
 *               finalCost:
 *                 type: number
 *               internalNotes:
 *                 type: string
 *           example:
 *             priority: "urgent"
 *             technicianId: "665a1b2c3d4e5f6a7b8c9d0f"
 *             finalCost: 450.00
 *     responses:
 *       200:
 *         description: OS atualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServiceOrder'
 *       404:
 *         description: OS não encontrada
 *       422:
 *         description: Body vazio
 *       500:
 *         description: Erro interno
 */

/**
 * @swagger
 * /service-orders/{id}/status:
 *   patch:
 *     summary: Alterar status da OS
 *     description: |
 *       Altera o status da ordem de serviço e registra no histórico.
 *
 *       **Comportamentos automáticos por status:**
 *       - `completed` → preenche `completedAt` com a data atual
 *       - `delivered` → preenche `deliveredAt` e calcula `warrantyExpiresAt` baseado em `warrantyDays`
 *       - `cancelled` → preenche `cancelReason` com o valor de `notes`
 *
 *       **Fluxo recomendado:**
 *       ```
 *       open → diagnosing → quoted → approved → in_progress → completed → delivered
 *       ```
 *       Qualquer status pode ir para `cancelled`.
 *     tags: [Service Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da OS
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [open, diagnosing, quoted, approved, in_progress, completed, delivered, cancelled]
 *                 description: Novo status
 *               notes:
 *                 type: string
 *                 description: Observações sobre a mudança de status (obrigatório para cancelamento)
 *           examples:
 *             diagnosing:
 *               summary: Iniciar diagnóstico
 *               value:
 *                 status: "diagnosing"
 *                 notes: "Equipamento recebido, iniciando análise"
 *             cancelled:
 *               summary: Cancelar OS
 *               value:
 *                 status: "cancelled"
 *                 notes: "Cliente desistiu do reparo devido ao custo"
 *             delivered:
 *               summary: Marcar como entregue
 *               value:
 *                 status: "delivered"
 *                 notes: "Entregue ao cliente com garantia de 90 dias"
 *     responses:
 *       200:
 *         description: Status atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServiceOrder'
 *       404:
 *         description: OS não encontrada
 *       422:
 *         description: Status inválido ou ausente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Invalid status. Valid: open, diagnosing, quoted, approved, in_progress, completed, delivered, cancelled"
 *       500:
 *         description: Erro interno
 */

/**
 * @swagger
 * /service-orders/{id}/diagnosis:
 *   patch:
 *     summary: Registrar diagnóstico técnico
 *     description: |
 *       Adiciona ou atualiza o diagnóstico técnico da OS, incluindo serviços a serem realizados,
 *       peças necessárias e valor do orçamento.
 *     tags: [Service Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da OS
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - diagnosis
 *             properties:
 *               diagnosis:
 *                 type: string
 *                 description: Diagnóstico técnico detalhado
 *               services:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/ServiceItem'
 *                 description: Serviços a serem realizados
 *               parts:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/Part'
 *                 description: Peças necessárias
 *               estimatedCost:
 *                 type: number
 *                 description: Valor total do orçamento
 *           example:
 *             diagnosis: "Flex da tela rompido por impacto. Placa-mãe OK após testes. Necessária troca completa do display."
 *             services:
 *               - description: "Mão de obra - troca de tela"
 *                 quantity: 1
 *                 unitPrice: 150.00
 *                 total: 150.00
 *             parts:
 *               - name: "Tela LCD 15.6\" compatível Dell Inspiron"
 *                 quantity: 1
 *                 unitPrice: 320.00
 *                 total: 320.00
 *             estimatedCost: 470.00
 *     responses:
 *       200:
 *         description: Diagnóstico registrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServiceOrder'
 *       404:
 *         description: OS não encontrada
 *       422:
 *         description: Diagnóstico não informado
 *       500:
 *         description: Erro interno
 */

/**
 * @swagger
 * /service-orders/{id}/destroy:
 *   delete:
 *     summary: Excluir ordem de serviço
 *     description: Realiza soft delete da OS (marca como inativa)
 *     tags: [Service Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da OS
 *     responses:
 *       200:
 *         description: OS excluída
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Service order deleted successfully"
 *       404:
 *         description: OS não encontrada
 *       500:
 *         description: Erro interno
 */
