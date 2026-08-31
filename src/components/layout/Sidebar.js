'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin } from '@/lib/permissions';
import {
  LayoutDashboard,
  ArrowDownToLine,
  ArrowUpFromLine,
  Search,
  History,
  Users,
  Factory,
  UserCircle,
  Sun,
  Moon,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Package,
  FileText,
} from 'lucide-react';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Entrada de Pallets', href: '/entrada', icon: ArrowDownToLine },
  { label: 'Saída de Pallets', href: '/saida', icon: ArrowUpFromLine },
  { label: 'Consultas', href: '/consultas', icon: Search },
  { label: 'Termo Pallet', href: '/termos', icon: FileText },
];

const cadastroItems = [
  { label: 'Indústrias', href: '/cadastros/industrias', icon: Factory },
  { label: 'Clientes', href: '/cadastros/clientes', icon: UserCircle },
];

const adminItems = [
  { label: 'Histórico', href: '/historico', icon: History },
  { label: 'Usuários', href: '/usuarios', icon: Users },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState('light');
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  useEffect(() => {
    const saved = localStorage.getItem('theme') || 'light';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  const handleNav = (href) => {
    router.push(href);
    setMobileOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const isActive = (href) => pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'));

  return (
    <>
      {/* Mobile menu button */}
      <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)}>
        <Menu size={22} />
      </button>

      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${mobileOpen ? 'visible' : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        {/* Toggle button */}
        <button
          className="sidebar-toggle"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Mobile close */}
        {mobileOpen && (
          <button
            style={{ position: 'absolute', top: 20, right: 16, color: '#fff', zIndex: 10 }}
            onClick={() => setMobileOpen(false)}
          >
            <X size={20} />
          </button>
        )}

        {/* Header */}
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <Package size={20} color="#fff" />
          </div>
          <div className="sidebar-brand">
            <h1>Farias Pallets</h1>
            <span>Controle de Pallets</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <div className="nav-section-title">Menu Principal</div>
          {navItems.map((item) => (
            <div
              key={item.href}
              className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
              onClick={() => handleNav(item.href)}
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={20} />
              <span className="nav-label">{item.label}</span>
            </div>
          ))}

          <div className="nav-section-title">Cadastros</div>
          {cadastroItems.map((item) => (
            <div
              key={item.href}
              className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
              onClick={() => handleNav(item.href)}
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={20} />
              <span className="nav-label">{item.label}</span>
            </div>
          ))}

          {isAdmin(user) && (
            <>
              <div className="nav-section-title">Administração</div>
              {adminItems.map((item) => (
                <div
                  key={item.href}
                  className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
                  onClick={() => handleNav(item.href)}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon size={20} />
                  <span className="nav-label">{item.label}</span>
                </div>
              ))}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <button className="theme-toggle" onClick={toggleTheme} title={theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}>
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            <span className="nav-label">{theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}</span>
          </button>

          <div className="user-info">
            <div className="user-avatar">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="user-info-text">
              <div className="user-name">{user?.name || 'Usuário'}</div>
              <div className="user-role">{user?.role === 'admin' ? 'Administrador' : 'Operador'}</div>
            </div>
          </div>

          <button className="logout-btn" onClick={handleLogout}>
            <LogOut size={18} />
            <span className="nav-label">Sair</span>
          </button>
        </div>
      </aside>
    </>
  );
}
