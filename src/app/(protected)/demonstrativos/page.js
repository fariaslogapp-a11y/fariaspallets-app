'use client';

import { useState, useEffect, useMemo } from 'react';
import { getDocuments } from '@/lib/firestore';
import { useToast } from '@/contexts/ToastContext';
import DataTable from '@/components/ui/DataTable';
import { ClipboardList, Printer, FileText, Truck } from 'lucide-react';

export default function DemonstrativosPage() {
  const [termos, setTermos] = useState([]);
  const [industries, setIndustries] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

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
      addToast('Erro ao carregar demonstrativos', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Only termos that have a saved return summary (Folha 2)
  const demonstrativos = useMemo(
    () =>
      termos.filter(
        (t) => t.selectedDocsDetails && t.selectedDocsDetails.length > 0
      ),
    [termos]
  );

  const getIndustryName = (id) =>
    industries.find((i) => i.id === id)?.name || '-';

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
      header: 'Distribuidor (CD)',
      accessorKey: 'distribuidor',
      cell: (row) =>
        row.distribuidor ? (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.82rem',
              color: 'var(--warning-600, #b45309)',
              fontWeight: 600,
            }}
          >
            <Truck size={12} /> {row.distribuidor}
          </span>
        ) : (
          '-'
        ),
    },
    {
      header: 'NFs / Termos Devolvidos',
      accessorKey: 'originalDocumentNumbers',
      cell: (row) => {
        const nfDisplay = row.originalDocumentNumbers || row.documentNumber;
        return nfDisplay ? (
          <span
            className="badge badge-primary"
            style={{
              gap: '4px',
              maxWidth: '200px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={nfDisplay}
          >
            <FileText size={12} /> {nfDisplay}
          </span>
        ) : (
          '-'
        );
      },
    },
    {
      header: 'Docs',
      accessorKey: 'selectedDocsDetails',
      cell: (row) => (
        <span className="badge badge-neutral">
          {row.selectedDocsDetails.length} NF(s)
        </span>
      ),
    },
    {
      header: 'Motorista',
      accessorKey: 'motorista',
      cell: (row) => row.motorista || '-',
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
        <span
          className={`badge ${row.status === 'cancelado' ? 'badge-danger' : 'badge-success'}`}
        >
          {row.status === 'cancelado' ? 'Cancelado' : 'Ativo'}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ClipboardList size={28} color="var(--primary-500)" />
            Demonstrativos de Devolução
          </h1>
          <p className="page-subtitle">
            Demonstrativos salvos (Folha 2 dos termos) — imprima novamente quando precisar
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={demonstrativos}
        searchPlaceholder="Buscar por número do termo, indústria, NF, motorista ou placa..."
        loading={loading}
        actions={(row) => (
          <button
            className="btn-edit"
            onClick={() => window.open(`/demonstrativos/imprimir/${row.id}`, '_blank')}
            title="Imprimir Demonstrativo (somente Folha 2)"
            disabled={row.status === 'cancelado'}
            style={{ opacity: row.status === 'cancelado' ? 0.5 : 1 }}
          >
            <Printer size={16} />
          </button>
        )}
      />
    </div>
  );
}
