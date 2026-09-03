'use client';

import { useState, useEffect } from 'react';
import { getDocuments, deleteDocument } from '@/lib/firestore';
import { logAuditAction } from '@/lib/audit';
import { exportToExcel, formatMovementsForExcel } from '@/lib/excel';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { canDelete } from '@/lib/permissions';
import DataTable from '@/components/ui/DataTable';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import {
  Search,
  Download,
  RefreshCw,
  ArrowDownToLine,
  ArrowUpFromLine,
  Trash2,
  Repeat,
  Users,
  FileText,
  Truck,
  BarChart3,
  List,
} from 'lucide-react';

export default function QueriesPage() {
  const [movements, setMovements] = useState([]);
  const [industries, setIndustries] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null });
  const [saving, setSaving] = useState(false);

  // Active Category View: 'transferencia' | 'cliente'
  const [activeCategory, setActiveCategory] = useState('transferencia');

  // Sub-view for transferencias: 'movements' | 'distributors'
  const [transfSubView, setTransfSubView] = useState('movements');

  // Filters for TRANSFERÊNCIAS: industryId, documentNumber, dateStart, dateEnd
  const [transfFilters, setTransfFilters] = useState({
    industryId: '',
    documentNumber: '',
    dateStart: '',
    dateEnd: '',
    type: '',
  });

  // Filters for CLIENTES: industryId, clientId, documentNumber, dateStart, dateEnd
  const [clientFilters, setClientFilters] = useState({
    industryId: '',
    clientId: '',
    documentNumber: '',
    dateStart: '',
    dateEnd: '',
    type: '',
  });

  const { user } = useAuth();
  const { addToast } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const [movs, inds, cls] = await Promise.all([
        getDocuments('movements', [], 'date', 'desc'),
        getDocuments('industries', [], 'name', 'asc'),
        getDocuments('clients', [], 'name', 'asc'),
      ]);
      setMovements(movs);
      setIndustries(inds);
      setClients(cls);
    } catch (err) {
      console.error(err);
      addToast('Erro ao carregar lançamentos', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered movements for TRANSFERÊNCIAS
  const transfMovements = movements.filter((m) => {
    if (m.category !== 'transferencia') return false;
    if (transfFilters.industryId && m.industryId !== transfFilters.industryId) return false;
    if (transfFilters.type && m.type !== transfFilters.type) return false;
    if (
      transfFilters.documentNumber &&
      !String(m.documentNumber || '').toLowerCase().includes(transfFilters.documentNumber.toLowerCase())
    )
      return false;
    if (transfFilters.dateStart && m.date < transfFilters.dateStart) return false;
    if (transfFilters.dateEnd && m.date > transfFilters.dateEnd) return false;
    return true;
  });

  // Filtered movements for CLIENTES
  const clientMovements = movements.filter((m) => {
    if (m.category !== 'cliente') return false;
    if (clientFilters.industryId && m.industryId !== clientFilters.industryId) return false;
    if (clientFilters.clientId && m.clientId !== clientFilters.clientId) return false;
    if (clientFilters.type && m.type !== clientFilters.type) return false;
    if (
      clientFilters.documentNumber &&
      !String(m.documentNumber || '').toLowerCase().includes(clientFilters.documentNumber.toLowerCase())
    )
      return false;
    if (clientFilters.dateStart && m.date < clientFilters.dateStart) return false;
    if (clientFilters.dateEnd && m.date > clientFilters.dateEnd) return false;
    return true;
  });

  // Calculate Totals for TRANSFERÊNCIAS
  const transfStats = transfMovements.reduce(
    (acc, m) => {
      const qty = Number(m.quantity);
      if (m.type === 'entrada') acc.entradas += qty;
      else acc.saidas += qty;
      return acc;
    },
    { entradas: 0, saidas: 0 }
  );
  const transfSaldo = transfStats.entradas - transfStats.saidas;

  // Calculate Totals for CLIENTES
  const clientStats = clientMovements.reduce(
    (acc, m) => {
      const qty = Number(m.quantity);
      if (m.type === 'entrada') acc.entradas += qty;
      else acc.saidas += qty;
      return acc;
    },
    { entradas: 0, saidas: 0 }
  );
  const clientSaldo = clientStats.entradas - clientStats.saidas;

  const getIndustryName = (id) => industries.find((i) => i.id === id)?.name || '-';
  const getClientName = (id) => clients.find((c) => c.id === id)?.name || '-';

  // Build distributor summary grouped by industry
  const distributorSummary = (() => {
    const summary = {};
    transfMovements.forEach((m) => {
      if (!m.distribuidor) return;
      const key = `${m.industryId}|||${m.distribuidor}`;
      if (!summary[key]) {
        summary[key] = {
          industryId: m.industryId,
          industryName: getIndustryName(m.industryId),
          distribuidor: m.distribuidor,
          entradas: 0,
          saidas: 0,
        };
      }
      const qty = Number(m.quantity);
      if (m.type === 'entrada') summary[key].entradas += qty;
      else summary[key].saidas += qty;
    });
    return Object.values(summary).sort((a, b) => {
      const indCmp = a.industryName.localeCompare(b.industryName);
      if (indCmp !== 0) return indCmp;
      return a.distribuidor.localeCompare(b.distribuidor);
    });
  })();

  const handleDelete = async () => {
    if (!confirmDelete.id) return;
    setSaving(true);
    try {
      const mov = movements.find((m) => m.id === confirmDelete.id);
      await deleteDocument('movements', confirmDelete.id);
      await logAuditAction('delete', user.uid, user.name, {
        collection: 'movements',
        documentId: confirmDelete.id,
        before: mov,
      });
      addToast('Lançamento excluído com sucesso', 'success');
      setConfirmDelete({ open: false, id: null });
      loadData();
    } catch (err) {
      console.error(err);
      addToast('Erro ao excluir lançamento', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    const listToExport = activeCategory === 'transferencia' ? transfMovements : clientMovements;
    if (listToExport.length === 0) {
      addToast('Nenhum registro para exportar nesta consulta', 'warning');
      return;
    }
    const title = activeCategory === 'transferencia' ? 'Consulta_Saldo_Transferencias' : 'Consulta_Saldo_Clientes';
    const excelData = formatMovementsForExcel(listToExport, industries, clients);
    exportToExcel(excelData, title, 'Movimentações');
    addToast('Dados exportados para Excel com sucesso!', 'success');
  };

  const columns = [
    {
      header: 'Data',
      accessorKey: 'date',
      cell: (row) => {
        if (!row.date) return '-';
        const [y, m, d] = row.date.split('-');
        return `${d}/${m}/${y}`;
      },
    },
    {
      header: 'Tipo',
      accessorKey: 'type',
      cell: (row) => (
        <span className={`badge ${row.type === 'entrada' ? 'badge-success' : 'badge-danger'}`}>
          {row.type === 'entrada' ? (
            <>
              <ArrowDownToLine size={12} /> Entrada
            </>
          ) : (
            <>
              <ArrowUpFromLine size={12} /> Saída
            </>
          )}
        </span>
      ),
    },
    {
      header: 'Qtd.',
      accessorKey: 'quantity',
      cell: (row) => (
        <span
          style={{
            fontWeight: 700,
            color: row.type === 'entrada' ? 'var(--success-600)' : 'var(--danger-600)',
          }}
        >
          {row.type === 'entrada' ? `+${row.quantity}` : `-${row.quantity}`}
        </span>
      ),
    },
    {
      header: 'Indústria',
      accessorKey: 'industryId',
      cell: (row) => getIndustryName(row.industryId),
    },
    {
      header: 'Nº NF / Termo',
      accessorKey: 'documentNumber',
      cell: (row) => (
        row.documentNumber ? (
          <span className="badge badge-primary" style={{ gap: '4px' }}>
            <FileText size={12} /> {row.documentNumber}
          </span>
        ) : (
          '-'
        )
      ),
    },
    ...(activeCategory === 'cliente'
      ? [
          {
            header: 'Cliente',
            accessorKey: 'clientId',
            cell: (row) => getClientName(row.clientId),
          },
        ]
      : []),
    {
      header: 'Placa',
      accessorKey: 'placa',
      cell: (row) => row.placa || '-',
    },
    {
      header: 'Observação',
      accessorKey: 'notes',
      cell: (row) => row.notes || '-',
    },
    {
      header: 'Usuário',
      accessorKey: 'createdByName',
      cell: (row) => row.createdByName || '-',
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Search size={28} color="var(--primary-500)" />
            Consulta de Saldos e Movimentações
          </h1>
          <p className="page-subtitle">Consulte o saldo independente de Transferências e Clientes com filtros avançados e controle de NF/Termos</p>
        </div>
        <button
          className="btn btn-secondary"
          onClick={handleExport}
          disabled={loading || (activeCategory === 'transferencia' ? transfMovements.length === 0 : clientMovements.length === 0)}
        >
          <Download size={18} /> Exportar Excel
        </button>
      </div>

      {/* Selector Tabs for 2 Balances */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <button
          className={`btn ${activeCategory === 'transferencia' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1, padding: '14px', fontSize: '1rem' }}
          onClick={() => setActiveCategory('transferencia')}
        >
          <Repeat size={20} /> Saldo de TRANSFERÊNCIAS
        </button>
        <button
          className={`btn ${activeCategory === 'cliente' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1, padding: '14px', fontSize: '1rem' }}
          onClick={() => setActiveCategory('cliente')}
        >
          <Users size={20} /> Saldo de CLIENTES
        </button>
      </div>

      {/* ================= SALDO DE TRANSFERÊNCIAS ================= */}
      {activeCategory === 'transferencia' && (
        <>
          {/* Summary Cards */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '20px' }}>
            <div className="stat-card">
              <div className="stat-info">
                <div className="stat-label">Entradas (Transferências)</div>
                <div className="stat-value" style={{ color: 'var(--success-600)' }}>
                  +{transfStats.entradas}
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-info">
                <div className="stat-label">Saídas (Transferências)</div>
                <div className="stat-value" style={{ color: 'var(--danger-600)' }}>
                  -{transfStats.saidas}
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-info">
                <div className="stat-label">Saldo Atual (Transferências)</div>
                <div className="stat-value" style={{ color: transfSaldo >= 0 ? 'var(--primary-600)' : 'var(--danger-600)' }}>
                  {transfSaldo}
                </div>
              </div>
            </div>
          </div>

          {/* Filters Card */}
          <div className="filters-card">
            <div className="filters-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Filtrar por Indústria</label>
                <select
                  className="form-select"
                  value={transfFilters.industryId}
                  onChange={(e) => setTransfFilters({ ...transfFilters, industryId: e.target.value })}
                >
                  <option value="">Todas as Indústrias</option>
                  {industries.map((ind) => (
                    <option key={ind.id} value={ind.id}>
                      {ind.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Nº NF / Termo</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ex: 123456"
                  value={transfFilters.documentNumber}
                  onChange={(e) => setTransfFilters({ ...transfFilters, documentNumber: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Tipo de Lançamento</label>
                <select
                  className="form-select"
                  value={transfFilters.type}
                  onChange={(e) => setTransfFilters({ ...transfFilters, type: e.target.value })}
                >
                  <option value="">Entradas e Saídas</option>
                  <option value="entrada">Apenas Entradas</option>
                  <option value="saida">Apenas Saídas</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Data Inicial</label>
                <input
                  type="date"
                  className="form-input"
                  value={transfFilters.dateStart}
                  onChange={(e) => setTransfFilters({ ...transfFilters, dateStart: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Data Final</label>
                <input
                  type="date"
                  className="form-input"
                  value={transfFilters.dateEnd}
                  onChange={(e) => setTransfFilters({ ...transfFilters, dateEnd: e.target.value })}
                />
              </div>

              <div className="filters-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setTransfFilters({ industryId: '', documentNumber: '', dateStart: '', dateEnd: '', type: '' })}
                >
                  <RefreshCw size={16} /> Limpar
                </button>
              </div>
            </div>
          </div>

          {/* Sub-toggle: Movimentações vs Resumo por Distribuidor */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button
              className={`btn ${transfSubView === 'movements' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '8px 14px' }}
              onClick={() => setTransfSubView('movements')}
            >
              <List size={16} /> Lançamentos
            </button>
            <button
              className={`btn ${transfSubView === 'distributors' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '8px 14px' }}
              onClick={() => setTransfSubView('distributors')}
            >
              <Truck size={16} /> Resumo por Distribuidor
            </button>
          </div>

          {transfSubView === 'movements' ? (
            <DataTable
              columns={columns}
              data={transfMovements}
              searchPlaceholder="Busca rápida por qualquer campo ou número de termo..."
              loading={loading}
              actions={(row) => (
                <>
                  {canDelete(user) && (
                    <button
                      className="btn-delete"
                      onClick={() => setConfirmDelete({ open: true, id: row.id })}
                      title="Excluir Lançamento"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </>
              )}
            />
          ) : (
            /* Resumo por Distribuidor */
            <div>
              {distributorSummary.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)', border: '1px dashed var(--border-light)', borderRadius: 'var(--radius-md)' }}>
                  <Truck size={36} style={{ marginBottom: '10px', opacity: 0.4 }} />
                  <p style={{ margin: 0, fontSize: '0.95rem' }}>Nenhuma movimentação com distribuidor encontrada.</p>
                  <p style={{ margin: '4px 0 0', fontSize: '0.82rem', opacity: 0.7 }}>
                    Cadastre indústrias do tipo CD e registre saídas/termos selecionando distribuidores.
                  </p>
                </div>
              ) : (
                <>
                  {/* Group by industry */}
                  {(() => {
                    const industryGroups = {};
                    distributorSummary.forEach((item) => {
                      if (!industryGroups[item.industryId]) {
                        industryGroups[item.industryId] = {
                          industryName: item.industryName,
                          distribuidores: [],
                        };
                      }
                      industryGroups[item.industryId].distribuidores.push(item);
                    });

                    return Object.entries(industryGroups).map(([indId, group]) => {
                      const totalEntradas = group.distribuidores.reduce((s, d) => s + d.entradas, 0);
                      const totalSaidas = group.distribuidores.reduce((s, d) => s + d.saidas, 0);
                      const saldoIndustria = totalEntradas - totalSaidas;

                      return (
                        <div key={indId} style={{ marginBottom: '20px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                          {/* Industry header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.95rem' }}>
                              <Truck size={18} color="var(--warning-500, #f59e0b)" />
                              {group.industryName}
                            </div>
                            <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem', fontWeight: 600 }}>
                              <span>Entradas: <span style={{ color: 'var(--success-600)' }}>+{totalEntradas}</span></span>
                              <span>Saídas: <span style={{ color: 'var(--danger-600)' }}>-{totalSaidas}</span></span>
                              <span>Saldo: <span style={{ color: saldoIndustria >= 0 ? 'var(--primary-600)' : 'var(--danger-600)' }}>{saldoIndustria}</span></span>
                            </div>
                          </div>

                          {/* Column headers */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 100px', alignItems: 'center', padding: '6px 16px', background: 'var(--bg-hover)', borderBottom: '1px solid var(--border-color)', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            <span>Distribuidor</span>
                            <span style={{ textAlign: 'center' }}>Entradas</span>
                            <span style={{ textAlign: 'center' }}>Saídas</span>
                            <span style={{ textAlign: 'center' }}>Saldo</span>
                          </div>

                          {/* Distributor rows */}
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {group.distribuidores.map((dist, idx) => {
                              const saldo = dist.entradas - dist.saidas;
                              return (
                                <div
                                  key={idx}
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 100px 100px 100px',
                                    alignItems: 'center',
                                    padding: '10px 16px',
                                    borderBottom: idx < group.distribuidores.length - 1 ? '1px solid var(--border-light)' : 'none',
                                    fontSize: '0.88rem',
                                    background: 'var(--bg-primary)',
                                  }}
                                >
                                  <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: saldo > 0 ? 'var(--success-500)' : saldo < 0 ? 'var(--danger-500)' : 'var(--text-muted)', flexShrink: 0 }} />
                                    {dist.distribuidor}
                                  </div>
                                  <div style={{ textAlign: 'center' }}>
                                    <span style={{ color: 'var(--success-600)', fontWeight: 700 }}>+{dist.entradas}</span>
                                  </div>
                                  <div style={{ textAlign: 'center' }}>
                                    <span style={{ color: 'var(--danger-600)', fontWeight: 700 }}>-{dist.saidas}</span>
                                  </div>
                                  <div style={{ textAlign: 'center', fontWeight: 800, color: saldo >= 0 ? 'var(--primary-600)' : 'var(--danger-600)' }}>
                                    {saldo}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* ================= SALDO DE CLIENTES ================= */}
      {activeCategory === 'cliente' && (
        <>
          {/* Summary Cards */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '20px' }}>
            <div className="stat-card">
              <div className="stat-info">
                <div className="stat-label">Entradas (Clientes)</div>
                <div className="stat-value" style={{ color: 'var(--success-600)' }}>
                  +{clientStats.entradas}
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-info">
                <div className="stat-label">Saídas (Clientes)</div>
                <div className="stat-value" style={{ color: 'var(--danger-600)' }}>
                  -{clientStats.saidas}
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-info">
                <div className="stat-label">Saldo Atual (Clientes)</div>
                <div className="stat-value" style={{ color: clientSaldo >= 0 ? 'var(--primary-600)' : 'var(--danger-600)' }}>
                  {clientSaldo}
                </div>
              </div>
            </div>
          </div>

          {/* Filters Card */}
          <div className="filters-card">
            <div className="filters-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Filtrar por Cliente</label>
                <select
                  className="form-select"
                  value={clientFilters.clientId}
                  onChange={(e) => setClientFilters({ ...clientFilters, clientId: e.target.value })}
                >
                  <option value="">Todos os Clientes</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Filtrar por Indústria</label>
                <select
                  className="form-select"
                  value={clientFilters.industryId}
                  onChange={(e) => setClientFilters({ ...clientFilters, industryId: e.target.value })}
                >
                  <option value="">Todas as Indústrias</option>
                  {industries.map((ind) => (
                    <option key={ind.id} value={ind.id}>
                      {ind.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Nº NF / Termo</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ex: 123456"
                  value={clientFilters.documentNumber}
                  onChange={(e) => setClientFilters({ ...clientFilters, documentNumber: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Tipo de Lançamento</label>
                <select
                  className="form-select"
                  value={clientFilters.type}
                  onChange={(e) => setClientFilters({ ...clientFilters, type: e.target.value })}
                >
                  <option value="">Entradas e Saídas</option>
                  <option value="entrada">Apenas Entradas</option>
                  <option value="saida">Apenas Saídas</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Data Inicial</label>
                <input
                  type="date"
                  className="form-input"
                  value={clientFilters.dateStart}
                  onChange={(e) => setClientFilters({ ...clientFilters, dateStart: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Data Final</label>
                <input
                  type="date"
                  className="form-input"
                  value={clientFilters.dateEnd}
                  onChange={(e) => setClientFilters({ ...clientFilters, dateEnd: e.target.value })}
                />
              </div>

              <div className="filters-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setClientFilters({ industryId: '', clientId: '', documentNumber: '', dateStart: '', dateEnd: '', type: '' })}
                >
                  <RefreshCw size={16} /> Limpar
                </button>
              </div>
            </div>
          </div>

          <DataTable
            columns={columns}
            data={clientMovements}
            searchPlaceholder="Busca rápida nos Clientes por documento ou observação..."
            loading={loading}
            actions={(row) => (
              <>
                {canDelete(user) && (
                  <button
                    className="btn-delete"
                    onClick={() => setConfirmDelete({ open: true, id: row.id })}
                    title="Excluir Lançamento"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </>
            )}
          />
        </>
      )}

      <ConfirmDialog
        isOpen={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false, id: null })}
        onConfirm={handleDelete}
        title="Excluir Lançamento"
        message="Tem certeza que deseja excluir esta movimentação? O saldo será recalculado automaticamente."
        loading={saving}
      />
    </div>
  );
}
