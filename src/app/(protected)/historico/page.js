'use client';

import { useState, useEffect } from 'react';
import { getAuditLogs } from '@/lib/audit';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin } from '@/lib/permissions';
import { useRouter } from 'next/navigation';
import DataTable from '@/components/ui/DataTable';
import { History, ShieldAlert } from 'lucide-react';

export default function HistoryPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && !isAdmin(user)) {
      router.replace('/dashboard');
      return;
    }

    async function loadLogs() {
      try {
        const data = await getAuditLogs();
        setLogs(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadLogs();
  }, [user, router]);

  if (!isAdmin(user)) {
    return (
      <div className="empty-state">
        <ShieldAlert size={48} color="var(--danger-500)" />
        <h3>Acesso Restrito</h3>
        <p>Apenas administradores podem acessar o histórico de auditoria.</p>
      </div>
    );
  }

  const columns = [
    {
      header: 'Data / Hora',
      accessorKey: 'timestamp',
      cell: (row) => {
        if (!row.timestamp) return '-';
        const d = row.timestamp.toDate ? row.timestamp.toDate() : new Date(row.timestamp);
        return d.toLocaleString('pt-BR');
      },
    },
    {
      header: 'Usuário Responsável',
      accessorKey: 'userName',
      cell: (row) => row.userName || 'Sistema',
    },
    {
      header: 'Ação',
      accessorKey: 'action',
      cell: (row) => {
        const badgeMap = {
          create: { class: 'badge-success', label: 'Inclusão' },
          update: { class: 'badge-warning', label: 'Alteração' },
          delete: { class: 'badge-danger', label: 'Exclusão' },
        };
        const badge = badgeMap[row.action] || { class: 'badge-neutral', label: row.action };
        return <span className={`badge ${badge.class}`}>{badge.label}</span>;
      },
    },
    {
      header: 'Coleção / Módulo',
      accessorKey: 'details',
      cell: (row) => {
        const map = {
          movements: 'Movimentação de Pallets',
          industries: 'Indústrias',
          clients: 'Clientes',
          drivers: 'Motoristas',
          vehicles: 'Veículos',
          users: 'Usuários',
        };
        return map[row.details?.collection] || row.details?.collection || '-';
      },
    },
    {
      header: 'Detalhes do Registro',
      accessorKey: 'details',
      cell: (row) => {
        const d = row.details;
        if (!d) return '-';
        if (d.after?.quantity) {
          return `${d.after?.type === 'entrada' ? 'Entrada' : 'Saída'} de ${d.after?.quantity} pallets (${d.after?.category})`;
        }
        if (d.after?.name) return `Nome: ${d.after?.name}`;
        if (d.after?.plate) return `Placa: ${d.after?.plate}`;
        if (d.before?.name) return `Excluído: ${d.before?.name}`;
        if (d.before?.plate) return `Excluído: ${d.before?.plate}`;
        return `Doc ID: ${d.documentId || '-'}`;
      },
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <History size={28} color="var(--primary-500)" />
            Histórico de Auditoria
          </h1>
          <p className="page-subtitle">
            Rastreabilidade total de inclusões, alterações e exclusões de dados
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={logs}
        searchPlaceholder="Buscar por usuário, ação ou detalhe..."
        loading={loading}
      />
    </div>
  );
}
