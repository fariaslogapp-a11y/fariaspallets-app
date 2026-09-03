'use client';

import { useState, useEffect } from 'react';
import { getDocuments, createDocument, updateDocument, deleteDocument } from '@/lib/firestore';
import { logAuditAction } from '@/lib/audit';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { isAdmin, canDelete, canCreateEditCadastros } from '@/lib/permissions';
import DataTable from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Plus, Edit, Trash2, Factory, CheckCircle, XCircle, FileText, Layers } from 'lucide-react';

export default function IndustriesPage() {
  const [industries, setIndustries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedIndustry, setSelectedIndustry] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null });
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    cnpj: '',
    city: '',
    controlType: 'volume', // 'volume' | 'document'
    active: true,
  });

  const { user } = useAuth();
  const { addToast } = useToast();

  const loadData = async () => {
    try {
      const data = await getDocuments('industries', [], 'name', 'asc');
      setIndustries(data);
    } catch (err) {
      console.error(err);
      addToast('Erro ao carregar indústrias', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setSelectedIndustry(null);
    setFormData({ name: '', cnpj: '', city: '', controlType: 'volume', active: true });
    setIsModalOpen(true);
  };

  const openEditModal = (industry) => {
    setSelectedIndustry(industry);
    setFormData({
      name: industry.name || '',
      cnpj: industry.cnpj || '',
      city: industry.city || '',
      controlType: industry.controlType || 'volume',
      active: industry.active ?? true,
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      addToast('Nome da indústria é obrigatório', 'warning');
      return;
    }

    setSaving(true);
    try {
      if (selectedIndustry) {
        await updateDocument('industries', selectedIndustry.id, formData);
        await logAuditAction('update', user.uid, user.name, {
          collection: 'industries',
          documentId: selectedIndustry.id,
          before: selectedIndustry,
          after: formData,
        });
        addToast('Indústria atualizada com sucesso', 'success');
      } else {
        const id = await createDocument('industries', formData);
        await logAuditAction('create', user.uid, user.name, {
          collection: 'industries',
          documentId: id,
          after: formData,
        });
        addToast('Indústria cadastrada com sucesso', 'success');
      }
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      console.error(err);
      addToast('Erro ao salvar indústria', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete.id) return;
    setSaving(true);
    try {
      const industry = industries.find((i) => i.id === confirmDelete.id);
      await deleteDocument('industries', confirmDelete.id);
      await logAuditAction('delete', user.uid, user.name, {
        collection: 'industries',
        documentId: confirmDelete.id,
        before: industry,
      });
      addToast('Indústria excluída com sucesso', 'success');
      setConfirmDelete({ open: false, id: null });
      loadData();
    } catch (err) {
      console.error(err);
      addToast('Erro ao excluir indústria', 'error');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      header: 'Nome da Indústria',
      accessorKey: 'name',
      cell: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
          <Factory size={16} color="var(--primary-500)" />
          {row.name}
        </div>
      ),
    },
    {
      header: 'Tipo de Controle',
      accessorKey: 'controlType',
      cell: (row) => (
        <span className={`badge ${row.controlType === 'document' ? 'badge-primary' : 'badge-neutral'}`}>
          {row.controlType === 'document' ? (
            <>
              <FileText size={12} /> Nota Fiscal / Termo
            </>
          ) : (
            <>
              <Layers size={12} /> Volume
            </>
          )}
        </span>
      ),
    },
    { header: 'CNPJ', accessorKey: 'cnpj', cell: (row) => row.cnpj || '-' },
    { header: 'Cidade', accessorKey: 'city', cell: (row) => row.city || '-' },
    {
      header: 'Status',
      accessorKey: 'active',
      cell: (row) => (
        <span className={`badge ${row.active ? 'badge-success' : 'badge-danger'}`}>
          {row.active ? (
            <>
              <CheckCircle size={12} /> Ativa
            </>
          ) : (
            <>
              <XCircle size={12} /> Inativa
            </>
          )}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Indústrias</h1>
          <p className="page-subtitle">Gerencie as indústrias e o tipo de controle de pallets (Volume vs NF/Termo)</p>
        </div>
        {canCreateEditCadastros(user) && (
          <button className="btn btn-primary" onClick={openCreateModal}>
            <Plus size={18} /> Nova Indústria
          </button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={industries}
        searchPlaceholder="Buscar por nome, CNPJ ou tipo de controle..."
        loading={loading}
        actions={(row) => (
          <>
            {canCreateEditCadastros(user) && (
              <button className="btn-edit" onClick={() => openEditModal(row)} title="Editar">
                <Edit size={16} />
              </button>
            )}
            {canDelete(user) && (
              <button
                className="btn-delete"
                onClick={() => setConfirmDelete({ open: true, id: row.id })}
                title="Excluir"
              >
                <Trash2 size={16} />
              </button>
            )}
          </>
        )}
      />

      {/* Modal Criar / Editar */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedIndustry ? 'Editar Indústria' : 'Nova Indústria'}
      >
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">
              Nome da Indústria <span className="form-required">*</span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="Ex: Lactalis, BRF, Aurora, Pamplona"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          {/* Tipo de Controle */}
          <div className="form-group">
            <label className="form-label">
              Tipo de Controle de Pallets <span className="form-required">*</span>
            </label>
            <div style={{ display: 'flex', gap: '16px' }}>
              <label
                style={{
                  flex: 1,
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${formData.controlType === 'volume' ? 'var(--primary-500)' : 'var(--border-light)'}`,
                  background: formData.controlType === 'volume' ? 'var(--primary-50)' : 'var(--bg-input)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
              >
                <input
                  type="radio"
                  name="controlType"
                  value="volume"
                  checked={formData.controlType === 'volume'}
                  onChange={(e) => setFormData({ ...formData, controlType: e.target.value })}
                />
                Por Volume (Padrão)
              </label>

              <label
                style={{
                  flex: 1,
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${formData.controlType === 'document' ? 'var(--primary-500)' : 'var(--border-light)'}`,
                  background: formData.controlType === 'document' ? 'var(--primary-50)' : 'var(--bg-input)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
              >
                <input
                  type="radio"
                  name="controlType"
                  value="document"
                  checked={formData.controlType === 'document'}
                  onChange={(e) => setFormData({ ...formData, controlType: e.target.value })}
                />
                NF ou Termo Pallets
              </label>
            </div>
            <p className="form-hint" style={{ marginTop: '6px' }}>
              {formData.controlType === 'document'
                ? 'Exigirá obrigatoriamente o número da Nota Fiscal ou Termo nos lançamentos de entrada e devoluções.'
                : 'Controle simples por quantidade acumulada de pallets.'}
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">CNPJ (Opcional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="00.000.000/0000-00"
              value={formData.cnpj}
              onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Cidade</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ex: Chapecó, Concórdia"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Status</label>
            <select
              className="form-select"
              value={formData.active ? 'true' : 'false'}
              onChange={(e) => setFormData({ ...formData, active: e.target.value === 'true' })}
            >
              <option value="true">Ativa</option>
              <option value="false">Inativa</option>
            </select>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsModalOpen(false)}
              disabled={saving}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false, id: null })}
        onConfirm={handleDelete}
        loading={saving}
      />
    </div>
  );
}
