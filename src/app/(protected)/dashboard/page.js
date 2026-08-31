'use client';

import { useState, useEffect } from 'react';
import { getDashboardStats, getMonthlyData, getBalancesByIndustry } from '@/lib/movements';
import { getDocuments, subscribeToCollection } from '@/lib/firestore';
import { Package, ArrowDownToLine, ArrowUpFromLine, Repeat, Users } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [monthlyData, setMonthlyData] = useState(null);
  const [industryBalances, setIndustryBalances] = useState([]);
  const [industries, setIndustries] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [statsData, monthly, balances, inds] = await Promise.all([
        getDashboardStats(),
        getMonthlyData(),
        getBalancesByIndustry(),
        getDocuments('industries'),
      ]);
      setStats(statsData);
      setMonthlyData(monthly);
      setIndustryBalances(balances);
      setIndustries(inds);
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Subscribe to changes safely without triggering uncaught Cloud Firestore console errors
    const unsub = subscribeToCollection('movements', () => {
      loadData();
    });
    return () => unsub();
  }, []);

  const getIndustryName = (id) => {
    if (id === 'sem-industria') return 'Sem Indústria';
    return industries.find((i) => i.id === id)?.name || id;
  };

  const isDark = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? '#a0a0b8' : '#525252';

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: textColor, padding: 16, usePointStyle: true, pointStyleWidth: 10, font: { size: 12 } },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: textColor, font: { size: 11 } } },
      y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 } }, beginAtZero: true },
    },
  };

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Visão geral do controle de pallets</p>
          </div>
        </div>
        <div className="stats-grid">
          {[1, 2, 3, 4, 5].map((i) => (
            <div className="stat-card" key={i}>
              <div className="skeleton" style={{ width: 48, height: 48, borderRadius: 10 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton skeleton-line" style={{ width: '60%' }} />
                <div className="skeleton skeleton-line" style={{ width: '40%', height: 28 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Visão geral do controle de pallets</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card animate-in animate-in-delay-1">
          <div className="stat-icon orange"><Package size={24} /></div>
          <div className="stat-info">
            <div className="stat-label">Pallets em Estoque</div>
            <div className="stat-value">{stats?.saldoGeral || 0}</div>
          </div>
        </div>

        <div className="stat-card animate-in animate-in-delay-2">
          <div className="stat-icon blue"><Repeat size={24} /></div>
          <div className="stat-info">
            <div className="stat-label">TRANSFERÊNCIAS</div>
            <div className="stat-value">{stats?.saldoTransferencias || 0}</div>
          </div>
        </div>

        <div className="stat-card animate-in animate-in-delay-3">
          <div className="stat-icon green"><Users size={24} /></div>
          <div className="stat-info">
            <div className="stat-label">CLIENTES</div>
            <div className="stat-value">{stats?.saldoClientes || 0}</div>
          </div>
        </div>

        <div className="stat-card animate-in animate-in-delay-4">
          <div className="stat-icon yellow"><ArrowDownToLine size={24} /></div>
          <div className="stat-info">
            <div className="stat-label">Entradas no Mês</div>
            <div className="stat-value">{stats?.entradasMes || 0}</div>
          </div>
        </div>

        <div className="stat-card animate-in animate-in-delay-5">
          <div className="stat-icon red"><ArrowUpFromLine size={24} /></div>
          <div className="stat-info">
            <div className="stat-label">Saídas no Mês</div>
            <div className="stat-value">{stats?.saidasMes || 0}</div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-grid">
        <div className="chart-card animate-in">
          <div className="chart-card-header">
            <h3 className="chart-card-title">Entradas x Saídas (Últimos 12 meses)</h3>
          </div>
          <div className="chart-wrapper">
            {monthlyData && (
              <Bar
                data={{
                  labels: monthlyData.labels,
                  datasets: [
                    {
                      label: 'Entradas',
                      data: monthlyData.entradas,
                      backgroundColor: 'rgba(34, 197, 94, 0.7)',
                      borderRadius: 4,
                      borderSkipped: false,
                    },
                    {
                      label: 'Saídas',
                      data: monthlyData.saidas,
                      backgroundColor: 'rgba(239, 68, 68, 0.7)',
                      borderRadius: 4,
                      borderSkipped: false,
                    },
                  ],
                }}
                options={chartOptions}
              />
            )}
          </div>
        </div>

        <div className="chart-card animate-in">
          <div className="chart-card-header">
            <h3 className="chart-card-title">Saldo por Indústria</h3>
          </div>
          <div className="chart-wrapper">
            {industryBalances.length > 0 && (
              <Bar
                data={{
                  labels: industryBalances.map((b) => getIndustryName(b.industryId)),
                  datasets: [
                    {
                      label: 'Saldo',
                      data: industryBalances.map((b) => b.saldo),
                      backgroundColor: industryBalances.map((b) =>
                        b.saldo >= 0 ? 'rgba(249, 115, 22, 0.7)' : 'rgba(239, 68, 68, 0.7)'
                      ),
                      borderRadius: 4,
                      borderSkipped: false,
                    },
                  ],
                }}
                options={{
                  ...chartOptions,
                  indexAxis: 'y',
                  plugins: { ...chartOptions.plugins, legend: { display: false } },
                }}
              />
            )}
            {industryBalances.length === 0 && (
              <div className="empty-state">
                <p>Nenhuma movimentação registrada</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
