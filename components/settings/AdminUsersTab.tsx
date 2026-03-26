import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Loader2, Trash2, UserPlus, UserCheck } from 'lucide-react';
import { AdminGroup, getErrorMessage } from '../../types';
import Modal from '../Modal';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { api } from '../../services/api';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  status: string;
  createdAt?: string;
  groupNames?: string;
}

interface AdminUsersTabProps {
  addToast?: (title: string, type: 'success' | 'error' | 'info', desc?: string) => void;
  onPendingCountChange?: (count: number) => void;
}

const AdminUsersTab: React.FC<AdminUsersTabProps> = ({ addToast, onPendingCountChange }) => {
  const { isAdmin } = useAuth();
  const { confirm } = useConfirm();

  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminGroups, setAdminGroups] = useState<AdminGroup[]>([]);
  const [isLoadingAdmin, setIsLoadingAdmin] = useState(false);
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ name: '', email: '', password: '', role: 'user' });

  const loadAdminData = useCallback(async () => {
    setIsLoadingAdmin(true);
    try {
      const [users, groups] = await Promise.all([
        api.getAdminUsers(),
        api.getAdminGroups(),
      ]);
      setAdminUsers(users);
      setAdminGroups(groups);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    }
    setIsLoadingAdmin(false);
  }, []);

  useEffect(() => {
    if (isAdmin) loadAdminData();
  }, [isAdmin, loadAdminData]);

  useEffect(() => {
    onPendingCountChange?.(adminUsers.filter(u => u.status === 'pending').length);
  }, [adminUsers, onPendingCountChange]);

  const handleApproveUser = useCallback(async (userId: string) => {
    try {
      await api.updateAdminUser(userId, { status: 'active' });
      addToast?.('Usuário Aprovado', 'success', 'O acesso ao sistema foi liberado.');
      loadAdminData();
    } catch (e: unknown) {
      addToast?.('Falha na Aprovação', 'error', getErrorMessage(e));
    }
  }, [addToast, loadAdminData]);

  const handleDeleteUser = useCallback(async (userId: string) => {
    if (!await confirm({ title: 'Remover Usuário', message: 'Remover este usuário?', confirmText: 'Remover', variant: 'danger' })) return;
    try {
      await api.deleteAdminUser(userId);
      addToast?.('Usuário Removido', 'info', 'A conta foi removida do sistema.');
      loadAdminData();
    } catch (e: unknown) {
      addToast?.('Falha ao Remover', 'error', getErrorMessage(e));
    }
  }, [confirm, addToast, loadAdminData]);

  const handleCreateUser = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createAdminUser(newUserForm);
      addToast?.('Usuário Criado', 'success', `${newUserForm.name} foi adicionado ao sistema.`);
      setShowNewUserModal(false);
      setNewUserForm({ name: '', email: '', password: '', role: 'user' });
      loadAdminData();
    } catch (e: unknown) {
      addToast?.('Falha ao Criar Usuário', 'error', getErrorMessage(e));
    }
  }, [newUserForm, addToast, loadAdminData]);

  return (
    <>
      <div className="panel-stack pb-6">
        <div className="surface-card panel-body-block rounded-2xl">
          <div className="mb-6 flex items-start gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-50/80 text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="app-section-label">Grupos</p>
              <h4 className="mt-2 text-lg font-semibold text-fiori-textPrimary dark:text-white">Grupos e permissões</h4>
              <p className="mt-1 app-copy-compact">Mantenha a leitura de governança perto da gestão de usuários para reduzir troca de contexto administrativo.</p>
            </div>
          </div>

          {isLoadingAdmin ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : adminGroups.length === 0 ? (
            <div className="app-empty-state">
              <strong className="text-sm">Nenhum grupo cadastrado</strong>
              <p className="text-sm">Os grupos de permissão aparecerão aqui quando forem configurados pela administração.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {adminGroups.map(group => (
                <div key={group.id} className="rounded-2xl border border-slate-200/75 bg-slate-50/72 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="font-semibold text-slate-700 dark:text-white">{group.name}</h4>
                    <span className="text-xs text-slate-400">{group.id}</span>
                  </div>
                  <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">{group.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {group.permissions.map((perm, idx) => (
                      <span key={idx} className="rounded px-2 py-1 text-xs text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-400">
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-fiori-textPrimary dark:text-white">Gerenciar Usuários</h3>
          <button onClick={() => setShowNewUserModal(true)} className="app-button-primary">
            <UserPlus className="w-4 h-4" />
            Novo Usuário
          </button>
        </div>

        {isLoadingAdmin ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : adminUsers.length === 0 ? (
          <div className="app-empty-state">
            <strong className="text-sm">Nenhum usuário encontrado</strong>
            <p className="text-sm">Adicione colaboradores para iniciar o controle de acesso do workspace.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/88 shadow-sm shadow-slate-200/60 dark:border-slate-800 dark:bg-transparent dark:shadow-none">
            <table className="min-w-[700px] w-full divide-y divide-slate-200 dark:divide-slate-800">
              <thead className="bg-slate-50/85 dark:bg-slate-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Usuário</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Grupos</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white/80 dark:bg-transparent">
                {adminUsers.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <img src={user.avatar} alt="" className="w-8 h-8 rounded-full" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{user.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${user.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${user.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : user.status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : 'bg-red-100 text-red-700'}`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{user.groupNames || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        {user.status === 'pending' && (
                          <button onClick={() => handleApproveUser(user.id)} className="rounded-lg p-2.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 min-w-[44px] min-h-[44px] flex items-center justify-center" title="Aprovar">
                            <UserCheck className="w-4 h-4" />
                          </button>
                        )}
                        {user.id !== 'admin' && (
                          <button onClick={() => handleDeleteUser(user.id)} className="rounded-lg p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 min-w-[44px] min-h-[44px] flex items-center justify-center" title="Remover">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New User Modal */}
      <Modal isOpen={showNewUserModal} onClose={() => setShowNewUserModal(false)} title="Novo Usuário" size="md">
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="surface-muted rounded-2xl p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Provisionamento de acesso</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Crie uma conta interna com papel e credenciais iniciais para entrada imediata no workspace.</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nome</label>
            <input type="text" value={newUserForm.name} onChange={e => setNewUserForm({ ...newUserForm, name: e.target.value })} autoComplete="name" className="app-input w-full rounded-xl px-3 py-2.5" required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
            <input type="email" value={newUserForm.email} onChange={e => setNewUserForm({ ...newUserForm, email: e.target.value })} autoComplete="email" className="app-input w-full rounded-xl px-3 py-2.5" required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Senha</label>
            <input type="password" value={newUserForm.password} onChange={e => setNewUserForm({ ...newUserForm, password: e.target.value })} autoComplete="new-password" className="app-input w-full rounded-xl px-3 py-2.5" required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Role</label>
            <select value={newUserForm.role} onChange={e => setNewUserForm({ ...newUserForm, role: e.target.value })} className="app-input w-full rounded-xl px-3 py-2.5">
              <option value="user">Usuário</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowNewUserModal(false)} className="app-button-secondary">Cancelar</button>
            <button type="submit" className="app-button-primary">Criar Usuário</button>
          </div>
        </form>
      </Modal>
    </>
  );
};

export default AdminUsersTab;
