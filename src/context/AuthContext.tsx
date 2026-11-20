import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services';
import { SessionUser } from '../types';

interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  canControl: boolean; // admin + member
  canViewCameras: boolean; // admin + member
  canManage: boolean; // admin only: scan/add devices, change roles, move home location
}

const Ctx = createContext<AuthState | null>(null);

const same = (a: SessionUser, b: SessionUser) => a.id === b.id && a.role === b.role && a.name === b.name;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getSessionUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // When the backend reports a change (e.g. an admin changed this user's role) pick up the new role right away.
  // A failed lookup (offline) keeps the current user instead of signing them out.
  useEffect(
    () =>
      api.subscribe(() => {
        api
          .getSessionUser()
          .then((fresh) => setUser((prev) => (prev && fresh && same(prev, fresh) ? prev : prev ? fresh : prev)))
          .catch(() => {});
      }),
    [],
  );

  const login = useCallback(async (email: string, password: string) => {
    setUser(await api.login(email, password));
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    setUser(await api.register(name, email, password));
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(() => {
    const role = user?.role;
    return {
      user,
      loading,
      login,
      register,
      logout,
      canControl: role === 'admin' || role === 'member',
      canViewCameras: role === 'admin' || role === 'member',
      canManage: role === 'admin',
    };
  }, [user, loading, login, register, logout]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
