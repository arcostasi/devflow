import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { FolderGit2, Mail, Lock, User, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

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
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-600/30">
                        <FolderGit2 className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white">DevFlow</h1>
                    <p className="text-slate-400 mt-2">Gerenciamento de Projetos XP</p>
                </div>

                {/* Card */}
                <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-8 shadow-2xl">
                    <h2 className="text-xl font-semibold text-white mb-6">
                        {isRegister ? 'Criar Conta' : 'Entrar'}
                    </h2>

                    {error && (
                        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-4">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <span className="text-sm">{error}</span>
                        </div>
                    )}

                    {success && (
                        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg mb-4">
                            <CheckCircle className="w-5 h-5 flex-shrink-0" />
                            <span className="text-sm">{success}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {isRegister && (
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Nome</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        className="w-full bg-slate-700/50 border border-slate-600 rounded-lg pl-10 pr-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                        placeholder="Seu nome"
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg pl-10 pr-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    placeholder="seu@email.com"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Senha</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg pl-10 pr-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
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
                                className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
                            >
                                {isRegister ? 'Já tem conta? Entrar' : 'Não tem conta? Criar uma'}
                            </button>
                        </div>
                    )}
                </div>

                {/* Default credentials hint */}
                <div className="mt-6 text-center text-slate-500 text-sm">
                    <p>Credenciais padrão: <span className="text-slate-400">admin@devflow.local</span> / <span className="text-slate-400">admin123</span></p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
