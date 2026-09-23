'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getDocument } from '@/lib/firestore';
import { Printer } from 'lucide-react';

export default function PrintDemonstrativoPage() {
  const { id } = useParams();
  const [termo, setTermo] = useState(null);
  const [industryName, setIndustryName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const termoData = await getDocument('termos', id);
        if (termoData) {
          setTermo(termoData);
          if (termoData.industryId) {
            const ind = await getDocument('industries', termoData.industryId);
            setIndustryName(ind?.name || '');
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        Carregando documento...
      </div>
    );
  }

  if (!termo) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        Demonstrativo não encontrado.
      </div>
    );
  }

  const hasSummaryPage = termo.selectedDocsDetails && termo.selectedDocsDetails.length > 0;

  if (!hasSummaryPage) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        Este termo não possui Demonstrativo de Devolução (sem NFs/Termos vinculados).
        <br />
        <br />
        <button className="btn btn-secondary" onClick={() => window.close()}>
          Fechar
        </button>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = termo.date ? termo.date.split('-').reverse().join('/') : '';

  return (
    <>
      <div className="print-controls no-print">
        <button className="btn btn-primary" onClick={handlePrint}>
          <Printer size={18} /> Imprimir Demonstrativo (1 Folha)
        </button>
        <button className="btn btn-secondary" onClick={() => window.close()}>
          Fechar
        </button>
        <span style={{ fontSize: '0.85rem', color: 'var(--primary-700)', fontWeight: 600 }}>
          Demonstrativo de Devolução — Termo Nº {String(termo.number).padStart(4, '0')} (
          {termo.selectedDocsDetails.length} itens)
        </span>
      </div>

      {/* FOLHA: Demonstrativo de Devolução de Pallets */}
      <div className="print-page page-summary">
        <div className="summary-container">
          <div className="summary-header">
            <div className="logo-container">
              <img
                src="/logo.png"
                alt="Farias Log"
                className="logo-img"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'block';
                }}
              />
              <div className="logo-fallback" style={{ display: 'none' }}>
                <h2>FARIAS</h2>
                <p>REPRESENTAÇÃO E LOGÍSTICA</p>
              </div>
            </div>

            <div className="summary-title-block">
              <h2>DEMONSTRATIVO DE DEVOLUÇÃO DE PALLETS</h2>
              <p>RELAÇÃO DETALHADA DE NOTAS FISCAIS / TERMOS ATENDIDOS</p>
            </div>

            <div className="summary-badge-block">
              <div className="badge-item">
                <span className="badge-lbl">TERMO Nº</span>
                <span className="badge-val">{String(termo.number).padStart(4, '0')}</span>
              </div>
              <div className="badge-item">
                <span className="badge-lbl">DATA</span>
                <span className="badge-sub">{formattedDate}</span>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="summary-info-card">
            <div className="info-col">
              <strong>DISTRIBUIDOR / INDÚSTRIA:</strong>{' '}
              {termo.distribuidor || industryName || '-'}
            </div>
            <div className="info-col">
              <strong>MOTORISTA:</strong> {termo.motorista || 'Não informado'}
            </div>
            <div className="info-col">
              <strong>Nº LACRE:</strong> {termo.lacre || 'N/A'}
            </div>
            <div className="info-col">
              <strong>PLACA:</strong> {termo.placa || 'N/A'}
            </div>
            <div className="info-col">
              <strong>TOTAL EXPEDIDO:</strong>{' '}
              <span style={{ color: '#1976d2', fontWeight: 800 }}>
                {termo.quantity} Pallets
              </span>
            </div>
          </div>

          {/* Table of Returned Documents */}
          <div className="summary-table-container">
            <table className="summary-table">
              <thead>
                <tr>
                  <th style={{ width: '30px', textAlign: 'center' }}>#</th>
                  <th style={{ textAlign: 'left' }}>Nº NF / Termo Devolvido</th>
                  <th style={{ textAlign: 'center', width: '85px' }}>Data Entrada</th>
                  <th style={{ textAlign: 'center', width: '75px' }}>Qtd. Entrada</th>
                  <th style={{ textAlign: 'center', width: '75px' }}>Já Devolvido</th>
                  <th
                    style={{
                      textAlign: 'center',
                      width: '95px',
                      backgroundColor: '#e3f2fd',
                    }}
                  >
                    Devolvendo Agora
                  </th>
                  <th style={{ textAlign: 'center', width: '85px' }}>Saldo</th>
                </tr>
              </thead>
              <tbody>
                {termo.selectedDocsDetails.map((doc, idx) => {
                  const docEntradaDate = doc.entradaDate
                    ? doc.entradaDate.split('-').reverse().join('/')
                    : '-';
                  const saldoAposDevolucao = Math.max(
                    0,
                    (doc.pendente || 0) - (doc.devolvidoAgora || 0)
                  );

                  return (
                    <tr key={idx}>
                      <td style={{ textAlign: 'center', color: '#666', fontWeight: 'bold' }}>
                        {idx + 1}
                      </td>
                      <td>
                        <strong>{doc.documentNumber}</strong>
                      </td>
                      <td style={{ textAlign: 'center' }}>{docEntradaDate}</td>
                      <td style={{ textAlign: 'center' }}>
                        {doc.totalEntrada || doc.pendente}
                      </td>
                      <td style={{ textAlign: 'center', color: '#666' }}>
                        {doc.totalSaida || 0}
                      </td>
                      <td
                        style={{
                          textAlign: 'center',
                          fontWeight: 'bold',
                          backgroundColor: '#f4f9fd',
                          color: '#1976d2',
                          fontSize: '13px',
                        }}
                      >
                        {doc.devolvidoAgora || doc.pendente}
                      </td>
                      <td
                        style={{
                          textAlign: 'center',
                          fontWeight: 600,
                          color: saldoAposDevolucao === 0 ? '#2e7d32' : '#d32f2f',
                        }}
                      >
                        {saldoAposDevolucao === 0 ? '0 (Quitado)' : saldoAposDevolucao}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="table-footer-row">
                  <td
                    colSpan={5}
                    style={{
                      textAlign: 'right',
                      fontWeight: 'bold',
                      paddingRight: '15px',
                    }}
                  >
                    TOTAL DE PALLETS DEVOLVIDOS NESTE TERMO:
                  </td>
                  <td
                    style={{
                      textAlign: 'center',
                      fontWeight: 900,
                      fontSize: '15px',
                      color: '#1976d2',
                      backgroundColor: '#e3f2fd',
                    }}
                  >
                    {termo.quantity}
                  </td>
                  <td style={{ textAlign: 'center', fontSize: '11px', color: '#666' }}>
                    {termo.selectedDocsDetails.length} doc(s)
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Declaration Text */}
          <div className="summary-declaration">
            <p>
              Declaramos para os devidos fins que os termos e/ou notas fiscais acima
              relacionados foram conferidos e baixados no controle de pallets da{' '}
              <strong>FARIAS LOG</strong>, conforme as quantidades discriminadas na coluna{' '}
              <em>Devolvendo Agora</em>.
            </p>
          </div>

          {/* Signatures */}
          <div className="summary-signatures">
            <div className="sig-item">
              <div className="sig-line-bar"></div>
              <span className="sig-name">FARIAS REPRESENTAÇÃO E LOGÍSTICA</span>
              <span className="sig-role">Conferência / Expedição</span>
            </div>

            <div className="sig-item">
              <div className="sig-line-bar"></div>
              <span className="sig-name">
                {termo.distribuidor || industryName || 'RESPONSÁVEL / DISTRIBUIDOR'}
              </span>
              <span className="sig-role">Recebido e De Acordo</span>
            </div>
          </div>

          <div className="summary-page-footer">
            <span>Farias Pallets - Sistema de Gestão e Controle Logístico</span>
            <span>Anexo ao Termo Nº {String(termo.number).padStart(4, '0')}</span>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          body {
            background: white;
            margin: 0;
            padding: 0;
          }
          .no-print,
          .sidebar,
          .page-header,
          .mobile-menu-btn {
            display: none !important;
          }
          .app-layout {
            padding: 0 !important;
            margin: 0 !important;
          }
          .main-content {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }
          .print-page {
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: 250mm !important;
            max-height: 250mm !important;
            overflow: hidden !important;
            page-break-inside: avoid !important;
          }
        }

        .print-controls {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 15px 20px;
          background: #f5f5f5;
          border-bottom: 1px solid #ddd;
          margin-bottom: 20px;
        }

        .print-page {
          background: white;
          width: 190mm;
          height: 250mm;
          margin: 0 auto 30px auto;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
          color: #222;
          font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
        }

        .summary-container {
          border: 1px solid #999;
          border-radius: 4px;
          padding: 14px 14px;
          height: 100%;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .summary-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #222;
          padding-bottom: 8px;
          margin-bottom: 10px;
        }

        .logo-container {
          width: 220px;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          overflow: visible;
        }

        .logo-img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          transform: scale(1.6);
          transform-origin: left center;
        }

        .logo-fallback h2 {
          margin: 0;
          font-size: 16px;
          font-style: italic;
          color: #333;
          letter-spacing: -1px;
        }

        .logo-fallback p {
          margin: 0;
          font-size: 6px;
          font-weight: bold;
          color: #666;
        }

        .summary-title-block {
          text-align: center;
          flex: 1;
          padding: 0 10px;
        }

        .summary-title-block h2 {
          margin: 0 0 3px 0;
          font-size: 15px;
          font-weight: 900;
          color: #111;
          letter-spacing: 0.5px;
        }

        .summary-title-block p {
          margin: 0;
          font-size: 9px;
          color: #555;
          font-weight: 600;
        }

        .summary-badge-block {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
        }

        .badge-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .badge-lbl {
          font-size: 8px;
          font-weight: bold;
          color: #777;
        }

        .badge-val {
          font-size: 16px;
          font-weight: 900;
          color: #b71c1c;
        }

        .badge-sub {
          font-size: 10px;
          font-weight: bold;
          color: #222;
        }

        .summary-info-card {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
          background: #fbfbfb;
          border: 1px solid #ddd;
          padding: 6px 10px;
          border-radius: 4px;
          font-size: 10px;
          margin-bottom: 10px;
        }

        .summary-table-container {
          flex: 1;
          margin-bottom: 10px;
          overflow: visible;
        }

        .summary-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10px;
        }

        .summary-table th {
          background-color: #263238;
          color: white;
          padding: 4px 4px;
          font-weight: 700;
          font-size: 9px;
          border: 1px solid #263238;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .summary-table td {
          padding: 4px 4px;
          border: 1px solid #ddd;
          font-size: 10px;
          white-space: nowrap;
        }

        .summary-table tbody tr:nth-child(even) {
          background-color: #fafafa;
        }

        .table-footer-row td {
          background-color: #eceff1;
          border-top: 2px solid #263238;
          padding: 5px 6px;
        }

        .summary-declaration {
          background-color: #f5f5f5;
          padding: 8px 12px;
          border-left: 3px solid #1976d2;
          font-size: 10px;
          line-height: 1.4;
          color: #444;
          margin-bottom: 16px;
        }

        .summary-declaration p {
          margin: 0;
        }

        .summary-signatures {
          display: flex;
          justify-content: space-around;
          margin-bottom: 10px;
          padding: 0 20px;
        }

        .sig-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 220px;
        }

        .sig-line-bar {
          width: 100%;
          border-bottom: 1px solid #111;
          margin-bottom: 4px;
        }

        .sig-name {
          font-size: 10px;
          font-weight: bold;
          color: #111;
          text-align: center;
        }

        .sig-role {
          font-size: 8px;
          color: #666;
        }

        .summary-page-footer {
          display: flex;
          justify-content: space-between;
          font-size: 8px;
          color: #888;
          border-top: 1px solid #eee;
          padding-top: 5px;
        }
      `}</style>
    </>
  );
}
