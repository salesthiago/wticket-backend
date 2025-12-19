import whatsappService from "../services/whatsapp.service.js";
import logger from "../utils/logger.js";

export const createSession = async (req, res) => {
  try {
    const { name } = req.body;
    logger.info(`🌐 [API] Requisição para criar sessão: ${name}`);

    if (!name) {
      logger.warn(`🌐 [API] Tentativa de criar sessão sem nome`);
      return res.status(400).json({
        error: "Nome da sessão é obrigatório",
      });
    }

    logger.debug(`🌐 [API] Chamando whatsappService.createSession(${name})`);
    const result = whatsappService.createSession(name);

    logger.info(`🌐 [API] ✅ Sessão ${name} criada com sucesso`);
    return res.json({
      success: true,
      message: "Sessão criada com sucesso",
      session: result.session,
    });
  } catch (error) {
    logger.error(`🌐 [API] ❌ Erro ao criar sessão:`, error);
    res.status(500).json({
      error: "Erro interno ao criar sessão",
      details: error.message,
    });
  }
};

export const getQRCode = async (req, res) => {
  try {
    const { sessionName } = req.params;
    const session = whatsappService.sessions.get(sessionName);

    if (!session) {
      return res.status(404).json({
        error: "Sessão não encontrada",
      });
    }

    if (!session.qrCode) {
      return res.status(202).json({
        message: "QR Code ainda não gerado",
        status: session.status,
      });
    }

    res.json({
      qrCode: session.qrCode,
      status: session.status,
    });
  } catch (error) {
    logger.error("Erro ao obter QR Code:", error);
    res.status(500).json({
      error: "Erro interno ao obter QR Code",
    });
  }
};

export const getStatus = async (req, res) => {
  try {
    const { sessionName } = req.params;
    const status = whatsappService.getSessionStatus(sessionName);

    res.json({
      session: sessionName,
      status: status,
    });
  } catch (error) {
    logger.error("Erro ao obter status:", error);
    res.status(500).json({
      error: "Erro interno ao obter status",
    });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { sessionName, number, message } = req.body;

    if (!sessionName || !number || !message) {
      return res.status(400).json({
        error: "sessionName, number e message são obrigatórios",
      });
    }

    const result = await whatsappService.sendMessage(
      sessionName,
      number,
      message
    );

    res.json({
      success: true,
      message: "Mensagem enviada com sucesso",
      result: result,
    });
  } catch (error) {
    logger.error("Erro ao enviar mensagem:", error);
    res.status(500).json({
      error: "Erro interno ao enviar mensagem",
      details: error.message,
    });
  }
};

export const closeSession = async (req, res) => {
  try {
    const { sessionName } = req.body;

    if (!sessionName) {
      return res.status(400).json({
        error: "sessionName é obrigatório",
      });
    }

    await whatsappService.closeSession(sessionName);

    res.json({
      success: true,
      message: "Sessão fechada com sucesso",
    });
  } catch (error) {
    logger.error("Erro ao fechar sessão:", error);
    res.status(500).json({
      error: "Erro interno ao fechar sessão",
      details: error.message,
    });
  }
};

export const listSessions = async (req, res) => {
  try {
    console.log("controller >>> listSessions");
    const sessions = await whatsappService.getAllSessions();
    return res.json(sessions);
  } catch (error) {
    logger.error("Erro ao listar sessões:", error);
    res.status(500).json({
      error: "Erro interno ao listar sessões",
    });
  }
};

export const syncContacts = async (req, res) => {
  try {
    const { sessionName } = req.body;

    if (!sessionName) {
      return res.status(400).json({
        message: "sessionName é obrigatório",
      });
    }
    const sessions = await whatsappService.syncContacts(sessionName);

    return res.json(sessions);
  } catch (error) {
    logger.error("Erro ao listar sessões:", error);
    res.status(500).json({
      error: "Erro interno ao listar sessões",
    });
  }
};

export const destroySession = async (req, res) => {
  const { sessionName } = req.params;

  if (!sessionName) {
    return res.status(422).json({
      error: "sessionName é obrigatório",
    });
  }
  await whatsappService.deleteSession(sessionName, true);

  return res.status(204).json({ message: "Has ben deleted !!" });
};
export const syncStatus = async (req, res) => {
  try {
    const { sessionName } = req.query;

    if (!sessionName) {
      return res.status(400).json({
        error: "sessionName é obrigatório",
      });
    }
    const sessions = await whatsappService.getSyncStatus(sessionName);

    return res.json(sessions);
  } catch (error) {
    logger.error("Erro ao listar sessões:", error);
    res.status(500).json({
      error: "Erro interno ao listar sessões",
    });
  }
};
