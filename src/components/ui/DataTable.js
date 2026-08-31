'use client';

import { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';

export default function DataTable({
  columns,
  data,
  searchPlaceholder = 'Buscar...',
  actions,
  pageSize = 100,
  loading = false,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    const term = searchTerm.toLowerCase();
    return data.filter((item) =>
      columns.some((col) => {
        const val = col.accessorKey ? item[col.accessorKey] : col.cell ? col.cell(item) : '';
        return String(val || '').toLowerCase().includes(term);
      })
    );
  }, [data, searchTerm, columns]);

  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  return (
    <div className="table-container">
      <div className="table-toolbar">
        <div className="table-search">
          <Search size={16} />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        <div style={{ marginLeft: 'auto', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Total: <strong>{filteredData.length}</strong> registro(s)
        </div>
      </div>

      {loading ? (
        <div className="loading-inline">
          <div className="loading-spinner" />
        </div>
      ) : paginatedData.length === 0 ? (
        <div className="table-empty">
          <Inbox size={48} />
          <p>Nenhum registro encontrado</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} style={{ width: col.width || 'auto' }}>
                  {col.header}
                </th>
              ))}
              {actions && <th style={{ width: '100px', textAlign: 'right' }}>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, rowIdx) => (
              <tr key={row.id || rowIdx}>
                {columns.map((col, colIdx) => (
                  <td key={colIdx}>
                    {col.cell ? col.cell(row) : row[col.accessorKey]}
                  </td>
                ))}
                {actions && (
                  <td style={{ textAlign: 'right' }}>
                    <div className="table-actions" style={{ justifyContent: 'flex-end' }}>
                      {actions(row)}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {totalPages > 1 && (
        <div className="table-footer">
          <span>
            Página {currentPage} de {totalPages}
          </span>
          <div className="pagination">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
