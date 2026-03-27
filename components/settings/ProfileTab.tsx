import React, { useState, useEffect, useCallback } from 'react';
import { Palette, Mail, Check } from 'lucide-react';
import Avatar from '../Avatar';
import { ThemeMode, DensityMode } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import AIFieldAssist from '../AIFieldAssist';

const DEFAULT_BIO = 'Apaixonado por código limpo e arquitetura de software escalável.';

interface ProfileTabProps {
  themeMode: ThemeMode;
  setThemeMode?: (mode: ThemeMode) => void;
  densityMode: DensityMode;
  setDensityMode?: (mode: DensityMode) => void;
  addToast?: (title: string, type: 'success' | 'error' | 'info', desc?: string) => void;
  aiLanguage: string;
}

const ProfileTab: React.FC<ProfileTabProps> = ({ themeMode, setThemeMode, densityMode, setDensityMode, addToast, aiLanguage }) => {
  const { user, updateProfile } = useAuth();

  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    bio: (user?.preferences?.bio as string) || DEFAULT_BIO
  });

  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name,
        bio: (user.preferences?.bio as string) || DEFAULT_BIO
      });
    }
  }, [user]);

  const handleSaveProfile = useCallback(async () => {
    const res = await updateProfile({
      name: profileForm.name,
      preferences: {
        ...user?.preferences,
        bio: profileForm.bio
      }
    });

    if (res.success) {
      addToast?.('Perfil Atualizado', 'success', 'Suas informações foram salvas com sucesso.');
    } else {
      addToast?.('Falha ao Atualizar Perfil', 'error', res.error || 'Não foi possível salvar as alterações.');
    }
  }, [profileForm, user, updateProfile, addToast]);

  const handleThemeChange = useCallback((mode: ThemeMode) => {
    setThemeMode?.(mode);
  }, [setThemeMode]);

  return (
    <div className="panel-stack pb-6">
      <div className="rounded-2xl border border-slate-200/75 bg-slate-50/70 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
        <div className="flex items-center gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="relative group cursor-pointer">
            <Avatar name={user?.name || 'User'} size="xl" />
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 backdrop-blur-[1px] transition-opacity group-hover:opacity-100">
              <span className="rounded bg-black/50 px-2 py-1 text-xs font-medium text-white">Alterar</span>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Identidade</p>
            <h4 className="mt-2 text-xl font-semibold text-fiori-textPrimary dark:text-white">{user?.name}</h4>
            <p className="mt-0.5 text-sm capitalize text-fiori-textSecondary dark:text-slate-400">{user?.role} • <span className="cursor-pointer text-fiori-link hover:underline dark:text-fiori-linkDark">@{user?.name?.toLowerCase().replaceAll(/\s+/g, '')}</span></p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="profile-name" className="text-sm font-semibold text-fiori-textPrimary dark:text-slate-300">Nome Completo</label>
            <input
              id="profile-name"
              type="text"
              value={profileForm.name}
              onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
              className="app-input w-full rounded-xl px-4 py-3"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="profile-email" className="text-sm font-semibold text-fiori-textPrimary dark:text-slate-300">Email Corporativo</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
              <input id="profile-email" type="email" defaultValue={user?.email} disabled className="w-full cursor-not-allowed rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 pl-10 text-slate-500 shadow-sm transition-all dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400" />
            </div>
          </div>
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="profile-bio" className="text-sm font-semibold text-fiori-textPrimary dark:text-slate-300">Bio</label>
            <textarea
              id="profile-bio"
              rows={4}
              value={profileForm.bio}
              onChange={e => setProfileForm({ ...profileForm, bio: e.target.value })}
              className="app-input w-full rounded-xl px-4 py-3 resize-none"
            />
            <AIFieldAssist
              fieldType="profile_bio"
              variant="compact"
              surface="settings_profile"
              intent={profileForm.bio.trim() ? 'refine' : 'generate'}
              currentValue={profileForm.bio}
              helpText="Refina a bio com base no seu perfil real, sem cair em texto corporativo genérico."
              buildContext={() => ({
                name: profileForm.name,
                role: user?.role || 'user',
                currentBio: profileForm.bio,
                preferredLanguage: aiLanguage,
              })}
              relatedEntities={{
                user: {
                  id: user?.id || '',
                  name: user?.name || profileForm.name,
                  role: user?.role || 'user',
                },
              }}
              constraints={{
                tone: 'natural-profissional',
                maxSentences: 3,
                avoidCorporateCliches: true,
              }}
              onApply={(result) => setProfileForm(prev => ({ ...prev, bio: result.value || '' }))}
              buttonLabel="Gerar bio"
              className="mt-2"
            />
          </div>
          <div className="md:col-span-2">
            <button onClick={handleSaveProfile} className="app-button-primary px-6">
              Salvar Perfil
            </button>
          </div>
        </div>
      </div>

      <div className="surface-card panel-body-block rounded-2xl">
        <div className="mb-8 flex items-start gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-50/80 text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
            <Palette className="h-5 w-5" />
          </div>
          <div>
            <p className="app-section-label">Aparência</p>
            <h4 className="mt-2 text-lg font-semibold text-fiori-textPrimary dark:text-white">Tema e densidade operacional</h4>
            <p className="mt-1 app-copy-compact">Ajuste o estilo visual e a quantidade de informação exibida sem sair do contexto do seu perfil.</p>
          </div>
        </div>

        <div>
          <h5 className="mb-6 text-base font-semibold text-fiori-textPrimary dark:text-white">Tema da Interface</h5>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <button
              type="button"
              onClick={() => handleThemeChange('system')}
              className={`group h-40 cursor-pointer rounded-2xl border p-3 transition-all ${themeMode === 'system' ? 'border-fiori-blue bg-sky-50 shadow-sm shadow-sky-100/80 dark:bg-sky-500/10 dark:shadow-none' : 'bg-slate-50/78 hover:border-slate-300 dark:bg-white/[0.03] dark:hover:border-slate-600'}`}
            >
              <div className="relative mb-2 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white group-hover:shadow-md transition-shadow">
                <div className="absolute top-0 left-0 h-6 w-full border-b border-slate-100 bg-slate-100"></div>
                <div className="absolute top-0 left-0 h-full w-8 border-r border-slate-100 bg-slate-100"></div>
              </div>
              <div className="flex items-center justify-between px-2">
                <span className={`text-sm font-semibold ${themeMode === 'system' ? 'text-fiori-blue' : 'text-slate-500'}`}>Sistema</span>
                {themeMode === 'system' && <Check className="h-4 w-4 text-fiori-blue" />}
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleThemeChange('light')}
              className={`group h-40 cursor-pointer rounded-2xl border p-3 transition-all ${themeMode === 'light' ? 'border-fiori-blue bg-sky-50 shadow-sm shadow-sky-100/80 dark:bg-sky-500/10 dark:shadow-none' : 'bg-slate-50/78 hover:border-slate-300 dark:bg-white/[0.03]'}`}
            >
              <div className="relative mb-2 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white group-hover:shadow-md transition-shadow">
                <div className="absolute top-0 left-0 h-6 w-full border-b border-gray-200 bg-gray-100"></div>
                <div className="absolute top-0 left-0 h-full w-8 border-r border-gray-200 bg-gray-50"></div>
              </div>
              <div className="flex items-center justify-between px-2">
                <span className={`text-sm font-semibold ${themeMode === 'light' ? 'text-fiori-blue' : 'text-slate-500'}`}>Claro</span>
                {themeMode === 'light' && <Check className="h-4 w-4 text-fiori-blue" />}
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleThemeChange('dark')}
              className={`group h-40 cursor-pointer rounded-2xl border p-3 transition-all ${themeMode === 'dark' ? 'border-fiori-blue bg-sky-50 shadow-sm shadow-sky-100/80 dark:bg-sky-500/10 dark:shadow-none' : 'bg-slate-50/78 hover:border-slate-300 dark:bg-white/[0.03] dark:hover:border-slate-600'}`}
            >
              <div className="relative mb-2 flex-1 overflow-hidden rounded-lg border border-slate-800 bg-slate-900 group-hover:shadow-md transition-shadow">
                <div className="absolute top-0 left-0 h-6 w-full border-b border-primary-400/20 bg-slate-800"></div>
                <div className="absolute top-0 left-0 h-full w-8 border-r border-primary-400/20 bg-slate-800"></div>
              </div>
              <div className="flex items-center justify-between px-2">
                <span className={`text-sm font-semibold ${themeMode === 'dark' ? 'text-fiori-blue' : 'text-slate-500'}`}>Escuro</span>
                {themeMode === 'dark' && <Check className="h-4 w-4 text-fiori-blue" />}
              </div>
            </button>
          </div>
        </div>

        <div className="mt-8 border-t border-slate-100 pt-8 dark:border-slate-800">
          <h5 className="mb-6 text-base font-semibold text-fiori-textPrimary dark:text-white">Densidade de Informação</h5>
          <div className="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setDensityMode?.('comfortable')}
              className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200/75 bg-slate-50/72 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] transition-colors dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none"
            >
              <div className={`flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 dark:border-slate-600 ${densityMode === 'comfortable' ? 'border-fiori-blue' : ''}`}>
                {densityMode === 'comfortable' && <div className="h-2.5 w-2.5 rounded-full bg-fiori-blue"></div>}
              </div>
              <div>
                <span className={`text-sm font-medium transition-colors ${densityMode === 'comfortable' ? 'text-fiori-blue' : 'text-slate-700 dark:text-slate-300'}`}>Confortável</span>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Mais respiro entre painéis, ideal para leitura e revisão.</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setDensityMode?.('compact')}
              className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200/75 bg-slate-50/72 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] transition-colors dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none"
            >
              <div className={`flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 dark:border-slate-600 ${densityMode === 'compact' ? 'border-fiori-blue' : ''}`}>
                {densityMode === 'compact' && <div className="h-2.5 w-2.5 rounded-full bg-fiori-blue"></div>}
              </div>
              <div>
                <span className={`text-sm font-medium transition-colors ${densityMode === 'compact' ? 'text-fiori-blue' : 'text-slate-700 dark:text-slate-300'}`}>Compacto</span>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Mais informação por área útil, melhor para operação diária.</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileTab;
