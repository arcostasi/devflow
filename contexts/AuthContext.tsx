import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getErrorMessage } from '../types';

interface User {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    role: 'admin' | 'user';
    groups?: { id: string; name: string; permissions?: string[] }[];
    preferences?: {
        bio?: string;
        notifications?: Record<string, boolean>;
        [key: string]: unknown;
    };
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    isAdmin: boolean;
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string; pending?: boolean }>;
    logout: () => void;
    refreshUser: () => Promise<void>;
    updateProfile: (data: Partial<User>) => Promise<{ success: boolean; error?: string }>;
    updatePassword: (current: string, next: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const API_URL = 'http://127.0.0.1:3001/api';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem('devflow_token'));
    const [isLoading, setIsLoading] = useState(true);

    const isAuthenticated = !!user;
    const isAdmin = user?.role === 'admin';

    useEffect(() => {
        if (token) {
            refreshUser();
        } else {
            setIsLoading(false);
        }
    }, []);

    const refreshUser = async () => {
        if (!token) {
            setIsLoading(false);
            return;
        }

        try {
            const res = await fetch(`${API_URL}/auth/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.ok) {
                const userData = await res.json();
                setUser(userData);
            } else {
                localStorage.removeItem('devflow_token');
                setToken(null);
                setUser(null);
            }
        } catch (err) {
            console.error('Failed to refresh user:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (email: string, password: string) => {
        try {
            const res = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();

            if (res.ok) {
                localStorage.setItem('devflow_token', data.token);
                if (data.refreshToken) localStorage.setItem('devflow_refresh_token', data.refreshToken);
                setToken(data.token);
                setUser(data.user);
                return { success: true };
            } else {
                return { success: false, error: data.error || 'Erro ao fazer login' };
            }
        } catch (_err) {
            return { success: false, error: 'Erro de conexão com o servidor' };
        }
    };

    const register = async (name: string, email: string, password: string) => {
        try {
            const res = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });

            const data = await res.json();

            if (res.ok) {
                if (data.pending) {
                    return { success: true, pending: true };
                }

                if (data.token) {
                    localStorage.setItem('devflow_token', data.token);
                    if (data.refreshToken) localStorage.setItem('devflow_refresh_token', data.refreshToken);
                    setToken(data.token);
                    setUser(data.user);
                }
                return { success: true };
            } else {
                return { success: false, error: data.error || 'Erro ao cadastrar' };
            }
        } catch (_err) {
            return { success: false, error: 'Erro de conexão com o servidor' };
        }
    };

    const logout = () => {
        localStorage.removeItem('devflow_token');
        localStorage.removeItem('devflow_refresh_token');
        setToken(null);
        setUser(null);
    };

    const updateProfile = async (data: Partial<User>) => {
        try {
            const res = await fetch(`${API_URL}/auth/me`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });

            const result = await res.json();
            if (res.ok) {
                setUser(result.user);
                return { success: true };
            } else {
                return { success: false, error: result.error || 'Erro ao atualizar perfil' };
            }
        } catch (err: unknown) {
            console.error(err);
            return { success: false, error: `Erro de conexão: ${getErrorMessage(err)}` };
        }
    };

    const updatePassword = async (current: string, next: string) => {
        try {
            const res = await fetch(`${API_URL}/auth/password`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ currentPassword: current, newPassword: next })
            });

            const result = await res.json();
            if (res.ok) {
                return { success: true };
            } else {
                return { success: false, error: result.error || 'Erro ao atualizar senha' };
            }
        } catch (_err) {
            return { success: false, error: 'Erro de conexão' };
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            token,
            isLoading,
            isAuthenticated,
            isAdmin,
            login,
            register,
            logout,
            refreshUser,
            updateProfile,
            updatePassword
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
