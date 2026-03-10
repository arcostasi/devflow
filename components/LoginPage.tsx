import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { Mail, Lock, User, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import DevFlowLogo from './DevFlowLogo';

interface LoginPageProps {
    onLoginSuccess: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
    const { login, register } = useAuth();
    const [isRegister, setIsRegister] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [allowSelfRegister, setAllowSelfRegister] = useState(true);

    useEffect(() => {
        api.getPublicSettings()
            .then(data => setAllowSelfRegister(data.allowSelfRegister))
            .catch(() => setAllowSelfRegister(false));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setIsLoading(true);

        try {
            if (isRegister) {
                const result = await register(name, email, password);
                if (result.success) {
                    if (result.pending) {
                        setSuccess('Cadastro realizado! Aguarde aprovação do administrador.');
                        setIsRegister(false);
                    } else {
                        onLoginSuccess();
                    }
                } else {
                    setError(result.error || 'Erro ao cadastrar');
                }
            } else {
                const result = await login(email, password);
                if (result.success) {
                    onLoginSuccess();
                } else {
                    setError(result.error || 'Erro ao fazer login');
                }
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="app-auth-shell flex items-center justify-center p-4">
            <div className="relative grid w-full max-w-5xl gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                <section className="hidden lg:block">
                    <div className="max-w-xl">
                        <div className="inline-flex items-center gap-3 rounded-full border border-slate-200/80 bg-white/75 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-600 shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:shadow-none">
                            <div className="app-brand-badge app-brand-badge-sm">
                                <DevFlowLogo className="h-5 w-5" />
                            </div>
                            DevFlow Workspace
                        </div>
                        <h1 className="mt-6 text-5xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                            Operação de produto, código e entrega no mesmo fluxo.
                        </h1>
                        <p className="mt-5 max-w-lg text-base leading-7 text-slate-600 dark:text-slate-300">
                            Acesse backlog, sprint, repositórios, deploy e governança com o mesmo dark mode operacional validado nas telas principais.
                        </p>
                        <div className="mt-8 grid gap-3 sm:grid-cols-3">
                            <div className="surface-muted rounded-2xl p-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-400">Planejamento</p>
                                <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">Backlog e sprint com leitura rápida de capacidade.</p>
                            </div>
                            <div className="surface-muted rounded-2xl p-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-400">Execução</p>
                                <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">Kanban, revisão e integração Git no mesmo contexto.</p>
                            </div>
                            <div className="surface-muted rounded-2xl p-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-400">Entrega</p>
                                <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">Ambientes e governança com foco em risco e promoção.</p>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="app-auth-panel rounded-[1.75rem] p-6 sm:p-8">
                    <div className="mb-8 text-center lg:text-left">
                        <div className="app-brand-badge app-brand-badge-lg mx-auto lg:mx-0">
                            <DevFlowLogo className="h-8 w-8" />
                        </div>
                        <h2 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                            {isRegister ? 'Criar Conta' : 'Entrar'}
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                            {isRegister ? 'Solicite acesso ao workspace com credenciais iniciais.' : 'Continue para o workspace de gerenciamento de projetos.'}
                        </p>
                    </div>

                    {error && (
                        <div className="app-notice app-notice-error mb-4">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <span className="text-sm">{error}</span>
                        </div>
                    )}

                    {success && (
                        <div className="app-notice app-notice-success mb-4">
                            <CheckCircle className="w-5 h-5 flex-shrink-0" />
                            <span className="text-sm">{success}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {isRegister && (
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Nome</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        autoComplete="name"
                                        className="app-input w-full rounded-xl py-3 pl-10 pr-4"
                                        placeholder="Seu nome"
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    autoComplete="email"
                                    className="app-input w-full rounded-xl py-3 pl-10 pr-4"
                                    placeholder="seu@email.com"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Senha</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                                    className="app-input w-full rounded-xl py-3 pl-10 pr-4"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="app-button-primary w-full disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Aguarde...
                                </>
                            ) : (
                                isRegister ? 'Criar Conta' : 'Entrar'
                            )}
                        </button>
                    </form>

                    {allowSelfRegister && (
                        <div className="mt-6 text-center">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsRegister(!isRegister);
                                    setError('');
                                    setSuccess('');
                                }}
                                className="text-sm font-medium text-sky-600 transition-colors hover:text-sky-700 dark:text-sky-300 dark:hover:text-sky-200"
                            >
                                {isRegister ? 'Já tem conta? Entrar' : 'Não tem conta? Criar uma'}
                            </button>
                        </div>
                    )}
                </div>

                <div className="text-center text-sm text-slate-500 dark:text-slate-400 lg:absolute lg:bottom-0 lg:right-0 lg:text-right">
                    <p>Credenciais padrão: <span className="font-medium text-slate-700 dark:text-slate-300">admin@devflow.local</span> / <span className="font-medium text-slate-700 dark:text-slate-300">admin123</span></p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
