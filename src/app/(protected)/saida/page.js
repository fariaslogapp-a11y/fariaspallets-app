'use client';

import { useState, useEffect } from 'react';
import { getDocuments } from '@/lib/firestore';
import { createMovement, calculateBalance, getPendingDocuments, getDocumentPendingBalance } from '@/lib/movements';
import { createTermo } from '@/lib/termos';
import { logAuditAction } from '@/lib/audit';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import Modal from '@/components/ui/Modal';
import { ArrowUpFromLine, CheckCircle2, ShieldAlert, FileText, Package, Check, Loader2, Printer } from 'lucide-react';

export default function ExitPage() {
  const [industries, setIndustries] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentBalance, setCurrentBalance] = useState(null);
  const [checkingBalance, setCheckingBalance] = useState(false);

  // Pending documents state (for NF/Termo controlled industries)
  const [pendingDocs, setPendingDocs] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState({}); // { docNumber: true/false }
  const [useManualDoc, setUseManualDoc] = useState(false); // Toggle for manual input vs selection

  const today = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    date: today,
    quantity: '',
    category: 'transferencia',
    industryId: '',
    clientId: '',
    documentNumber: '',
    placa: '',
    notes: '',
  });

  // Termo Pallet Popup state
  const [termoModalData, setTermoModalData] = useState(null);
  const [termoExtraForm, setTermoExtraForm] = useState({
    motorista: '',
    lacre: '',
    devolvidos: false,
    naoDevolvidos: false,
  });
  const [generatingTermo, setGeneratingTermo] = useState(false);

  const { user } = useAuth();
  const { addToast } = useToast();

  useEffect(() => {
    async function loadOptions() {
      try {
        const [inds, cls] = await Promise.all([
          getDocuments('industries', [], 'name', 'asc'),
          getDocuments('clients', [], 'name', 'asc'),
        ]);
        setIndustries(inds);
        setClients(cls);
      } catch (err) {
        console.error(err);
        addToast('Erro ao carregar cadastros', 'error');
      } finally {
        setLoading(false);
      }
    }
    loadOptions();
  }, []);

  const selectedIndustryObj = industries.find((i) => i.id === formData.industryId);
  const isDocumentControl = selectedIndustryObj?.controlType === 'document';

  // Fetch pending documents when industry changes and is document-controlled
  useEffect(() => {
    async function fetchPendingDocs() {
      if (!isDocumentControl || !formData.industryId) {
        setPendingDocs([]);
        setSelectedDocs({});
        setUseManualDoc(false);
        return;
      }

      setLoadingDocs(true);
      try {
        const docs = await getPendingDocuments(formData.industryId, formData.category);
        setPendingDocs(docs);
        setSelectedDocs({});
        setUseManualDoc(false);
      } catch (err) {
        console.error('Erro ao buscar documentos pendentes:', err);
        setPendingDocs([]);
      } finally {
        setLoadingDocs(false);
      }
    }
    fetchPendingDocs();
  }, [formData.industryId, formData.category, isDocumentControl]);

  // Auto-calculate quantity based on selected documents (supports partial quantities)
  useEffect(() => {
    if (!isDocumentControl || useManualDoc) return;

    const selectedDocNumbers = Object.keys(selectedDocs).filter((k) => (selectedDocs[k] || 0) > 0);
    if (selectedDocNumbers.length === 0) {
      setFormData((prev) => ({ ...prev, quantity: '', documentNumber: '' }));
      return;
    }

    const totalQty = pendingDocs
      .filter((d) => (selectedDocs[d.documentNumber] || 0) > 0)
      .reduce((sum, d) => sum + (selectedDocs[d.documentNumber] || 0), 0);

    const docNumberStr = selectedDocNumbers.join(', ');

    setFormData((prev) => ({
      ...prev,
      quantity: String(totalQty),
      documentNumber: docNumberStr,
    }));
  }, [selectedDocs, pendingDocs, isDocumentControl, useManualDoc]);

  // Update current available balance whenever category, industry, or client changes
  useEffect(() => {
    async function updateBalance() {
      if (formData.category === 'transferencia' && !formData.industryId) {
        setCurrentBalance(null);
        return;
      }
      if (formData.category === 'cliente' && !formData.clientId) {
        setCurrentBalance(null);
        return;
      }

      setCheckingBalance(true);
      try {
        const bal = await calculateBalance({
          category: formData.category,
          industryId: formData.industryId || null,
          clientId: formData.category === 'transferencia' ? null : (formData.clientId || null),
        });
        setCurrentBalance(bal);
      } catch (err) {
        console.error('Erro ao verificar saldo:', err);
      } finally {
        setCheckingBalance(false);
      }
    }
    updateBalance();
  }, [formData.category, formData.industryId, formData.clientId]);

  const handleCategoryChange = (newCategory) => {
    setFormData((prev) => ({
      ...prev,
      category: newCategory,
      industryId: '',
      clientId: '',
      documentNumber: '',
      quantity: '',
    }));
    setCurrentBalance(null);
    setPendingDocs([]);
    setSelectedDocs({});
    setUseManualDoc(false);
  };

  // Toggle doc selection: stores quantity (number) instead of boolean.
  // pendente = total pending qty for that doc.
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
    const allSelected = pendingDocs.every((d) => (selectedDocs[d.documentNumber] || 0) > 0);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.date) {
      addToast('Data é obrigatória', 'warning');
      return;
    }
    if (!formData.quantity || Number(formData.quantity) <= 0) {
      addToast('Quantidade deve ser um valor positivo maior que zero', 'warning');
      return;
    }

    // Regras por categoria
    if (formData.category === 'transferencia') {
      if (!formData.industryId) {
        addToast('Indústria é obrigatória para Transferências', 'warning');
        return;
      }
    } else if (formData.category === 'cliente') {
      if (!formData.clientId) {
        addToast('Cliente é obrigatório para Operação de Clientes', 'warning');
        return;
      }
    }

    // Regra de controle por Documento / Termo
    if (isDocumentControl) {
      if (!useManualDoc && selectedCount === 0) {
        addToast('Selecione ao menos uma NF/Termo para devolver, ou use a entrada manual.', 'warning');
        return;
      }
      if (useManualDoc && !formData.documentNumber.trim()) {
        addToast(`Nº da NF ou Termo Devolvido é obrigatório para a indústria ${selectedIndustryObj.name}`, 'warning');
        return;
      }
    }

    setSaving(true);
    try {
      // Server-side validation: check pending balance for selected documents
      if (isDocumentControl && !useManualDoc && selectedCount > 0) {
        for (const doc of pendingDocs.filter((d) => (selectedDocs[d.documentNumber] || 0) > 0)) {
          const pendingBalance = await getDocumentPendingBalance(
            doc.documentNumber,
            formData.industryId,
            formData.category
          );
          const requestedQty = selectedDocs[doc.documentNumber] || 0;

          if (pendingBalance <= 0) {
            addToast(
              `O documento ${doc.documentNumber} já foi totalmente baixado (saldo: ${pendingBalance}). Remova-o da seleção.`,
              'error'
            );
            setSaving(false);
            return;
          }

          if (requestedQty > pendingBalance) {
            addToast(
              `O documento ${doc.documentNumber} possui saldo disponível de ${pendingBalance} pallets, mas está sendo solicitado ${requestedQty}. Ajuste a quantidade.`,
              'error'
            );
            setSaving(false);
            return;
          }
        }
      }

      const movementData = {
        type: 'saida',
        category: formData.category,
        quantity: Number(formData.quantity),
        date: formData.date,
        industryId: formData.industryId || null,
        clientId: formData.category === 'transferencia' ? null : (formData.clientId || null),
        documentNumber: isDocumentControl ? formData.documentNumber.trim() : (formData.documentNumber.trim() || null),
        placa: formData.placa.trim() || '',
        notes: formData.notes.trim() || '',
        createdBy: user.uid,
        createdByName: user.name || user.email,
      };

      const movId = await createMovement(movementData);

      await logAuditAction('create', user.uid, user.name, {
        collection: 'movements',
        documentId: movId,
        after: movementData,
      });

      addToast(`Saída de ${formData.quantity} pallets registrada com sucesso!`, 'success');

      // Prepare selectedDocsDetails if any documents were selected
      let selectedDocsDetails = [];
      if (isDocumentControl && !useManualDoc && selectedCount > 0) {
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

      // If category is transferencia (industry exit), open popup to offer Termo Pallet generation
      if (formData.industryId) {
        setTermoModalData({
          movementId: movId,
          date: formData.date,
          quantity: Number(formData.quantity),
          industryId: formData.industryId,
          industryName: selectedIndustryObj?.name || '',
          documentNumber: isDocumentControl ? formData.documentNumber.trim() : (formData.documentNumber.trim() || null),
          placa: formData.placa.trim() || '',
          selectedDocsDetails,
        });
        setTermoExtraForm({
          motorista: '',
          lacre: '',
          devolvidos: false,
          naoDevolvidos: false,
        });
      }

      setFormData({
        date: formData.date,
        quantity: '',
        category: formData.category,
        industryId: '',
        clientId: '',
        documentNumber: '',
        placa: '',
        notes: '',
      });
      setCurrentBalance(null);
      setPendingDocs([]);
      setSelectedDocs({});
      setUseManualDoc(false);
    } catch (err) {
      console.error(err);
      addToast(err.message || 'Erro ao registrar saída de pallets', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateTermoFromSaida = async (e) => {
    e.preventDefault();
    if (!termoModalData) return;

    setGeneratingTermo(true);
    try {
      const result = await createTermo({
        movementId: termoModalData.movementId,
        date: termoModalData.date,
        quantity: termoModalData.quantity,
        industryId: termoModalData.industryId,
        documentNumber: termoModalData.documentNumber,
        placa: termoModalData.placa || '',
        selectedDocsDetails: termoModalData.selectedDocsDetails || [],
        motorista: termoExtraForm.motorista,
        lacre: termoExtraForm.lacre,
        devolvidos: termoExtraForm.devolvidos,
        naoDevolvidos: termoExtraForm.naoDevolvidos,
        createdBy: user.uid,
        createdByName: user.name || user.email,
      });

      await logAuditAction('create', user.uid, user.name, {
        collection: 'termos',
        documentId: result.id,
        after: { ...termoModalData, ...termoExtraForm, number: result.number },
      });

      addToast(`Termo Pallet Nº ${result.number} gerado com sucesso!`, 'success');
      setTermoModalData(null);

      // Open print layout in a new tab
      window.open(`/termos/imprimir/${result.id}`, '_blank');
    } catch (err) {
      console.error('Erro ao gerar termo da saída:', err);
      addToast(err?.message || 'Erro ao gerar termo da saída', 'error');
    } finally {
      setGeneratingTermo(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-inline">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ArrowUpFromLine size={28} color="var(--danger-500)" />
            Saída de Pallets
          </h1>
          <p className="page-subtitle">Registre o envio/saída de pallets do estoque</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Formulário de Lançamento de Saída</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="badge badge-danger">Operação de Saída</span>
            {currentBalance !== null && (
              <span className={`saldo-display ${currentBalance > 0 ? 'saldo-positive' : 'saldo-zero'}`}>
                Saldo Disponível: {checkingBalance ? '...' : currentBalance}
              </span>
            )}
          </div>
        </div>
        <div className="card-body">
          {currentBalance !== null && currentBalance < 0 && (
            <div
              style={{
                background: 'rgba(251, 191, 36, 0.1)',
                border: '1px solid #f59e0b',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                color: '#92400e',
                fontSize: '0.875rem',
              }}
            >
              <ShieldAlert size={20} />
              <div>
                <strong>Atenção:</strong> O saldo atual para este filtro é de <strong>{currentBalance} pallets</strong> (negativo).
                A operação será permitida mesmo com saldo negativo.
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Categoria */}
            <div className="form-group">
              <label className="form-label">
                Categoria de Operação <span className="form-required">*</span>
              </label>
              <div style={{ display: 'flex', gap: '16px' }}>
                <label
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    border: `2px solid ${formData.category === 'transferencia' ? 'var(--primary-500)' : 'var(--border-light)'}`,
                    background: formData.category === 'transferencia' ? 'var(--primary-50)' : 'var(--bg-input)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontWeight: 600,
                  }}
                >
                  <input
                    type="radio"
                    name="category"
                    value="transferencia"
                    checked={formData.category === 'transferencia'}
                    onChange={() => handleCategoryChange('transferencia')}
                  />
                  TRANSFERÊNCIAS
                </label>

                <label
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    border: `2px solid ${formData.category === 'cliente' ? 'var(--primary-500)' : 'var(--border-light)'}`,
                    background: formData.category === 'cliente' ? 'var(--primary-50)' : 'var(--bg-input)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontWeight: 600,
                  }}
                >
                  <input
                    type="radio"
                    name="category"
                    value="cliente"
                    checked={formData.category === 'cliente'}
                    onChange={() => handleCategoryChange('cliente')}
                  />
                  CLIENTES
                </label>
              </div>
            </div>

            <div className="form-row">
              {/* Data */}
              <div className="form-group">
                <label className="form-label">
                  Data do Lançamento <span className="form-required">*</span>
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>

              {/* Quantidade */}
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
                  style={
                    isDocumentControl && !useManualDoc && selectedCount > 0
                      ? { background: 'var(--primary-50)', borderColor: 'var(--primary-300)' }
                      : {}
                  }
                />
                {isDocumentControl && !useManualDoc && selectedCount > 0 && (
                  <p className="form-hint" style={{ color: 'var(--primary-600)' }}>
                    Quantidade calculada automaticamente com base nos documentos selecionados. Você pode ajustar manualmente.
                  </p>
                )}
              </div>
            </div>

            <div className="form-row">
              {/* Indústria */}
              <div className="form-group">
                <label className="form-label">
                  Indústria {formData.category === 'transferencia' ? <span className="form-required">*</span> : '(Opcional)'}
                </label>
                <select
                  className="form-select"
                  value={formData.industryId}
                  onChange={(e) => setFormData({ ...formData, industryId: e.target.value, documentNumber: '', quantity: '' })}
                  required={formData.category === 'transferencia'}
                >
                  <option value="">Selecione uma Indústria...</option>
                  {industries.map((ind) => (
                    <option key={ind.id} value={ind.id}>
                      {ind.name} {ind.controlType === 'document' ? '(Controle por NF/Termo)' : '(Por Volume)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cliente (Somente se categoria for CLIENTES) */}
              {formData.category === 'cliente' && (
                <div className="form-group">
                  <label className="form-label">
                    Cliente <span className="form-required">*</span>
                  </label>
                  <select
                    className="form-select"
                    value={formData.clientId}
                    onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                    required
                  >
                    <option value="">Selecione um Cliente...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.city ? `(${c.city})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* ============ DOCUMENT CONTROL SECTION ============ */}
            {isDocumentControl && (
              <div className="animate-in" style={{ marginBottom: '20px' }}>
                {/* Header with toggle */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '12px',
                  }}
                >
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: 0 }}>
                    <FileText size={16} color="var(--primary-500)" />
                    NFs / Termos para Devolução <span className="form-required">*</span>
                  </label>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                    onClick={() => {
                      setUseManualDoc(!useManualDoc);
                      setSelectedDocs({});
                      setFormData((prev) => ({ ...prev, documentNumber: '', quantity: '' }));
                    }}
                  >
                    {useManualDoc ? '← Voltar para seleção' : 'Digitar manualmente'}
                  </button>
                </div>

                {useManualDoc ? (
                  /* Manual document input */
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ex: Ref. NF 123456 ou Termo 789"
                      value={formData.documentNumber}
                      onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })}
                      required={isDocumentControl}
                    />
                    <p className="form-hint">
                      Informe o número da NF ou Termo ao qual esta devolução/saída se refere.
                    </p>
                  </div>
                ) : (
                  /* Interactive document selection */
                  <div>
                    {loadingDocs ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '10px',
                          padding: '30px',
                          color: 'var(--text-secondary)',
                          fontSize: '0.9rem',
                        }}
                      >
                        <Loader2 size={20} className="spin-animation" style={{ animation: 'spin 1s linear infinite' }} />
                        Buscando documentos pendentes...
                      </div>
                    ) : pendingDocs.length === 0 ? (
                      <div
                        style={{
                          background: 'var(--bg-hover)',
                          borderRadius: 'var(--radius-md)',
                          padding: '24px',
                          textAlign: 'center',
                          color: 'var(--text-secondary)',
                          fontSize: '0.9rem',
                          border: '1px dashed var(--border-light)',
                        }}
                      >
                        <Package size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
                        <p style={{ margin: 0 }}>Nenhuma NF/Termo pendente de devolução para esta indústria.</p>
                        <p style={{ margin: '4px 0 0', fontSize: '0.8rem', opacity: 0.7 }}>
                          Registre entradas com NF/Termo primeiro, ou use a entrada manual.
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Select All / Info bar */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '10px',
                            padding: '8px 12px',
                            background: 'var(--bg-hover)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.85rem',
                          }}
                        >
                          <button
                            type="button"
                            className="btn btn-ghost"
                            style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                            onClick={handleSelectAll}
                          >
                            {pendingDocs.every((d) => (selectedDocs[d.documentNumber] || 0) > 0)
                              ? 'Desmarcar Todos'
                              : 'Selecionar Todos'}
                          </button>
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {selectedCount} de {pendingDocs.length} selecionado{selectedCount !== 1 ? 's' : ''}
                          </span>
                        </div>

                        {/* Document cards */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
                          {pendingDocs.map((doc) => {
                            const isSelected = (selectedDocs[doc.documentNumber] || 0) > 0;
                            const selectedQty = selectedDocs[doc.documentNumber] || doc.pendente;
                            return (
                              <div
                                key={doc.documentNumber}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '12px',
                                  padding: '12px 16px',
                                  borderRadius: 'var(--radius-md)',
                                  border: `2px solid ${isSelected ? 'var(--primary-500)' : 'var(--border-light)'}`,
                                  background: isSelected ? 'var(--primary-50)' : 'var(--bg-card)',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                  userSelect: 'none',
                                }}
                                onClick={() => handleDocToggle(doc.documentNumber, doc.pendente)}
                                onMouseEnter={(e) => {
                                  if (!isSelected) e.currentTarget.style.borderColor = 'var(--primary-300)';
                                }}
                                onMouseLeave={(e) => {
                                  if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-light)';
                                }}
                              >
                                {/* Custom checkbox */}
                                <div
                                  style={{
                                    width: '22px',
                                    height: '22px',
                                    borderRadius: '6px',
                                    border: `2px solid ${isSelected ? 'var(--primary-500)' : 'var(--border-light)'}`,
                                    background: isSelected ? 'var(--primary-500)' : 'transparent',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    transition: 'all 0.2s ease',
                                  }}
                                >
                                  {isSelected && <Check size={14} color="white" strokeWidth={3} />}
                                </div>

                                {/* Document info */}
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                  <div style={{ flex: '1 1 140px' }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                                      <FileText size={14} style={{ marginRight: '4px', verticalAlign: 'text-bottom' }} />
                                      {doc.documentNumber}
                                    </div>
                                    {doc.entradaDate && (
                                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                        Entrada em: {doc.entradaDate.split('-').reverse().join('/')}
                                      </div>
                                    )}
                                  </div>

                                  <div style={{ display: 'flex', gap: '16px', fontSize: '0.82rem', alignItems: 'center' }}>
                                    <div style={{ textAlign: 'center' }}>
                                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Entrada
                                      </div>
                                      <div style={{ fontWeight: 700, color: 'var(--success-600)' }}>
                                        {doc.totalEntrada}
                                      </div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Devolvido
                                      </div>
                                      <div style={{ fontWeight: 700, color: 'var(--danger-600)' }}>
                                        {doc.totalSaida}
                                      </div>
                                    </div>

                                    {/* When selected: show editable qty input (partial abate). When not selected: show pending total. */}
                                    {isSelected ? (
                                      <div
                                        style={{ textAlign: 'center' }}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <div style={{ color: 'var(--primary-600)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, marginBottom: '3px' }}>
                                          Devolvendo
                                        </div>
                                        <input
                                          type="number"
                                          min="1"
                                          max={doc.pendente}
                                          value={selectedQty}
                                          onChange={(e) => handleDocQtyChange(doc.documentNumber, e.target.value, doc.pendente)}
                                          style={{
                                            width: '64px',
                                            textAlign: 'center',
                                            fontWeight: 800,
                                            color: 'var(--primary-700)',
                                            fontSize: '0.95rem',
                                            border: '1.5px solid var(--primary-400)',
                                            borderRadius: '6px',
                                            padding: '2px 4px',
                                            background: 'white',
                                            outline: 'none',
                                            boxShadow: '0 0 0 2px var(--primary-100)',
                                          }}
                                        />
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                          de {doc.pendente}
                                        </div>
                                      </div>
                                    ) : (
                                      <div style={{ textAlign: 'center' }}>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                          Pendente
                                        </div>
                                        <div style={{ fontWeight: 800, color: 'var(--primary-600)', fontSize: '1rem' }}>
                                          {doc.pendente}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Selected summary */}
                        {selectedCount > 0 && (
                          <div
                            style={{
                              marginTop: '12px',
                              padding: '10px 16px',
                              background: 'var(--primary-50)',
                              border: '1px solid var(--primary-200)',
                              borderRadius: 'var(--radius-md)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '0.88rem',
                              fontWeight: 600,
                              color: 'var(--primary-700)',
                            }}
                          >
                            <span>
                              <CheckCircle2 size={16} style={{ marginRight: '6px', verticalAlign: 'text-bottom' }} />
                              {selectedCount} documento{selectedCount !== 1 ? 's' : ''} selecionado{selectedCount !== 1 ? 's' : ''}
                            </span>
                            <span style={{ fontSize: '1rem' }}>
                              Total: {pendingDocs.filter((d) => (selectedDocs[d.documentNumber] || 0) > 0).reduce((s, d) => s + (selectedDocs[d.documentNumber] || 0), 0)} pallets
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Campo de Documento / Referência para indústrias NÃO controladas por documento */}
            {!isDocumentControl && formData.documentNumber && (
              <div className="form-group animate-in">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={16} color="var(--primary-500)" />
                  Nº da NF ou Termo Devolvido / Referenciado (Opcional)
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ex: Ref. NF 123456 ou Termo 789"
                  value={formData.documentNumber}
                  onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })}
                />
                <p className="form-hint">Referência opcional do documento.</p>
              </div>
            )}

            {/* Placa */}
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

            {/* Observação */}
            <div className="form-group">
              <label className="form-label">Observação (Opcional)</label>
              <textarea
                className="form-textarea"
                placeholder="Detalhes sobre o transporte, observações, etc."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-danger btn-lg"
                disabled={saving}
              >
                <CheckCircle2 size={20} />
                {saving ? 'Registrando...' : 'Confirmar Saída'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Modal Popup: Gerar Termo Pallet após Saída */}
      <Modal
        isOpen={!!termoModalData}
        onClose={() => setTermoModalData(null)}
        title="Deseja Gerar o Termo Pallet para esta Saída?"
      >
        {termoModalData && (
          <form onSubmit={handleGenerateTermoFromSaida}>
            <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: '8px', marginBottom: '18px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
                <div><strong>Indústria:</strong> {termoModalData.industryName}</div>
                <div><strong>Quantidade:</strong> <span style={{ color: 'var(--danger-600)', fontWeight: 'bold' }}>{termoModalData.quantity} Pallets</span></div>
                <div><strong>Data:</strong> {termoModalData.date.split('-').reverse().join('/')}</div>
                {termoModalData.placa && (
                  <div><strong>Placa:</strong> {termoModalData.placa}</div>
                )}
                {termoModalData.documentNumber && (
                  <div><strong>NFs/Termos:</strong> {termoModalData.documentNumber}</div>
                )}
              </div>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Preencha os dados complementares de expedição se desejar imprimir o <strong>Termo Pallet</strong> agora:
            </p>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nome do Motorista</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Nome do motorista..."
                  value={termoExtraForm.motorista}
                  onChange={(e) => setTermoExtraForm({ ...termoExtraForm, motorista: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Nº do Lacre</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Número do lacre..."
                  value={termoExtraForm.lacre}
                  onChange={(e) => setTermoExtraForm({ ...termoExtraForm, lacre: e.target.value })}
                />
              </div>
            </div>

            <div className="form-actions" style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setTermoModalData(null)}
                disabled={generatingTermo}
              >
                Não Gerar Termo (Concluir)
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={generatingTermo}
              >
                <Printer size={18} />
                {generatingTermo ? 'Gerando...' : 'Gerar e Imprimir Termo'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Inline CSS for spinner animation */}
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
