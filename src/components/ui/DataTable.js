'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
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

  const tableScrollRef = useRef(null);
  const topScrollRef = useRef(null);
  const spacerRef = useRef(null);

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

  // Show/hide the mirrored top scrollbar by measuring the table (DOM writes only — no state)
  useEffect(() => {
    const hideTopBar = () => {
      if (topScrollRef.current) topScrollRef.current.style.display = 'none';
    };

    if (loading || filteredData.length === 0) {
      hideTopBar();
      return;
    }

    const el = tableScrollRef.current;
    if (!el) return;

    const measure = () => {
      const top = topScrollRef.current;
      const spacer = spacerRef.current;
      if (!top || !spacer) return;
      const overflow = el.scrollWidth > el.clientWidth + 1;
      top.style.display = overflow ? 'block' : 'none';
      spacer.style.width = `${el.scrollWidth}px`;
      top.scrollLeft = el.scrollLeft;
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    const table = el.querySelector('table');
    if (table) observer.observe(table);
    window.addEventListener('resize', measure);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [loading, filteredData]);

  // Keep top and bottom scrollbars aligned (tolerance guard avoids scroll loops)
  const syncFromTop = () => {
    const source = topScrollRef.current;
    const target = tableScrollRef.current;
    if (!source || !target) return;
    if (Math.abs(source.scrollLeft - target.scrollLeft) < 1) return;
    target.scrollLeft = source.scrollLeft;
  };

  const syncFromBottom = () => {
    const source = tableScrollRef.current;
    const target = topScrollRef.current;
    if (!source || !target) return;
    if (Math.abs(source.scrollLeft - target.scrollLeft) < 1) return;
    target.scrollLeft = source.scrollLeft;
  };

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

      {/* Mirrored top scrollbar — hidden via DOM until horizontal overflow is measured */}
      <div
        className="table-scrollbar-top"
        ref={topScrollRef}
        onScroll={syncFromTop}
        aria-hidden="true"
        style={{ display: 'none' }}
      >
        <div className="table-scrollbar-spacer" ref={spacerRef} />
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
        <div
          className="table-scroll"
          ref={tableScrollRef}
          onScroll={syncFromBottom}
        >
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
        </div>
      )}

      {totalPages > 1 && (
        <div className="table-footer">
          <span>
            Página {currentPage} de {totalPages}
          </span>
          <div className="pagination">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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
