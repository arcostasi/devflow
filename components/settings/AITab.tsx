import React, { useState, useEffect, useCallback } from 'react';
import { Bot, Languages, Server, Save, RefreshCw } from 'lucide-react';
import { AIConfig, getErrorMessage } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';

interface AITabProps {
  addToast?: (title: string, type: 'success' | 'error' | 'info', desc?: string) => void;
  onAiLanguageChange?: (language: string) => void;
}

const AITab: React.FC<AITabProps> = ({ addToast, onAiLanguageChange }) => {
  const { user, isAdmin, updateProfile } = useAuth();

  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiUserForm, setAiUserForm] = useState({ model: 'granite4:latest', language: 'pt-BR' });
  const [aiSystemForm, setAiSystemForm] = useState({ model: 'granite4:latest', language: 'pt-BR' });

  const loadAIConfig = useCallback(async () => {
    setIsLoadingAI(true);
    try {
      const config = await api.getAIConfig();
      setAiConfig(config);
      const userLang = config.preferences.language || config.defaults.language || 'pt-BR';
      setAiUserForm({
        model: config.preferences.model || config.defaults.model || 'granite4:latest',
        language: userLang,
      });
      setAiSystemForm({
        model: config.defaults.model || 'granite4:latest',
        language: config.defaults.language || 'pt-BR',
      });
      onAiLanguageChange?.(userLang);
    } catch (e: unknown) {
      addToast?.('Falha ao Carregar IA', 'error', getErrorMessage(e));
    } finally {
      setIsLoadingAI(false);
    }
  }, [addToast, onAiLanguageChange]);

  useEffect(() => {
    loadAIConfig();
  }, [loadAIConfig]);

  const handleSaveAIPreferences = useCallback(async () => {
    const res = await updateProfile({
      preferences: {
        ...(user?.preferences || {}),
        ai: {
          model: aiUserForm.model,
          language: aiUserForm.language,
        }
      }
    });

    if (res.success) {
      addToast?.('Preferências de IA Salvas', 'success', 'Seu modelo e idioma padrão foram atualizados.');
      onAiLanguageChange?.(aiUserForm.language);
      await loadAIConfig();
    } else {
      addToast?.('Falha ao Salvar IA', 'error', res.error || 'Não foi possível salvar as preferências de IA.');
    }
  }, [aiUserForm, user, updateProfile, addToast, onAiLanguageChange, loadAIConfig]);

  const handleSaveAISystemDefaults = useCallback(async () => {
    try {
      await api.saveAdminSettings({
        aiDefaultModel: aiSystemForm.model,
        aiDefaultLanguage: aiSystemForm.language,
      });
      addToast?.('Padrões de IA Salvos', 'success', 'Os padrões globais de IA foram atualizados.');
      await loadAIConfig();
    } catch (e: unknown) {
      addToast?.('Falha ao Salvar Padrões', 'error', getErrorMessage(e));
    }
  }, [aiSystemForm, addToast, loadAIConfig]);

  return (
    <div className="panel-stack pb-6">
      <div className="surface-card panel-body-block rounded-2xl">
        <div className="mb-6 flex items-start gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-50/80 text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <p className="app-section-label">IA Local</p>
            <h4 className="mt-2 text-lg font-semibold text-fiori-textPrimary dark:text-white">Ollama e preenchimento automático</h4>
            <p className="mt-1 app-copy-compact">
              O DevFlow usa o Ollama local para sugerir textos coerentes nos campos de trabalho. O padrão do sistema é <code className="font-mono">granite4:latest</code> quando disponível.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/75 bg-slate-50/72 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Status</p>
            <p className={`mt-3 text-lg font-semibold ${aiConfig?.status.available ? 'text-emerald-600 dark:text-emerald-300' : 'text-amber-600 dark:text-amber-300'}`}>
              {isLoadingAI ? 'Consultando...' : aiConfig?.status.available ? 'Ollama disponível' : 'Ollama indisponível'}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{aiConfig?.status.url || 'http://127.0.0.1:11434'}</p>
          </div>

          <div className="rounded-2xl border border-slate-200/75 bg-slate-50/72 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Modelo padrão</p>
            <p className="mt-3 text-lg font-semibold text-slate-900 dark:text-slate-100">{aiConfig?.defaults.model || 'granite4:latest'}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Fallback usado quando o usuário não escolheu um modelo.</p>
          </div>

          <div className="rounded-2xl border border-slate-200/75 bg-slate-50/72 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Idioma</p>
            <p className="mt-3 text-lg font-semibold text-slate-900 dark:text-slate-100">{aiConfig?.preferences.language || 'pt-BR'}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Idioma atual usado para gerar textos automaticamente.</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={loadAIConfig} className="app-button-secondary" disabled={isLoadingAI}>
            <RefreshCw className={`h-4 w-4 ${isLoadingAI ? 'animate-spin' : ''}`} />
            Atualizar status do Ollama
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="surface-card panel-body-block rounded-2xl">
          <div className="mb-6 flex items-start gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-50/80 text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
              <Languages className="h-5 w-5" />
            </div>
            <div>
              <p className="app-section-label">Preferência pessoal</p>
              <h4 className="mt-2 text-lg font-semibold text-fiori-textPrimary dark:text-white">Modelo e idioma dos seus botões de IA</h4>
              <p className="mt-1 app-copy-compact">Essas opções são usadas nos autofills do seu usuário em tarefas, sprints, repositórios, Git e comentários.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-fiori-textPrimary dark:text-slate-300">Modelo local</label>
              <select
                value={aiUserForm.model}
                onChange={(e) => setAiUserForm(prev => ({ ...prev, model: e.target.value }))}
                className="app-input w-full rounded-xl px-4 py-3"
              >
                {(aiConfig?.models || []).map((model) => (
                  <option key={model.name} value={model.name}>{model.name}</option>
                ))}
              </select>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Somente modelos locais compatíveis com geração de texto são exibidos.</p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-fiori-textPrimary dark:text-slate-300">Idioma de geração</label>
              <select
                value={aiUserForm.language}
                onChange={(e) => setAiUserForm(prev => ({ ...prev, language: e.target.value }))}
                className="app-input w-full rounded-xl px-4 py-3"
              >
                {(aiConfig?.languageOptions || []).map((option) => (
                  <option key={option.code} value={option.code}>{option.label}</option>
                ))}
              </select>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">A IA usa esse idioma para gerar títulos, descrições, comentários e notas automaticamente.</p>
            </div>

            <button onClick={handleSaveAIPreferences} className="app-button-primary w-fit">
              <Save className="h-4 w-4" />
              Salvar preferências de IA
            </button>
          </div>
        </div>

        <div className="surface-card panel-body-block rounded-2xl">
          <div className="mb-6 flex items-start gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-50/80 text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <p className="app-section-label">Modelos disponíveis</p>
              <h4 className="mt-2 text-lg font-semibold text-fiori-textPrimary dark:text-white">Catálogo local do Ollama</h4>
              <p className="mt-1 app-copy-compact">Selecione entre os modelos já instalados localmente sem depender de serviços externos.</p>
            </div>
          </div>

          <div className="space-y-3">
            {(aiConfig?.models || []).length === 0 && (
              <div className="rounded-2xl border border-amber-200/70 bg-amber-50/80 p-4 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                Nenhum modelo de texto compatível foi encontrado. Verifique o serviço Ollama e a instalação local dos modelos.
              </div>
            )}

            {(aiConfig?.models || []).map((model) => (
              <div key={model.name} className="rounded-2xl border border-slate-200/75 bg-slate-50/72 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{model.name}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Família: {model.family || 'n/d'} · Parâmetros: {model.parameterSize || 'n/d'} · Quantização: {model.quantization || 'n/d'}
                    </p>
                  </div>
                  {model.name === aiConfig?.defaults.model && (
                    <span className="inline-flex items-center rounded-full bg-sky-500/10 px-3 py-1 text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                      Padrão
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {isAdmin && (
            <div className="mt-6 border-t border-slate-100 pt-6 dark:border-slate-800">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Padrões globais</p>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-fiori-textPrimary dark:text-slate-300">Modelo padrão do sistema</label>
                  <select
                    value={aiSystemForm.model}
                    onChange={(e) => setAiSystemForm(prev => ({ ...prev, model: e.target.value }))}
                    className="app-input w-full rounded-xl px-4 py-3"
                  >
                    {(aiConfig?.models || []).map((model) => (
                      <option key={model.name} value={model.name}>{model.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-fiori-textPrimary dark:text-slate-300">Idioma padrão do sistema</label>
                  <select
                    value={aiSystemForm.language}
                    onChange={(e) => setAiSystemForm(prev => ({ ...prev, language: e.target.value }))}
                    className="app-input w-full rounded-xl px-4 py-3"
                  >
                    {(aiConfig?.languageOptions || []).map((option) => (
                      <option key={option.code} value={option.code}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <button onClick={handleSaveAISystemDefaults} className="app-button-secondary w-fit">
                  <Save className="h-4 w-4" />
                  Salvar padrões globais
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AITab;
