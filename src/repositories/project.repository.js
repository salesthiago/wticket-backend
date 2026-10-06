import mongoose from 'mongoose';
import Project from '../models/project.model.js';
import ProjectStatus from '../models/project-status.model.js';
import Ticket from '../models/ticket.model.js';

class ProjectRepository {
  async create(data) {
    const project = new Project(data);
    return project.save();
  }

  async findAll({ companyId = null, statusId = null, priority = null, customerId = null } = {}) {
    const query = { companyId: companyId ?? null };
    if (statusId) query.statusId = statusId;
    if (priority) query.priority = priority;
    if (customerId) query.customerId = customerId;

    return Project.find(query)
      .populate('statusId', 'name label color isClosingStatus')
      .populate('customerId', 'name phone email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
  }

  async findById(id, { companyId = null, customerId = null } = {}) {
    const query = { _id: id, companyId: companyId ?? null };
    if (customerId) query.customerId = customerId;
    return Project.findOne(query)
      .populate('statusId', 'name label color isClosingStatus')
      .populate('customerId', 'name phone email')
      .populate('createdBy', 'name email');
  }

  async update(id, data, { companyId = null } = {}) {
    const project = await Project.findOne({ _id: id, companyId: companyId ?? null });
    if (!project) return null;

    const updateData = { ...data };

    // Se o status está mudando, resolve isClosingStatus para preencher/limpar closedAt
    if (data.statusId && String(data.statusId) !== String(project.statusId ?? '')) {
      const newStatus = await ProjectStatus.findOne({ _id: data.statusId, companyId: companyId ?? null });
      if (newStatus?.isClosingStatus) {
        updateData.closedAt = project.closedAt ?? new Date();
      } else if (project.closedAt) {
        updateData.closedAt = null;
      }
    }

    return Project.findByIdAndUpdate(id, { $set: updateData }, { new: true })
      .populate('statusId', 'name label color isClosingStatus')
      .populate('customerId', 'name phone email');
  }

  async addDocument(companyId, id, document) {
    return Project.findOneAndUpdate(
      { _id: id, companyId: companyId ?? null },
      { $push: { documents: document } },
      { new: true }
    );
  }

  async removeDocument(companyId, id, documentId) {
    return Project.findOneAndUpdate(
      { _id: id, companyId: companyId ?? null },
      { $pull: { documents: { _id: documentId } } },
      { new: true }
    );
  }

  async deleteProject(id, { companyId = null } = {}) {
    const filter = { _id: id, companyId: companyId ?? null };
    const project = await Project.findOneAndDelete(filter);
    if (project) {
      await Ticket.updateMany({ projectId: id }, { $set: { projectId: null } });
    }
    return project;
  }

  async getStats(id, companyId = null) {
    const match = { projectId: new mongoose.Types.ObjectId(id) };
    if (companyId) match.companyId = new mongoose.Types.ObjectId(companyId);

    const [result] = await Ticket.aggregate([
      { $match: match },
      {
        $lookup: {
          from: 'ticketstatuses',
          localField: 'statusId',
          foreignField: '_id',
          as: 'status'
        }
      },
      { $unwind: { path: '$status', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          // 1 = tarefa concluída, 0.5 = em andamento, 0 = as demais
          completionWeight: {
            $cond: [
              { $eq: ['$status.isDone', true] },
              1,
              { $cond: [{ $eq: ['$status.isInProgress', true] }, 0.5, 0] }
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          totalTasks: { $sum: 1 },
          totalWorkedHours: { $sum: { $ifNull: ['$workedHours', 0] } },
          completionSum: { $sum: '$completionWeight' }
        }
      }
    ]);

    const totalTasks = result?.totalTasks ?? 0;
    return {
      totalTasks,
      totalWorkedHours: result?.totalWorkedHours ?? 0,
      completionPercentage: totalTasks > 0 ? result.completionSum / totalTasks : 0
    };
  }
}

export default new ProjectRepository();
