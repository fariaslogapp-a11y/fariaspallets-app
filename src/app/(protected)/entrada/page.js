'use client';

import { useState, useEffect } from 'react';
import { getDocuments } from '@/lib/firestore';
import { createMovement } from '@/lib/movements';
import { logAuditAction } from '@/lib/audit';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { ArrowDownToLine, CheckCircle2, FileText } from 'lucide-react';

export default function EntryPage() {
  const [industries, setIndustries] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
        addToast('Erro ao carregar dados dos cadastros', 'error');
      } finally {
        setLoading(false);
      }
    }
    loadOptions();
  }, []);

  const selectedIndustryObj = industries.find((i) => i.id === formData.industryId);
  const isDocumentControl = selectedIndustryObj?.controlType === 'document';

  const handleCategoryChange = (newCategory) => {
    setFormData((prev) => ({
      ...prev,
      category: newCategory,
      industryId: '',
      clientId: '',
      documentNumber: '',
    }));
  };

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
    if (isDocumentControl && !formData.documentNumber.trim()) {
      addToast(`Nº da NF ou Termo é obrigatório para a indústria ${selectedIndustryObj.name}`, 'warning');
      return;
    }

    setSaving(true);
    try {
      const movementData = {
        type: 'entrada',
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

      addToast(`Entrada de ${formData.quantity} pallets registrada com sucesso!`, 'success');

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
    } catch (err) {
      console.error(err);
      addToast(err.message || 'Erro ao registrar entrada de pallets', 'error');
    } finally {
      setSaving(false);
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
            <ArrowDownToLine size={28} color="var(--success-500)" />
            Entrada de Pallets
          </h1>
          <p className="page-subtitle">Registre o recebimento/entrada de pallets no estoque</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Formulário de Lançamento de Entrada</span>
          <span className="badge badge-success">Operação de Entrada</span>
        </div>
        <div className="card-body">
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
                />
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
                  onChange={(e) => setFormData({ ...formData, industryId: e.target.value })}
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

            {/* Campo de Documento / Referência se a indústria selecionada for por controle de Documento/NF */}
            {(isDocumentControl || formData.documentNumber) && (
              <div className="form-group animate-in">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={16} color="var(--primary-500)" />
                  Nº da Nota Fiscal / Termo de Pallets {isDocumentControl ? <span className="form-required">*</span> : '(Opcional)'}
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ex: NF 123456 ou Termo 789"
                  value={formData.documentNumber}
                  onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })}
                  required={isDocumentControl}
                />
                <p className="form-hint">
                  {isDocumentControl
                    ? 'Esta indústria exige o número da NF ou Termo para rastreamento de devolução.'
                    : 'Referência opcional do documento.'}
                </p>
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
                placeholder="Detalhes sobre a carga, nota fiscal, observações, etc."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-success btn-lg" disabled={saving}>
                <CheckCircle2 size={20} />
                {saving ? 'Registrando...' : 'Confirmar Entrada'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
