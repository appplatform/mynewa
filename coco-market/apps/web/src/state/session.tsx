import type { PublicUser, Role } from '@coco/core';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../api';

interface SessionValue {
  user: PublicUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const r = await api.call('auth.me', {});
      setUser(r.user);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<SessionValue>(
    () => ({
      user,
      loading,
      refresh,
      async login(email, password) {
        const r = await api.call('auth.login', { email, password });
        setUser(r.user);
      },
      async logout() {
        await api.call('auth.logout', {});
        setUser(null);
      },
      hasRole: (...roles) => !!user && (user.roles.includes('SUPER_ADMIN') || roles.some((r) => user.roles.includes(r))),
    }),
    [user, loading, refresh],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(SessionContext);
  if (!v) throw new Error('SessionProvider missing');
  return v;
}
