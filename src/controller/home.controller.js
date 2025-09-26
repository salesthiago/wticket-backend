import ticketRepository from "../repositories/ticket.repository.js";
import userRepository from '../repositories/user.repository.js'
import logger from "../utils/logger.js";

export const ticketDashboard = async (req, res) => {
  try {
    const { status, sessionName, startDate, endDate, contactNumber } =
      req.query;
    const query = {};

    // Filtro por status
    if (status) {
      if (Array.isArray(status)) {
        query.status = { $in: status };
      } else {
        query.status = status;
      }
    }
    // Filtro por sessionName
    if (sessionName) {
      query.sessionName = { $regex: sessionName, $options: "i" };
    }

    // Filtro por contactNumber
    if (contactNumber) {
      query.contactNumber = { $regex: contactNumber, $options: "i" };
    }

    // Filtro por data de criação
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    const dashboardData = await ticketRepository.dashboardByStatus(query);

    const timeAnalysis = await ticketRepository.dashboardWithTimeAnalysis(
      query
    );

    return res.status(200).json({
      success: true,
      data: {
        ...dashboardData,
        timeAnalysis,
        filtersApplied: {
          status,
          sessionName,
          startDate,
          endDate,
          contactNumber,
        },
      },
    });
  } catch (e) {
    logger.error("Dashboard error", e);
    return res.status(500).json({
      success: false,
      message: "Error generating dashboard",
      error: e.message,
    });
  }
};

export const myProfile = async (req, res) => {
  try {
    const authUser = req.user
    console.log(auth)
    const user = await userRepository.findById(authUser.sub)
    return res.status(200).json(user)
  } catch (e) {
    return res.status(500).json({ error: e, message: e?.message || 'Internal Error'})
  }
}
