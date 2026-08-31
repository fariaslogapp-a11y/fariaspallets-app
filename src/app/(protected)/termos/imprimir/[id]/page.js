'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getDocument } from '@/lib/firestore';
import { Printer } from 'lucide-react';

export default function PrintTermoPage() {
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
    return <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'sans-serif' }}>Carregando documento...</div>;
  }

  if (!termo) {
    return <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'sans-serif' }}>Termo não encontrado.</div>;
  }

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = termo.date
    ? termo.date.split('-').reverse().join('/')
    : '';

  const hasSummaryPage = termo.selectedDocsDetails && termo.selectedDocsDetails.length > 0;

  const TermoLayout = ({ via }) => (
    <div className="termo-container">
      <div className="termo-header">
        <div className="logo-container">
          <img src="/logo.png" alt="Farias Log" className="logo-img" onError={(e) => {
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'block';
          }} />
          <div className="logo-fallback" style={{ display: 'none' }}>
            <h2>FARIAS</h2>
            <p>REPRESENTAÇÃO E LOGÍSTICA</p>
          </div>
        </div>
        
        <div className="title-container">
          <h1>TERMO DE RECEBIMENTO DE PALLETS</h1>
          <p>CONTROLE DE EXPEDIÇÃO E RETORNO</p>
        </div>

        <div className="number-container">
          <div className="number-label">TERMO Nº</div>
          <div className="number-value">{String(termo.number).padStart(4, '0')}</div>
          <div className="via-label">{via}</div>
        </div>
      </div>

      <div className="termo-body">
        <div className="statement">
          <p>
            Declaro ter recebido, na data abaixo especificada, a quantidade de pallets abaixo descrita, do padrão PBR, expedidos pela <strong>FARIAS LOG</strong>.
          </p>
        </div>

        <div className="data-grid">
          <div className="data-box highlight">
            <span className="box-label">QUANTIDADE DE PALLETS</span>
            <span className="box-value qty">{termo.quantity}</span>
          </div>
          <div className="data-box">
            <span className="box-label">DATA DA EXPEDIÇÃO</span>
            <span className="box-value">{formattedDate}</span>
          </div>
          <div className="data-box">
            <span className="box-label">LACRE Nº</span>
            <span className="box-value">{termo.lacre || 'N/A'}</span>
          </div>
        </div>

        <div className="status-section">
          <div className="status-option">
            <div className={`checkbox ${termo.devolvidos ? 'checked' : ''}`}>{termo.devolvidos ? '✖' : ''}</div>
            <span>Pallets devolvidos à Farias Log</span>
          </div>
          <div className="status-option">
            <div className={`checkbox ${termo.naoDevolvidos ? 'checked' : ''}`}>{termo.naoDevolvidos ? '✖' : ''}</div>
            <span>Pallets NÃO devolvidos à Farias Log</span>
          </div>
        </div>

        <div className="signatures-section">
          <div className="signature-block">
            <div className="info-row">
              <span className="label">MOTORISTA:</span>
              <span className="value">{termo.motorista || '_____________________________________________'}</span>
            </div>
            <div className="sign-line">
              <div className="line"></div>
              <span className="sign-label">ASSINATURA DO MOTORISTA</span>
            </div>
          </div>

          <div className="signature-block">
            <div className="info-row">
              <span className="label">DISTRIBUIDOR / CLIENTE:</span>
              <span className="value">{industryName || '_____________________________________________'}</span>
            </div>
            <div className="sign-line">
              <div className="line"></div>
              <span className="sign-label">ASSINATURA DO RESPONSÁVEL (DISTRIBUIDOR)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="print-controls no-print">
        <button className="btn btn-primary" onClick={handlePrint}>
          <Printer size={18} /> Imprimir Termo {hasSummaryPage ? '(2 Folhas)' : '(1 Folha)'}
        </button>
        <button className="btn btn-secondary" onClick={() => window.close()}>
          Fechar
        </button>
        {hasSummaryPage && (
          <span style={{ fontSize: '0.85rem', color: 'var(--primary-700)', fontWeight: 600 }}>
            ✓ Folha 1: Termo Pallet (2 Vias) | Folha 2: Resumo de NFs/Termos Devolvidos ({termo.selectedDocsDetails.length} itens)
          </span>
        )}
      </div>

      {/* FOLHA 1: Termo Pallet com 2 Vias */}
      <div className="print-page page-1">
        <div className="page-half">
          <TermoLayout via="1ª VIA - FARIAS LOG" />
        </div>
        
        <div className="cut-line">
          <div className="scissors">✂</div>
        </div>

        <div className="page-half">
          <TermoLayout via="2ª VIA - MOTORISTA / CLIENTE" />
        </div>
      </div>

      {/* FOLHA 2: Resumo de Termos / NFs Devolvidos (Apenas se houver documentos selecionados) */}
      {hasSummaryPage && (
        <div className="print-page page-summary">
          <div className="summary-container">
            {/* Header Folha 2 */}
            <div className="summary-header">
              <div className="logo-container">
                <img src="/logo.png" alt="Farias Log" className="logo-img" onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'block';
                }} />
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
                <strong>DISTRIBUIDOR / INDÚSTRIA:</strong> {industryName || '-'}
              </div>
              <div className="info-col">
                <strong>MOTORISTA:</strong> {termo.motorista || 'Não informado'}
              </div>
              <div className="info-col">
                <strong>Nº LACRE:</strong> {termo.lacre || 'N/A'}
              </div>
              <div className="info-col">
                <strong>TOTAL EXPEDIDO:</strong> <span style={{ color: '#1976d2', fontWeight: 800 }}>{termo.quantity} Pallets</span>
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
                    <th style={{ textAlign: 'center', width: '95px', backgroundColor: '#e3f2fd' }}>Devolvendo Agora</th>
                    <th style={{ textAlign: 'center', width: '85px' }}>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {termo.selectedDocsDetails.map((doc, idx) => {
                    const docEntradaDate = doc.entradaDate
                      ? doc.entradaDate.split('-').reverse().join('/')
                      : '-';
                    const saldoAposDevolucao = Math.max(0, (doc.pendente || 0) - (doc.devolvidoAgora || 0));

                    return (
                      <tr key={idx}>
                        <td style={{ textAlign: 'center', color: '#666', fontWeight: 'bold' }}>{idx + 1}</td>
                        <td>
                          <strong>{doc.documentNumber}</strong>
                        </td>
                        <td style={{ textAlign: 'center' }}>{docEntradaDate}</td>
                        <td style={{ textAlign: 'center' }}>{doc.totalEntrada || doc.pendente}</td>
                        <td style={{ textAlign: 'center', color: '#666' }}>{doc.totalSaida || 0}</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#f4f9fd', color: '#1976d2', fontSize: '13px' }}>
                          {doc.devolvidoAgora || doc.pendente}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600, color: saldoAposDevolucao === 0 ? '#2e7d32' : '#d32f2f' }}>
                          {saldoAposDevolucao === 0 ? '0 (Quitado)' : saldoAposDevolucao}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="table-footer-row">
                    <td colSpan={5} style={{ textAlign: 'right', fontWeight: 'bold', paddingRight: '15px' }}>
                      TOTAL DE PALLETS DEVOLVIDOS NESTE TERMO:
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 900, fontSize: '15px', color: '#1976d2', backgroundColor: '#e3f2fd' }}>
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
                Declaramos para os devidos fins que os termos e/ou notas fiscais acima relacionados foram conferidos e baixados no controle de pallets da <strong>FARIAS LOG</strong>, conforme as quantidades discriminadas na coluna <em>Devolvendo Agora</em>.
              </p>
            </div>

            {/* Signatures for Summary Sheet */}
            <div className="summary-signatures">
              <div className="sig-item">
                <div className="sig-line-bar"></div>
                <span className="sig-name">FARIAS REPRESENTAÇÃO E LOGÍSTICA</span>
                <span className="sig-role">Conferência / Expedição</span>
              </div>

              <div className="sig-item">
                <div className="sig-line-bar"></div>
                <span className="sig-name">{industryName || 'RESPONSÁVEL / DISTRIBUIDOR'}</span>
                <span className="sig-role">Recebido e De Acordo</span>
              </div>
            </div>

            <div className="summary-page-footer">
              <span>Farias Pallets - Sistema de Gestão e Controle Logístico</span>
              <span>Anexo ao Termo Nº {String(termo.number).padStart(4, '0')}</span>
            </div>
          </div>
        </div>
      )}

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
          .no-print {
            display: none !important;
          }
          .sidebar, .page-header, .mobile-menu-btn {
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
          .page-summary {
            page-break-before: always !important;
            break-before: page !important;
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

        /* ===== FOLHA 1 (TERMO PALLET 2 VIAS) ===== */
        .page-half {
          flex: none;
          height: 48%; 
          box-sizing: border-box;
          padding: 10px 15px 0 15px; 
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
        }

        .termo-container {
          border: 1px solid #999;
          border-radius: 4px;
          padding: 10px 15px;
          height: 100%; 
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .termo-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #222;
          padding-bottom: 5px; 
          margin-bottom: 8px; 
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

        .title-container {
          text-align: center;
          flex: 1;
          padding: 0 10px;
        }

        .title-container h1 {
          margin: 0 0 2px 0;
          font-size: 15px;
          font-weight: 800;
          color: #111;
        }

        .title-container p {
          margin: 0;
          font-size: 10px;
          color: #555;
          letter-spacing: 1px;
        }

        .number-container {
          text-align: right;
          width: 100px;
        }

        .number-label {
          font-size: 9px;
          color: #666;
          font-weight: bold;
        }

        .number-value {
          font-size: 18px;
          font-weight: 900;
          color: #b71c1c;
        }
        
        .via-label {
          font-size: 9px;
          font-weight: bold;
          color: #777;
          margin-top: 2px;
        }

        .termo-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .statement {
          text-align: justify;
          font-size: 12px;
          line-height: 1.3;
          color: #333;
          margin-bottom: 8px; 
        }

        .data-grid {
          display: flex;
          gap: 10px;
          margin-bottom: 8px; 
        }

        .data-box {
          flex: 1;
          border: 1px solid #ccc;
          border-radius: 4px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        
        .data-box.highlight {
          border-color: #444;
          background-color: #f9f9f9;
        }

        .box-label {
          background: #eaeaea;
          font-size: 9px;
          font-weight: bold;
          padding: 2px 4px;
          text-align: center;
          color: #444;
          border-bottom: 1px solid #ccc;
        }

        .box-value {
          padding: 4px;
          text-align: center;
          font-size: 13px;
          font-weight: bold;
          color: #111;
        }

        .box-value.qty {
          font-size: 18px;
          color: #1976d2;
        }

        .status-section {
          display: flex;
          justify-content: center;
          gap: 15px; 
          margin-bottom: 10px; 
          background: #fdfdfd;
          padding: 6px;
          border: 1px dashed #ccc;
          border-radius: 4px;
        }

        .status-option {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: bold;
          color: #333;
        }

        .checkbox {
          width: 12px;
          height: 12px;
          border: 2px solid #555;
          border-radius: 2px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          color: #111;
          background: white;
        }

        .signatures-section {
          display: flex;
          flex-direction: column;
          gap: 8px; 
        }

        .signature-block {
          display: flex;
          flex-direction: column;
          gap: 4px; 
        }

        .info-row {
          display: flex;
          align-items: flex-end;
          gap: 10px;
        }

        .info-row .label {
          font-size: 10px;
          font-weight: bold;
          color: #555;
          width: 130px;
        }

        .info-row .value {
          flex: 1;
          font-size: 13px;
          font-weight: bold;
          border-bottom: 1px solid #ddd;
          padding-bottom: 1px;
        }

        .sign-line {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
          margin-top: 4px;
        }

        .sign-line .line {
          width: 45%;
          border-bottom: 1px solid #111;
          margin-bottom: 2px;
        }

        .sign-label {
          font-size: 8px;
          font-weight: bold;
          color: #666;
        }

        .cut-line {
          position: relative;
          width: 100%;
          border-top: 1px dashed #999;
          margin: 8px 0; 
        }

        .scissors {
          position: absolute;
          left: 30px;
          top: -8px;
          background: white;
          padding: 0 10px;
          color: #666;
          font-size: 12px;
        }

        /* ===== FOLHA 2 (RESUMO DE TERMOS/NFS) ===== */
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
