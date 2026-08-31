import * as XLSX from 'xlsx';

export function exportToExcel(data, filename = 'relatorio', sheetName = 'Dados') {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  // Auto-size columns
  const colWidths = {};
  data.forEach((row) => {
    Object.keys(row).forEach((key) => {
      const val = String(row[key] || '');
      colWidths[key] = Math.max(colWidths[key] || key.length, val.length);
    });
  });

  ws['!cols'] = Object.values(colWidths).map((w) => ({ wch: Math.min(w + 2, 50) }));

  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const date = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
  XLSX.writeFile(wb, `${filename}_${date}.xlsx`);
}

export function formatMovementsForExcel(movements, industries, clients) {
  return movements.map((mov) => {
    const industry = industries.find((i) => i.id === mov.industryId);
    const client = clients.find((c) => c.id === mov.clientId);

    let dateStr = '';
    if (mov.date) {
      const d = new Date(mov.date + 'T00:00:00');
      dateStr = d.toLocaleDateString('pt-BR');
    }

    let createdAtStr = '';
    if (mov.createdAt) {
      const d = mov.createdAt.toDate ? mov.createdAt.toDate() : new Date(mov.createdAt);
      createdAtStr = d.toLocaleString('pt-BR');
    }

    return {
      'Data': dateStr,
      'Tipo': mov.type === 'entrada' ? 'Entrada' : 'Saída',
      'Categoria': mov.category === 'transferencia' ? 'TRANSFERÊNCIAS' : 'CLIENTES',
      'Quantidade': mov.quantity,
      'Indústria': industry?.name || '-',
      'Nº NF / Termo': mov.documentNumber || '-',
      'Cliente': client?.name || '-',
      'Observação': mov.notes || '-',
      'Usuário Responsável': mov.createdByName || '-',
      'Data Lançamento': createdAtStr,
    };
  });
}
