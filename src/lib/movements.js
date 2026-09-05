import { getDocuments, createDocument as createFirestoreDoc } from './firestore';

// ============ Create Movement ============

export async function createMovement(data) {
  const movId = await createFirestoreDoc('movements', {
    ...data,
    quantity: Number(data.quantity),
    date: data.date,
  });

  return movId;
}

// ============ Calculate Balance ============

export async function calculateBalance(filters = {}) {
  try {
    const movements = await getDocuments('movements');

    let entradas = 0;
    let saidas = 0;

    movements.forEach((data) => {
      if (filters.category && data.category !== filters.category) return;
      if (filters.industryId && data.industryId !== filters.industryId) return;
      if (filters.clientId && data.clientId !== filters.clientId) return;

      if (data.type === 'entrada') {
        entradas += Number(data.quantity);
      } else if (data.type === 'saida') {
        saidas += Number(data.quantity);
      }
    });

    return entradas - saidas;
  } catch (err) {
    console.warn('Aviso ao calcular saldo:', err?.message || err);
    return 0;
  }
}

// ============ Get Balances by Group ============

export async function getBalancesByIndustry() {
  try {
    const movements = await getDocuments('movements');
    const balances = {};

    movements.forEach((data) => {
      const key = data.industryId || 'sem-industria';

      if (!balances[key]) {
        balances[key] = { industryId: key, entradas: 0, saidas: 0, saldo: 0 };
      }

      if (data.type === 'entrada') {
        balances[key].entradas += Number(data.quantity);
      } else {
        balances[key].saidas += Number(data.quantity);
      }
      balances[key].saldo = balances[key].entradas - balances[key].saidas;
    });

    return Object.values(balances);
  } catch (err) {
    console.warn('Aviso ao buscar saldos por indústria:', err?.message || err);
    return [];
  }
}

export async function getBalancesByCategory() {
  try {
    const movements = await getDocuments('movements');
    const balances = { transferencia: { entradas: 0, saidas: 0, saldo: 0 }, cliente: { entradas: 0, saidas: 0, saldo: 0 } };

    movements.forEach((data) => {
      const cat = data.category || 'transferencia';

      if (data.type === 'entrada') {
        balances[cat].entradas += Number(data.quantity);
      } else {
        balances[cat].saidas += Number(data.quantity);
      }
      balances[cat].saldo = balances[cat].entradas - balances[cat].saidas;
    });

    return balances;
  } catch (err) {
    console.warn('Aviso ao buscar saldos por categoria:', err?.message || err);
    return { transferencia: { entradas: 0, saidas: 0, saldo: 0 }, cliente: { entradas: 0, saidas: 0, saldo: 0 } };
  }
}

// ============ Dashboard Stats ============

export async function getDashboardStats() {
  try {
    const movements = await getDocuments('movements');

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let totalEntradas = 0;
    let totalSaidas = 0;
    let entradasMes = 0;
    let saidasMes = 0;
    let transferencias = { entradas: 0, saidas: 0 };
    let clientes = { entradas: 0, saidas: 0 };

    movements.forEach((data) => {
      const qty = Number(data.quantity);
      
      let movDate;
      if (data.createdAt && data.createdAt.toDate) {
        movDate = data.createdAt.toDate();
      } else if (data.date) {
        movDate = new Date(data.date + 'T00:00:00');
      } else {
        movDate = new Date();
      }

      if (data.type === 'entrada') {
        totalEntradas += qty;
        if (movDate >= startOfMonth) entradasMes += qty;
        if (data.category === 'transferencia') transferencias.entradas += qty;
        else clientes.entradas += qty;
      } else {
        totalSaidas += qty;
        if (movDate >= startOfMonth) saidasMes += qty;
        if (data.category === 'transferencia') transferencias.saidas += qty;
        else clientes.saidas += qty;
      }
    });

    return {
      saldoGeral: totalEntradas - totalSaidas,
      saldoTransferencias: transferencias.entradas - transferencias.saidas,
      saldoClientes: clientes.entradas - clientes.saidas,
      entradasMes,
      saidasMes,
    };
  } catch (err) {
    console.warn('Aviso ao buscar estatísticas:', err?.message || err);
    return {
      saldoGeral: 0,
      saldoTransferencias: 0,
      saldoClientes: 0,
      entradasMes: 0,
      saidasMes: 0,
    };
  }
}

// ============ Chart Data ============

export async function getMonthlyData() {
  try {
    const movements = await getDocuments('movements');
    const months = {};

    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months[key] = { entradas: 0, saidas: 0 };
    }

    movements.forEach((data) => {
      let movDate;
      if (data.date) {
        movDate = new Date(data.date + 'T00:00:00');
      } else if (data.createdAt && data.createdAt.toDate) {
        movDate = data.createdAt.toDate();
      } else {
        return;
      }

      const key = `${movDate.getFullYear()}-${String(movDate.getMonth() + 1).padStart(2, '0')}`;

      if (months[key]) {
        if (data.type === 'entrada') {
          months[key].entradas += Number(data.quantity);
        } else {
          months[key].saidas += Number(data.quantity);
        }
      }
    });

    const labels = Object.keys(months).map((k) => {
      const [y, m] = k.split('-');
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      return `${monthNames[parseInt(m) - 1]}/${y.slice(2)}`;
    });

    return {
      labels,
      entradas: Object.values(months).map((m) => m.entradas),
      saidas: Object.values(months).map((m) => m.saidas),
    };
  } catch (err) {
    console.warn('Aviso ao buscar dados mensais:', err?.message || err);
    return { labels: [], entradas: [], saidas: [] };
  }
}

// ============ Duplicate Document Check ============

export async function checkDuplicateDocument(documentNumber, industryId, type = 'entrada') {
  try {
    const movements = await getDocuments('movements');
    const docNum = documentNumber.trim().toLowerCase();

    const duplicates = movements.filter((m) => {
      if (m.type !== type) return false;
      if (m.industryId !== industryId) return false;
      if (!m.documentNumber || m.documentNumber.trim().toLowerCase() !== docNum) return false;
      return true;
    });

    if (duplicates.length === 0) return null;

    const totalQuantity = duplicates.reduce((sum, m) => sum + Number(m.quantity), 0);
    const dates = duplicates.map((m) => m.date).filter(Boolean).sort();
    const firstDate = dates[0] || '';
    const lastDate = dates[dates.length - 1] || '';

    return {
      count: duplicates.length,
      totalQuantity,
      firstDate,
      lastDate,
    };
  } catch (err) {
    console.warn('Erro ao verificar duplicidade:', err?.message || err);
    return null;
  }
}

// ============ Single Document Pending Balance ============

export async function getDocumentPendingBalance(documentNumber, industryId, category = 'transferencia') {
  try {
    const movements = await getDocuments('movements');

    let totalEntrada = 0;
    let totalSaida = 0;

    movements.forEach((m) => {
      if (m.industryId !== industryId) return;
      if (m.category !== category) return;
      if (!m.documentNumber || m.documentNumber.trim() !== documentNumber.trim()) return;

      if (m.type === 'entrada') {
        totalEntrada += Number(m.quantity);
      } else if (m.type === 'saida') {
        totalSaida += Number(m.quantity);
      }
    });

    return totalEntrada - totalSaida;
  } catch (err) {
    console.warn('Erro ao buscar saldo do documento:', err?.message || err);
    return 0;
  }
}

// ============ Pending Documents (NF/Termo) ============

export async function getPendingDocuments(industryId, category = 'transferencia') {
  try {
    const movements = await getDocuments('movements');

    // Filter movements for the specific industry+category that have a documentNumber
    const relevantMovements = movements.filter((m) => {
      if (m.industryId !== industryId) return false;
      if (m.category !== category) return false;
      if (!m.documentNumber || !m.documentNumber.trim()) return false;
      return true;
    });

    // Group by documentNumber and calculate pending balance
    const docMap = {};

    relevantMovements.forEach((m) => {
      const docNum = m.documentNumber.trim();
      if (!docMap[docNum]) {
        docMap[docNum] = {
          documentNumber: docNum,
          totalEntrada: 0,
          totalSaida: 0,
          pendente: 0,
          entradaDate: null,
        };
      }

      if (m.type === 'entrada') {
        docMap[docNum].totalEntrada += Number(m.quantity);
        // Track the most recent entry date for this document
        if (!docMap[docNum].entradaDate || (m.date && m.date > docMap[docNum].entradaDate)) {
          docMap[docNum].entradaDate = m.date;
        }
      } else if (m.type === 'saida') {
        docMap[docNum].totalSaida += Number(m.quantity);
      }
    });

    // Calculate pending and return only positive balances, sorted oldest to newest (FIFO)
    const pending = Object.values(docMap)
      .map((doc) => ({
        ...doc,
        pendente: doc.totalEntrada - doc.totalSaida,
      }))
      .filter((doc) => doc.pendente > 0)
      .sort((a, b) => {
        // Sort by date ascending (oldest first)
        if (a.entradaDate && b.entradaDate) {
          const dateDiff = a.entradaDate.localeCompare(b.entradaDate);
          if (dateDiff !== 0) return dateDiff;
        }
        if (a.entradaDate) return -1;
        if (b.entradaDate) return 1;
        // Natural sort by document number (e.g. 5214, 5215)
        return a.documentNumber.localeCompare(b.documentNumber, undefined, { numeric: true, sensitivity: 'base' });
      });

    return pending;
  } catch (err) {
    console.warn('Erro ao buscar documentos pendentes:', err?.message || err);
    return [];
  }
}

// ============ Position Data ============

export async function getPositionData(filters = {}) {
  try {
    const movements = await getDocuments('movements');
    const positions = {};

    movements.forEach((data) => {
      if (filters.category && data.category !== filters.category) return;
      if (filters.industryId && data.industryId !== filters.industryId) return;

      if (filters.dateStart || filters.dateEnd) {
        const movDate = data.date || '';
        if (filters.dateStart && movDate < filters.dateStart) return;
        if (filters.dateEnd && movDate > filters.dateEnd) return;
      }

      const indId = data.industryId || 'sem-industria';
      const cat = data.category || 'transferencia';
      const key = `${indId}_${cat}`;

      if (!positions[key]) {
        positions[key] = {
          industryId: indId,
          category: cat,
          entradas: 0,
          saidas: 0,
          saldo: 0,
        };
      }

      if (data.type === 'entrada') {
        positions[key].entradas += Number(data.quantity);
      } else {
        positions[key].saidas += Number(data.quantity);
      }
      positions[key].saldo = positions[key].entradas - positions[key].saidas;
    });

    return Object.values(positions);
  } catch (err) {
    console.warn('Aviso ao buscar posições:', err?.message || err);
    return [];
  }
}
