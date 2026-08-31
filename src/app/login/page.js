'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { User, Lock, LogIn, Eye, EyeOff, Package, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loadingSubmit, setLoadingSubmit] = useState(false);

  const { user, login } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoadingSubmit(true);

    try {
      await login(username, password);
      router.replace('/dashboard');
    } catch (err) {
      console.error('Erro de login:', err);
      setError(err?.message || 'Erro ao realizar login.');
    } finally {
      setLoadingSubmit(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        {/* Header / Logo */}
        <div className="login-header">
          <div className="login-logo-badge">
            <Package size={28} color="#fff" />
          </div>
          <h1 className="login-brand">Farias Pallets</h1>
          <p className="login-sub">Sistema de Gestão e Controle de Pallets</p>
        </div>

        {error && (
          <div className="login-error">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-input-group">
            <label className="login-label">Usuário</label>
            <div className="input-with-icon">
              <User size={18} className="field-icon" />
              <input
                type="text"
                className="login-input"
                placeholder="Ex: administrador"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                required
              />
            </div>
          </div>

          <div className="login-input-group">
            <label className="login-label">Senha</label>
            <div className="input-with-icon">
              <Lock size={18} className="field-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                className="login-input"
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="btn-toggle-pw"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn-login-submit"
            disabled={loadingSubmit}
          >
            <LogIn size={18} />
            {loadingSubmit ? 'Verificando...' : 'Entrar no Sistema'}
          </button>
        </form>

        <div className="login-footer">
          <div className="admin-hint">
            <ShieldCheck size={14} />
            <span>Acesso seguro Farias Representação e Logística</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .login-container {
          min-height: 100vh;
          width: 100vw;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          padding: 20px;
          font-family: 'Inter', sans-serif;
        }

        .login-card {
          width: 100%;
          max-width: 420px;
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
          padding: 36px 32px;
          color: #1e293b;
        }

        .login-header {
          text-align: center;
          margin-bottom: 24px;
        }

        .login-logo-badge {
          width: 56px;
          height: 56px;
          background: linear-gradient(135deg, #1976d2 0%, #0d47a1 100%);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 12px auto;
          box-shadow: 0 4px 12px rgba(25, 118, 210, 0.4);
        }

        .login-brand {
          font-size: 22px;
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 4px 0;
          letter-spacing: -0.5px;
        }

        .login-sub {
          font-size: 13px;
          color: #64748b;
          margin: 0;
        }

        .login-error {
          background: #fee2e2;
          border-left: 4px solid #ef4444;
          color: #991b1b;
          padding: 10px 14px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 20px;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .login-input-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .login-label {
          font-size: 12px;
          font-weight: 700;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .input-with-icon {
          position: relative;
          display: flex;
          align-items: center;
        }

        :global(.field-icon) {
          position: absolute;
          left: 12px;
          color: #94a3b8;
          pointer-events: none;
        }

        .login-input {
          width: 100%;
          padding: 11px 40px 11px 38px;
          background: #f8fafc;
          border: 1.5px solid #e2e8f0;
          border-radius: 8px;
          font-size: 14px;
          color: #0f172a;
          transition: all 0.2s ease;
          outline: none;
        }

        .login-input:focus {
          border-color: #1976d2;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(25, 118, 210, 0.15);
        }

        .btn-toggle-pw {
          position: absolute;
          right: 10px;
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .btn-toggle-pw:hover {
          color: #475569;
        }

        .btn-login-submit {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 13px;
          background: linear-gradient(135deg, #1976d2 0%, #0d47a1 100%);
          color: #ffffff;
          border: none;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(25, 118, 210, 0.3);
          margin-top: 6px;
        }

        .btn-login-submit:hover:not(:disabled) {
          background: linear-gradient(135deg, #1565c0 0%, #0a3880 100%);
          box-shadow: 0 6px 16px rgba(25, 118, 210, 0.4);
          transform: translateY(-1px);
        }

        .btn-login-submit:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .login-footer {
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid #f1f5f9;
          text-align: center;
        }

        .admin-hint {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-size: 11px;
          color: #94a3b8;
        }
      `}</style>
    </div>
  );
}
