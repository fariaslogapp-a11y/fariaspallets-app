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
import { Plus, Edit, Trash2, UserCircle } from 'lucide-react';

const ESTADOS_BR = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null });
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    city: '',
    state: 'SC',
  });

  const { user } = useAuth();
  const { addToast } = useToast();

  const loadData = async () => {
    try {
      const clientsData = await getDocuments('clients', [], 'name', 'asc');
      setClients(clientsData);
    } catch (err) {
      console.error(err);
      addToast('Erro ao carregar clientes', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setSelectedClient(null);
    setFormData({ name: '', city: '', state: 'SC' });
    setIsModalOpen(true);
  };

  const openEditModal = (client) => {
    setSelectedClient(client);
    setFormData({
      name: client.name || '',
      city: client.city || '',
      state: client.state || 'SC',
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      addToast('Nome do cliente é obrigatório', 'warning');
      return;
    }

    setSaving(true);
    try {
      if (selectedClient) {
        await updateDocument('clients', selectedClient.id, formData);
        await logAuditAction('update', user.uid, user.name, {
          collection: 'clients',
          documentId: selectedClient.id,
          before: selectedClient,
          after: formData,
        });
        addToast('Cliente atualizado com sucesso', 'success');
      } else {
        const id = await createDocument('clients', formData);
        await logAuditAction('create', user.uid, user.name, {
          collection: 'clients',
          documentId: id,
          after: formData,
        });
        addToast('Cliente cadastrado com sucesso', 'success');
      }
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      console.error(err);
      addToast('Erro ao salvar cliente', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete.id) return;
    setSaving(true);
    try {
      const client = clients.find((c) => c.id === confirmDelete.id);
      await deleteDocument('clients', confirmDelete.id);
      await logAuditAction('delete', user.uid, user.name, {
        collection: 'clients',
        documentId: confirmDelete.id,
        before: client,
      });
      addToast('Cliente excluído com sucesso', 'success');
      setConfirmDelete({ open: false, id: null });
      loadData();
    } catch (err) {
      console.error(err);
      addToast('Erro ao excluir cliente', 'error');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      header: 'Nome do Cliente',
      accessorKey: 'name',
      cell: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
          <UserCircle size={16} color="var(--primary-500)" />
          {row.name}
        </div>
      ),
    },
    { header: 'Cidade', accessorKey: 'city', cell: (row) => row.city || '-' },
    { header: 'Estado', accessorKey: 'state', cell: (row) => row.state || '-' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="page-subtitle">Gerencie os clientes cadastrados no sistema</p>
        </div>
        {canCreateEditCadastros(user) && (
          <button className="btn btn-primary" onClick={openCreateModal}>
            <Plus size={18} /> Novo Cliente
          </button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={clients}
        searchPlaceholder="Buscar por nome ou cidade..."
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
        title={selectedClient ? 'Editar Cliente' : 'Novo Cliente'}
      >
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">
              Nome do Cliente <span className="form-required">*</span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="Ex: Mercadão Central"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Cidade</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: Florianópolis"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Estado (UF)</label>
              <select
                className="form-select"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              >
                {ESTADOS_BR.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </div>
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
