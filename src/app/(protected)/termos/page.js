'use client';

import { useState, useEffect, useMemo } from 'react';
import { getDocuments } from '@/lib/firestore';
import { createTermo, cancelTermo } from '@/lib/termos';
import { getPendingDocuments, calculateBalance } from '@/lib/movements';
import { logAuditAction } from '@/lib/audit';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { canDelete } from '@/lib/permissions';
import DataTable from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Plus, Printer, Trash2, FileText, XCircle, CheckSquare, Square, AlertCircle, RefreshCw, ArrowUpDown, ArrowDown, ArrowUp } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function TermosPage() {
  const [termos, setTermos] = useState([]);
  const [industries, setIndustries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState({ open: false, id: null });

  // Pending documents & balance state for modal
  const [pendingDocs, setPendingDocs] = useState([]);
  const [selectedDocs, setSelectedDocs] = useState({});
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [currentBalance, setCurrentBalance] = useState(null);
  const [checkingBalance, setCheckingBalance] = useState(false);
  const [useManualMode, setUseManualMode] = useState(false);

  const router = useRouter();
  const { user } = useAuth();
  const { addToast } = useToast();

  const today = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    date: today,
    quantity: '',
    industryId: '',
    motorista: '',
    lacre: '',
    placa: '',
    documentNumber: '',
    devolvidos: false,
    naoDevolvidos: false,
  });

  const [sortOrder, setSortOrder] = useState('desc'); // Padrão: mais novo para o mais antigo

  const loadData = async () => {
    setLoading(true);
    try {
      const [termsData, indsData] = await Promise.all([
        getDocuments('termos', [], 'number', 'desc'),
        getDocuments('industries', [], 'name', 'asc'),
      ]);
      setTermos(termsData);
      setIndustries(indsData);
    } catch (err) {
      console.error(err);
      addToast('Erro ao carregar termos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const sortedTermos = useMemo(() => {
    return [...termos].sort((a, b) => {
      const numA = Number(a.number) || 0;
      const numB = Number(b.number) || 0;
      return sortOrder === 'desc' ? numB - numA : numA - numB;
    });
  }, [termos, sortOrder]);

  useEffect(() => {
    loadData();
  }, []);

  const selectedIndustryObj = industries.find((i) => i.id === formData.industryId);
  const isDocControlIndustry = selectedIndustryObj?.controlType === 'document';

  // Fetch pending docs & balance when industry changes in modal
  useEffect(() => {
    async function onIndustryChange() {
      if (!formData.industryId) {
        setPendingDocs([]);
        setSelectedDocs({});
        setCurrentBalance(null);
        return;
      }

      setCheckingBalance(true);
      setLoadingDocs(true);

      try {
        const [bal, docs] = await Promise.all([
          calculateBalance({ category: 'transferencia', industryId: formData.industryId }),
          getPendingDocuments(formData.industryId, 'transferencia'),
        ]);

        setCurrentBalance(bal);
        setPendingDocs(docs);
        setSelectedDocs({});
        setUseManualMode(false);
      } catch (err) {
        console.error('Erro ao buscar dados da indústria:', err);
      } finally {
        setCheckingBalance(false);
        setLoadingDocs(false);
      }
    }

    if (isModalOpen) {
      onIndustryChange();
    }
  }, [formData.industryId, isModalOpen]);

  // Auto-calculate quantity from selected pending docs (supports partial quantities)
  useEffect(() => {
    if (useManualMode) return;

    const selectedKeys = Object.keys(selectedDocs).filter((k) => (selectedDocs[k] || 0) > 0);
    if (selectedKeys.length === 0) {
      if (pendingDocs.length > 0 && !useManualMode) {
        setFormData((prev) => ({ ...prev, quantity: '', documentNumber: '' }));
      }
      return;
    }

    const totalQty = pendingDocs
      .filter((d) => (selectedDocs[d.documentNumber] || 0) > 0)
      .reduce((sum, d) => sum + (selectedDocs[d.documentNumber] || 0), 0);

    const docStr = selectedKeys.join(', ');

    setFormData((prev) => ({
      ...prev,
      quantity: String(totalQty),
      documentNumber: docStr,
    }));
  }, [selectedDocs, pendingDocs, useManualMode]);

  // Toggle doc selection: stores quantity (number) instead of boolean.
  const handleDocToggle = (docNumber, pendente) => {
    setSelectedDocs((prev) => ({
      ...prev,
      [docNumber]: (prev[docNumber] || 0) > 0 ? 0 : pendente,
    }));
  };

  // Allows the user to adjust the partial quantity being returned for a selected doc.
  const handleDocQtyChange = (docNumber, qty, maxQty) => {
    const parsed = Number(qty);
    if (isNaN(parsed)) return;
    const validated = Math.max(1, Math.min(parsed, maxQty));
    setSelectedDocs((prev) => ({
      ...prev,
      [docNumber]: validated,
    }));
  };

  const handleSelectAll = () => {
    const allSelected = pendingDocs.length > 0 && pendingDocs.every((d) => (selectedDocs[d.documentNumber] || 0) > 0);
    if (allSelected) {
      setSelectedDocs({});
    } else {
      const newSelected = {};
      pendingDocs.forEach((d) => {
        newSelected[d.documentNumber] = d.pendente; // pre-fill with full pending qty
      });
      setSelectedDocs(newSelected);
    }
  };

  const selectedCount = Object.values(selectedDocs).filter((v) => v > 0).length;

  const openCreateModal = () => {
    setFormData({
      date: today,
      quantity: '',
      industryId: '',
      motorista: '',
      lacre: '',
      placa: '',
      documentNumber: '',
      devolvidos: false,
      naoDevolvidos: false,
    });
    setPendingDocs([]);
    setSelectedDocs({});
    setCurrentBalance(null);
    setUseManualMode(false);
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.industryId) {
      addToast('A Indústria (Distribuidor) é obrigatória', 'warning');
      return;
    }
    if (!formData.quantity || Number(formData.quantity) <= 0) {
      addToast('A quantidade expedida deve ser maior que zero', 'warning');
      return;
    }

    if (currentBalance !== null && Number(formData.quantity) > currentBalance) {
      addToast(`Saldo insuficiente! Saldo disponível na indústria: ${currentBalance} pallets.`, 'error');
      return;
    }

    // Build details of selected documents for the second page summary
    let selectedDocsDetails = [];
    if (!useManualMode && selectedCount > 0) {
      selectedDocsDetails = pendingDocs
        .filter((d) => (selectedDocs[d.documentNumber] || 0) > 0)
        .map((d) => ({
          documentNumber: d.documentNumber,
          entradaDate: d.entradaDate || null,
          totalEntrada: d.totalEntrada,
          totalSaida: d.totalSaida,
          pendente: d.pendente,
          devolvidoAgora: selectedDocs[d.documentNumber], // partial or full qty
        }));
    }

    setSaving(true);
    try {
      const result = await createTermo({
        ...formData,
        quantity: Number(formData.quantity),
        placa: formData.placa.trim() || '',
        selectedDocsDetails,
        createdBy: user.uid,
        createdByName: user.name || user.email,
      });

      await logAuditAction('create', user.uid, user.name, {
        collection: 'termos',
        documentId: result.id,
        after: { ...formData, number: result.number },
      });

      addToast(`Termo Nº ${result.number} gerado e saída de ${formData.quantity} pallets computada!`, 'success');
      setIsModalOpen(false);
      loadData();
      
      // Open print layout in a new window or route
      window.open(`/termos/imprimir/${result.id}`, '_blank');
      
    } catch (err) {
      console.error(err);
      addToast(err?.message || 'Erro ao gerar termo', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!confirmCancel.id) return;
    setSaving(true);
    try {
      const termo = termos.find((t) => t.id === confirmCancel.id);
      await cancelTermo(confirmCancel.id);
      await logAuditAction('update', user.uid, user.name, {
        collection: 'termos',
        documentId: confirmCancel.id,
        before: termo,
        after: { ...termo, status: 'cancelado' },
        actionInfo: 'Cancelamento de Termo e estorno de Saída'
      });
      addToast('Termo cancelado e saída estornada com sucesso!', 'success');
      setConfirmCancel({ open: false, id: null });
      loadData();
    } catch (err) {
      console.error(err);
      addToast('Erro ao cancelar termo', 'error');
    } finally {
      setSaving(false);
    }
  };

  const getIndustryName = (id) => industries.find((i) => i.id === id)?.name || '-';

  const columns = [
    {
      header: 'Nº Termo',
      accessorKey: 'number',
      cell: (row) => (
        <span style={{ fontWeight: 700, color: 'var(--primary-600)' }}>
          {String(row.number).padStart(4, '0')}
        </span>
      ),
    },
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
      header: 'Distribuidor / Indústria',
      accessorKey: 'industryId',
      cell: (row) => getIndustryName(row.industryId),
    },
    {
      header: 'Qtd.',
      accessorKey: 'quantity',
      cell: (row) => <strong>{row.quantity}</strong>,
    },
    {
      header: 'NF / Termos Devolvidos',
      accessorKey: 'documentNumber',
      cell: (row) => (
        row.documentNumber ? (
          <span className="badge badge-primary" style={{ gap: '4px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.documentNumber}>
            <FileText size={12} /> {row.documentNumber}
          </span>
        ) : '-'
      ),
    },
    {
      header: 'Motorista',
      accessorKey: 'motorista',
      cell: (row) => row.motorista || '-',
    },
    {
      header: 'Lacre',
      accessorKey: 'lacre',
      cell: (row) => row.lacre || '-',
    },
    {
      header: 'Placa',
      accessorKey: 'placa',
      cell: (row) => row.placa || '-',
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (row) => (
        <span className={`badge ${row.status === 'ativo' ? 'badge-success' : 'badge-danger'}`}>
          {row.status === 'ativo' ? 'Ativo (Saída Registrada)' : 'Cancelado (Estornado)'}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={28} color="var(--primary-500)" />
            Termo Pallet
          </h1>
          <p className="page-subtitle">Gerencie, registre saídas de pallets e imprima os termos com resumo de devolução</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
            title="Clique para alternar a ordenação entre mais novos e mais antigos"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
          >
            <ArrowUpDown size={15} color="var(--primary-500)" />
            <span>Ordem: <strong>{sortOrder === 'desc' ? 'Mais Novos Primeiro' : 'Mais Antigos Primeiro'}</strong></span>
            {sortOrder === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
          </button>
          <button className="btn btn-primary" onClick={openCreateModal}>
            <Plus size={18} /> Novo Termo
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={sortedTermos}
        searchPlaceholder="Buscar por número do termo, motorista, NF ou lacre..."
        loading={loading}
        actions={(row) => (
          <>
            <button
              className="btn-edit"
              onClick={() => window.open(`/termos/imprimir/${row.id}`, '_blank')}
              title="Imprimir Termo"
              disabled={row.status === 'cancelado'}
              style={{ opacity: row.status === 'cancelado' ? 0.5 : 1 }}
            >
              <Printer size={16} />
            </button>
            {canDelete(user) && row.status !== 'cancelado' && (
              <button
                className="btn-delete"
                onClick={() => setConfirmCancel({ open: true, id: row.id })}
                title="Cancelar Termo e Estornar Saída"
              >
                <XCircle size={16} />
              </button>
            )}
          </>
        )}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Gerar Novo Termo de Pallet (Saída de Estoque)"
      >
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">
              Distribuidor (Indústria) <span className="form-required">*</span>
            </label>
            <select
              className="form-select"
              value={formData.industryId}
              onChange={(e) => setFormData({ ...formData, industryId: e.target.value })}
              required
            >
              <option value="">Selecione a Indústria...</option>
              {industries.map((ind) => (
                <option key={ind.id} value={ind.id}>
                  {ind.name} {ind.controlType === 'document' ? '(Controle por NF/Termo)' : ''}
                </option>
              ))}
            </select>

            {formData.industryId && (
              <div style={{ marginTop: '8px', fontSize: '0.85rem' }}>
                {checkingBalance ? (
                  <span style={{ color: 'var(--text-muted)' }}>Verificando saldo disponível...</span>
                ) : currentBalance !== null ? (
                  <span style={{ fontWeight: 600, color: currentBalance > 0 ? 'var(--success-600)' : 'var(--danger-600)' }}>
                    Saldo disponível nesta indústria: {currentBalance} pallets
                  </span>
                ) : null}
              </div>
            )}
          </div>

          {/* Pending Documents Selection (NF / Termos Devolvidos) */}
          {formData.industryId && (
            <div style={{ marginBottom: '16px', background: 'var(--bg-secondary)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.9rem' }}>
                  <FileText size={16} color="var(--primary-500)" />
                  Termos / NFs Pendentes para Devolução
                </div>

                {pendingDocs.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                      onClick={handleSelectAll}
                    >
                      {pendingDocs.every((d) => (selectedDocs[d.documentNumber] || 0) > 0) ? 'Desmarcar Todos' : 'Selecionar Todos'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                      onClick={() => setUseManualMode(!useManualMode)}
                    >
                      {useManualMode ? 'Usar Seleção' : 'Digitar Manual'}
                    </button>
                  </div>
                )}
              </div>

              {loadingDocs ? (
                <div style={{ textAlign: 'center', padding: '10px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Buscando termos pendentes...
                </div>
              ) : pendingDocs.length > 0 && !useManualMode ? (
                <div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Selecione as NFs/Termos que estão sendo devolvidos nesta expedição para gerar a <strong>Folha 2 (Resumo de Devolução)</strong> automaticamente:
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                    {pendingDocs.map((doc) => {
                      const isSelected = (selectedDocs[doc.documentNumber] || 0) > 0;
                      const selectedQty = isSelected ? (selectedDocs[doc.documentNumber] || doc.pendente) : doc.pendente;
                      const formattedEntradaDate = doc.entradaDate
                        ? doc.entradaDate.split('-').reverse().join('/')
                        : '-';

                      return (
                        <div
                          key={doc.documentNumber}
                          onClick={() => handleDocToggle(doc.documentNumber, doc.pendente)}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '6px',
                            border: `1.5px solid ${isSelected ? 'var(--primary-500)' : 'var(--border-color)'}`,
                            background: isSelected ? 'var(--primary-50, rgba(25, 118, 210, 0.08))' : 'var(--bg-primary)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '3px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: '0.85rem', color: isSelected ? 'var(--primary-600)' : 'inherit' }}>
                              {doc.documentNumber}
                            </strong>
                            {isSelected ? (
                              <CheckSquare size={16} color="var(--primary-500)" />
                            ) : (
                              <Square size={16} color="var(--text-muted)" />
                            )}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Entrada: {formattedEntradaDate}</span>
                            {isSelected ? (
                              <span onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ fontWeight: 600, color: 'var(--primary-600)' }}>Baixando:</span>
                                <input
                                  type="number"
                                  min="1"
                                  max={doc.pendente}
                                  value={selectedQty}
                                  onChange={(e) => handleDocQtyChange(doc.documentNumber, e.target.value, doc.pendente)}
                                  style={{
                                    width: '52px',
                                    textAlign: 'center',
                                    fontWeight: 700,
                                    fontSize: '0.8rem',
                                    border: '1px solid var(--primary-300)',
                                    borderRadius: '4px',
                                    padding: '1px 3px',
                                    color: 'var(--primary-700)',
                                    background: 'white',
                                    outline: 'none',
                                    boxShadow: '0 0 0 2px var(--primary-100)',
                                  }}
                                />
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>/{doc.pendente}</span>
                              </span>
                            ) : (
                              <span style={{ fontWeight: 600, color: 'var(--danger-600)' }}>
                                Pendente: {doc.pendente}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {selectedCount > 0 && (
                    <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--primary-600)', fontWeight: 600 }}>
                      ✓ {selectedCount} documento(s) selecionado(s) — Total: {pendingDocs.filter((d) => (selectedDocs[d.documentNumber] || 0) > 0).reduce((s, d) => s + (selectedDocs[d.documentNumber] || 0), 0)} pallets selecionados!
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {useManualMode ? (
                    <div>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Nº das NFs / Termos (opcional)</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Ex: 55410, 55412"
                        value={formData.documentNumber}
                        onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })}
                      />
                    </div>
                  ) : (
                    <span>Nenhum documento pendente registrado para esta indústria. A saída será feita pelo saldo geral.</span>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">
                Data da Expedição <span className="form-required">*</span>
              </label>
              <input
                type="date"
                className="form-input"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                Quantidade de Pallets <span className="form-required">*</span>
              </label>
              <input
                type="number"
                min="1"
                className="form-input"
                placeholder="Ex: 50"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Nome do Motorista</label>
              <input
                type="text"
                className="form-input"
                placeholder="Nome completo do motorista..."
                value={formData.motorista}
                onChange={(e) => setFormData({ ...formData, motorista: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Nº do Lacre</label>
              <input
                type="text"
                className="form-input"
                placeholder="Número do lacre..."
                value={formData.lacre}
                onChange={(e) => setFormData({ ...formData, lacre: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Placa do Veículo (Opcional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ex: ABC-1234"
              maxLength={8}
              value={formData.placa}
              onChange={(e) => setFormData({ ...formData, placa: e.target.value.toUpperCase() })}
            />
          </div>

          <div className="form-actions" style={{ marginTop: '24px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsModalOpen(false)}
              disabled={saving}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Printer size={18} />
              {saving ? 'Processando Saída e Gerando...' : 'Gerar Saída e Imprimir'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={confirmCancel.open}
        onClose={() => setConfirmCancel({ open: false, id: null })}
        onConfirm={handleCancel}
        title="Cancelar Termo"
        message="Tem certeza que deseja CANCELAR este termo? A movimentação de saída de pallets associada será estornada do sistema."
        loading={saving}
      />
    </div>
  );
}
