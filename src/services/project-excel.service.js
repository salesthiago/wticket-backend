import ExcelJS from 'exceljs';

const PRIORITY_LABELS = { low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente' };

const HEADER_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1F6F50' }
};
const HEADER_FONT = { color: { argb: 'FFFFFFFF' }, bold: true };

function styleHeaderRow(row) {
  row.eachCell(cell => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });
  row.height = 20;
}

// % de conclusão do projeto = média, por tarefa, de: 1 se o status está
// marcado como "conclui a tarefa", 0.5 se "em andamento", 0 caso contrário.
function computeCompletionPercentage(tasks) {
  if (!tasks.length) return 0;
  const sum = tasks.reduce((acc, task) => {
    if (task.statusId?.isDone) return acc + 1;
    if (task.statusId?.isInProgress) return acc + 0.5;
    return acc;
  }, 0);
  return sum / tasks.length;
}

// Gera a planilha de acompanhamento de projetos, seguindo o modelo de
// "Lista de tarefas" / "Subtarefas": cada Projeto é uma atividade e cada
// Ticket vinculado a ele (projectId) é uma subtarefa.
export async function buildProjectsWorkbook(projects, tasksByProject) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'WTicket';
  workbook.created = new Date();

  // --- Aba: Lista de tarefas (uma linha por projeto/atividade) ---
  const mainSheet = workbook.addWorksheet('Lista de tarefas');
  mainSheet.columns = [
    { header: 'ID Atividade', key: 'idAtividade', width: 18 },
    { header: 'Status', key: 'status', width: 18 },
    { header: 'Descrição', key: 'descricao', width: 32 },
    { header: 'Dt. Início', key: 'dtInicio', width: 14 },
    { header: 'Dt. Atualização', key: 'dtAtualizacao', width: 16 },
    { header: 'Prioridade', key: 'prioridade', width: 12 },
    { header: 'Atribuído', key: 'atribuido', width: 20 },
    { header: '% Concluído', key: 'percConcluido', width: 12 },
    { header: 'Resumo Subtarefas', key: 'resumo', width: 36 }
  ];
  styleHeaderRow(mainSheet.getRow(1));

  for (const project of projects) {
    const tasks = tasksByProject.get(String(project._id)) || [];
    const totalWorkedHours = tasks.reduce((sum, t) => sum + (t.workedHours || 0), 0);

    mainSheet.addRow({
      idAtividade: project.projectNumber || '',
      status: project.statusId?.label || '',
      descricao: project.title || '',
      dtInicio: project.startDate ? new Date(project.startDate) : null,
      dtAtualizacao: project.updatedAt ? new Date(project.updatedAt) : null,
      prioridade: PRIORITY_LABELS[project.priority] || project.priority || '',
      atribuido: '',
      percConcluido: computeCompletionPercentage(tasks),
      resumo: `${tasks.length} tarefa(s) • ${totalWorkedHours}h trabalhadas`
    });
  }

  mainSheet.getColumn('dtInicio').numFmt = 'dd/mm/yyyy';
  mainSheet.getColumn('dtAtualizacao').numFmt = 'dd/mm/yyyy';
  mainSheet.getColumn('percConcluido').numFmt = '0%';

  // --- Aba: Subtarefas (uma linha por tarefa/ticket) ---
  const subSheet = workbook.addWorksheet('Subtarefas');
  subSheet.columns = [
    { header: 'ID Atividade', key: 'idAtividade', width: 18 },
    { header: 'Atividade', key: 'atividade', width: 24 },
    { header: 'Subtarefa', key: 'subtarefa', width: 36 },
    { header: 'Responsável', key: 'responsavel', width: 20 },
    { header: 'Status Subtarefa', key: 'statusSubtarefa', width: 18 },
    { header: 'Horas Trabalhadas', key: 'horas', width: 14 },
    { header: 'Prazo', key: 'prazo', width: 14 },
    { header: 'Observações', key: 'observacoes', width: 36 }
  ];
  styleHeaderRow(subSheet.getRow(1));

  for (const project of projects) {
    const tasks = tasksByProject.get(String(project._id)) || [];
    for (const task of tasks) {
      const subtaskLabel = task.contactName || task.subjectId?.name || task.notes || task.taskNumber || '';
      subSheet.addRow({
        idAtividade: project.projectNumber || '',
        atividade: project.title || '',
        subtarefa: task.taskNumber ? `${task.taskNumber} - ${subtaskLabel}` : subtaskLabel,
        responsavel: task.assignedTo?.name || '',
        statusSubtarefa: task.statusId?.label || '',
        horas: task.workedHours || 0,
        prazo: task.endDate ? new Date(task.endDate) : null,
        observacoes: task.notes || ''
      });
    }
  }

  subSheet.getColumn('prazo').numFmt = 'dd/mm/yyyy';

  return workbook;
}
