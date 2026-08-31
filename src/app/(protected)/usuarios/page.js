'use client';

import { useState, useEffect } from 'react';
import { getDocuments, updateDocument } from '@/lib/firestore';
import { logAuditAction } from '@/lib/audit';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { isAdmin } from '@/lib/permissions';
import { useRouter } from 'next/navigation';
import DataTable from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';
import { Users, Plus, Edit, ShieldAlert, CheckCircle, XCircle, UserCheck, Key, ShieldCheck } from 'lucide-react';

export default function UsersPage() {
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    role: 'operator',
  });

  const { user, registerUser } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();

  const loadData = async () => {
    try {
      const data = await getDocuments('users', [], 'name', 'asc');
      setUsersList(data);
    } catch (err) {
      console.error(err);
      addToast('Erro ao carregar usuários', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && !isAdmin(user)) {
      router.replace('/dashboard');
      return;
    }
    loadData();
  }, [user, router]);

  if (!isAdmin(user)) {
    return (
      <div className="empty-state">
        <ShieldAlert size={48} color="var(--danger-500)" />
        <h3>Acesso Restrito</h3>
        <p>Apenas administradores podem acessar o controle de usuários.</p>
      </div>
    );
  }

  const openCreateModal = () => {
    setSelectedUser(null);
    setFormData({ name: '', username: '', password: '', role: 'operator' });
    setIsModalOpen(true);
  };

  const openEditModal = (u) => {
    setSelectedUser(u);
    setFormData({
      name: u.name || '',
      username: u.username || u.name || '',
      password: '', // Senha vazia significa não alterar
      role: u.role || 'operator',
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      addToast('Nome é obrigatório', 'warning');
      return;
    }

    setSaving(true);
    try {
      if (selectedUser) {
        // Atualizar usuário existente
        const updatePayload = {
          name: formData.name.trim(),
          role: formData.role,
        };

        // Se digitou uma nova senha, atualiza
        if (formData.password.trim()) {
          if (formData.password.length < 3) {
            addToast('A nova senha deve ter no mínimo 3 caracteres', 'warning');
            setSaving(false);
            return;
          }
          updatePayload.password = formData.password.trim();
        }

        await updateDocument('users', selectedUser.id, updatePayload);
        await logAuditAction('update', user.uid, user.name, {
          collection: 'users',
          documentId: selectedUser.id,
          before: selectedUser,
          after: updatePayload,
        });
        addToast('Usuário atualizado com sucesso!', 'success');
      } else {
        // Criar novo usuário
        const cleanUsername = formData.username.trim().toLowerCase();
        if (!cleanUsername) {
          addToast('Nome de usuário / Login é obrigatório', 'warning');
          setSaving(false);
          return;
        }

        if (!formData.password || formData.password.length < 3) {
          addToast('A senha deve ter no mínimo 3 caracteres', 'warning');
          setSaving(false);
          return;
        }

        await registerUser(cleanUsername, formData.password.trim(), {
          name: formData.name.trim(),
          role: formData.role,
        });

        await logAuditAction('create', user.uid, user.name, {
          collection: 'users',
          documentId: cleanUsername,
          after: { name: formData.name, username: cleanUsername, role: formData.role },
        });

        addToast(`Usuário "${cleanUsername}" cadastrado com sucesso!`, 'success');
      }
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      console.error(err);
      addToast(err.message || 'Erro ao salvar usuário', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleUserStatus = async (u) => {
    try {
      const nextState = !u.active;
      await updateDocument('users', u.id, { active: nextState });
      await logAuditAction('update', user.uid, user.name, {
        collection: 'users',
        documentId: u.id,
        before: { active: u.active },
        after: { active: nextState },
      });
      addToast(`Status do usuário alterado para ${nextState ? 'Ativo' : 'Inativo'}`, 'info');
      loadData();
    } catch (err) {
      console.error(err);
      addToast('Erro ao alterar status do usuário', 'error');
    }
  };

  const columns = [
    {
      header: 'Nome do Operador',
      accessorKey: 'name',
      cell: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
          <UserCheck size={16} color="var(--primary-500)" />
          {row.name}
        </div>
      ),
    },
    {
      header: 'Login / Usuário',
      accessorKey: 'username',
      cell: (row) => (
        <span className="badge badge-neutral" style={{ fontWeight: 'bold' }}>
          {row.username || row.email || row.name}
        </span>
      ),
    },
    {
      header: 'Perfil / Permissão',
      accessorKey: 'role',
      cell: (row) => (
        <span className={`badge ${row.role === 'admin' ? 'badge-primary' : 'badge-neutral'}`}>
          {row.role === 'admin' ? 'Administrador' : 'Operador'}
        </span>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'active',
      cell: (row) => (
        <span className={`badge ${row.active !== false ? 'badge-success' : 'badge-danger'}`}>
          {row.active !== false ? (
            <>
              <CheckCircle size={12} /> Ativo
            </>
          ) : (
            <>
              <XCircle size={12} /> Inativo
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
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={28} color="var(--primary-500)" />
            Controle de Usuários
          </h1>
          <p className="page-subtitle">Gerencie os acessos, logins e senhas dos operadores</p>
        </div>
        <button className="btn btn-primary" onClick={openCreateModal}>
          <Plus size={18} /> Novo Operador / Usuário
        </button>
      </div>

      {/* Card informativo sobre o Administrador Geral */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '14px 18px', borderRadius: '10px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', background: 'var(--primary-500)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <ShieldCheck size={24} />
          </div>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>Administrador Geral do Sistema</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Login: <strong>administrador</strong> (Acesso mestre permanente com senha configurada)</div>
          </div>
        </div>
        <span className="badge badge-primary">Super Admin</span>
      </div>

      <DataTable
        columns={columns}
        data={usersList}
        searchPlaceholder="Buscar por nome ou login do usuário..."
        loading={loading}
        actions={(row) => (
          <>
            <button className="btn-edit" onClick={() => openEditModal(row)} title="Editar / Trocar Senha">
              <Edit size={16} />
            </button>
            <button
              className="btn-edit"
              onClick={() => toggleUserStatus(row)}
              title={row.active !== false ? 'Desativar Usuário' : 'Ativar Usuário'}
            >
              {row.active !== false ? <XCircle size={16} color="var(--danger-500)" /> : <CheckCircle size={16} color="var(--success-500)" />}
            </button>
          </>
        )}
      />

      {/* Modal Criar / Editar Usuário */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedUser ? `Editar Usuário: ${selectedUser.username || selectedUser.name}` : 'Cadastrar Novo Usuário / Operador'}
      >
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">
              Nome Completo do Operador <span className="form-required">*</span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="Ex: Carlos Silva"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Nome de Usuário / Login <span className="form-required">*</span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="Ex: carlossilva ou operador1"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s+/g, '') })}
              disabled={!!selectedUser}
              required
            />
            <p className="form-hint">O login que o operador usará para entrar no sistema (letras e números, sem espaços).</p>
          </div>

          <div className="form-group">
            <label className="form-label">
              {selectedUser ? 'Nova Senha (deixe em branco para manter a atual)' : 'Senha de Acesso'} <span className={selectedUser ? '' : 'form-required'}>*</span>
            </label>
            <input
              type="password"
              className="form-input"
              placeholder={selectedUser ? 'Digite apenas se desejar trocar a senha' : 'Mínimo 3 caracteres'}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required={!selectedUser}
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Perfil de Acesso <span className="form-required">*</span>
            </label>
            <select
              className="form-select"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              required
            >
              <option value="operator">Operador (Entradas, Saídas, Termos e Consultas)</option>
              <option value="admin">Administrador (Acesso Total + Gestão de Usuários)</option>
            </select>
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
              {saving ? 'Salvando...' : selectedUser ? 'Atualizar Usuário' : 'Cadastrar Usuário'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
