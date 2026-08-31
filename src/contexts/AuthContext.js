'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { getDocuments, createDocument } from '@/lib/firestore';

const MASTER_ADMIN = {
  uid: 'admin-master',
  username: 'administrador',
  name: 'Administrador',
  role: 'admin',
  active: true,
};

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('fp_current_user');
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
    } catch (e) {
      console.error('Erro ao restaurar sessão:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    const cleanUsername = (username || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    if (!cleanUsername || !cleanPassword) {
      throw new Error('Informe o usuário e a senha.');
    }

    // 1. Verificação do Usuário Mestre Administrador
    if (
      (cleanUsername === 'administrador' || cleanUsername === 'admin') &&
      cleanPassword === '15644558'
    ) {
      setUser(MASTER_ADMIN);
      localStorage.setItem('fp_current_user', JSON.stringify(MASTER_ADMIN));
      return MASTER_ADMIN;
    }

    // 2. Busca na base de usuários cadastrados
    const users = await getDocuments('users');
    const foundUser = users.find(
      (u) =>
        (u.username && u.username.toLowerCase() === cleanUsername) ||
        (u.email && u.email.toLowerCase() === cleanUsername) ||
        (u.name && u.name.toLowerCase() === cleanUsername)
    );

    if (!foundUser) {
      throw new Error('Usuário não encontrado no sistema.');
    }

    if (foundUser.active === false) {
      throw new Error('Este usuário está inativo. Contate o administrador.');
    }

    // Verifica a senha (ou master password como chave mestra)
    if (foundUser.password !== cleanPassword && cleanPassword !== '15644558') {
      throw new Error('Senha incorreta.');
    }

    const sessionUser = {
      uid: foundUser.id,
      username: foundUser.username || foundUser.name,
      name: foundUser.name,
      role: foundUser.role || 'operator',
      active: true,
    };

    setUser(sessionUser);
    localStorage.setItem('fp_current_user', JSON.stringify(sessionUser));
    return sessionUser;
  };

  const logout = async () => {
    localStorage.removeItem('fp_current_user');
    setUser(null);
  };

  const registerUser = async (username, password, extraData = {}) => {
    const cleanUsername = (username || '').trim().toLowerCase();
    if (!cleanUsername) throw new Error('Nome de usuário é obrigatório');
    if (!password || password.length < 3) throw new Error('A senha deve ter pelo menos 3 caracteres');

    const users = await getDocuments('users');
    const exists = users.some(
      (u) => u.username && u.username.toLowerCase() === cleanUsername
    );

    if (exists || cleanUsername === 'administrador' || cleanUsername === 'admin') {
      throw new Error('Este nome de usuário já está em uso.');
    }

    const newUser = {
      username: cleanUsername,
      name: extraData.name || cleanUsername,
      password: password,
      role: extraData.role || 'operator',
      active: true,
    };

    const docId = await createDocument('users', newUser);
    return { id: docId, ...newUser };
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, registerUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}
