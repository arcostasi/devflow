import {
    Task,
    Repository,
    Sprint,
    User,
    GitChange,
    GitCommit,
    AIConfig,
    AIFillFieldResponse,
    AIFieldType,
    AIIntent,
    AISurface,
    AIContextPayload
} from '../types';

const API_URL = 'http://127.0.0.1:3001/api';

const getAuthHeaders = () => {
    const token = localStorage.getItem('devflow_token');
    return token ? {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    } : {
        'Content-Type': 'application/json'
    };
};

// Centralized handler: auto-logout on 401 (expired/invalid token)
const handleResponse = async (res: Response, _fallbackMsg: string): Promise<Response> => {
    if (res.status === 401) {
        const token = localStorage.getItem('devflow_token');
        if (token) {
            localStorage.removeItem('devflow_token');
            globalThis.location.reload();
        }
        throw new Error('Sessão expirada. Faça login novamente.');
    }
    return res;
};

export const api = {
    // Activities
    getActivities: async (): Promise<any[]> => {
        const res = await fetch(`${API_URL}/activities`, { headers: getAuthHeaders() });
        await handleResponse(res, 'Falha ao carregar atividades');
        if (!res.ok) throw new Error('Falha ao carregar atividades');
        return res.json();
    },

    // AI
    getAIConfig: async (): Promise<AIConfig> => {
        const res = await fetch(`${API_URL}/ai/config`, { headers: getAuthHeaders() });
        await handleResponse(res, 'Falha ao carregar configurações de IA');
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Falha ao carregar configurações de IA');
        return result;
    },

    fillAIField: async (payload: {
        fieldType: AIFieldType;
        context: Record<string, unknown>;
        instruction?: string;
        surface?: AISurface;
        intent?: AIIntent;
        currentValue?: string;
        relatedEntities?: AIContextPayload['relatedEntities'];
        constraints?: AIContextPayload['constraints'];
        retryOnGeneric?: boolean;
    }): Promise<AIFillFieldResponse> => {
        const res = await fetch(`${API_URL}/ai/fill-field`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        await handleResponse(res, 'Falha ao gerar conteúdo com IA');
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Falha ao gerar conteúdo com IA');
        return result;
    },

    // Users
    getUsers: async (): Promise<User[]> => {
        const res = await fetch(`${API_URL}/users`, { headers: getAuthHeaders() });
        await handleResponse(res, 'Falha ao carregar usuários');
        if (!res.ok) throw new Error('Falha ao carregar usuários');
        return res.json();
    },

    // Sprints
    getSprints: async (): Promise<Sprint[]> => {
        const res = await fetch(`${API_URL}/sprints`, { headers: getAuthHeaders() });
        await handleResponse(res, 'Falha ao carregar sprints');
        if (!res.ok) throw new Error('Falha ao carregar sprints');
        return res.json();
    },

    createSprint: async (sprint: Sprint): Promise<void> => {
        const res = await fetch(`${API_URL}/sprints`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(sprint)
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Falha ao criar sprint');
        }
    },

    updateSprint: async (id: string, updates: any): Promise<void> => {
        const res = await fetch(`${API_URL}/sprints/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(updates)
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Falha ao atualizar sprint');
        }
    },

    deleteSprint: async (id: string): Promise<void> => {
        const res = await fetch(`${API_URL}/sprints/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Falha ao remover sprint');
        }
    },

    // Repositories
    getRepos: async (): Promise<Repository[]> => {
        const res = await fetch(`${API_URL}/repos`, { headers: getAuthHeaders() });
        await handleResponse(res, 'Falha ao carregar repositórios');
        if (!res.ok) throw new Error('Falha ao carregar repositórios');
        return res.json();
    },

    deleteRepo: async (id: string): Promise<void> => {
        const res = await fetch(`${API_URL}/repos/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Falha ao remover repositório');
        }
    },

    saveRepoSettings: async (repoId: string, settings: { gitlabProjectPath?: string }): Promise<void> => {
        const res = await fetch(`${API_URL}/repos/${repoId}/settings`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(settings)
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Falha ao salvar configurações');
        }
    },

    createRepo: async (repo: Repository & { localPath?: string; linkExisting?: boolean }): Promise<Repository> => {
        const res = await fetch(`${API_URL}/repos`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(repo)
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'Falha ao criar repositório');
        }
        return data.repo;
    },

    getRepoFiles: async (id: string, subPath?: string): Promise<{ files: { name: string; relativePath: string; type: 'file' | 'directory'; modifiedAt: string }[]; localPath: string; currentPath: string }> => {
        const params = subPath ? `?subPath=${encodeURIComponent(subPath)}` : '';
        const res = await fetch(`${API_URL}/repos/${id}/files${params}`, { headers: getAuthHeaders() });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Falha ao listar arquivos');
        }
        return res.json();
    },

    getRepoFileContent: async (repoId: string, filePath: string): Promise<{ content: string; fileName: string }> => {
        const res = await fetch(`${API_URL}/repos/${repoId}/file?filePath=${encodeURIComponent(filePath)}`, { headers: getAuthHeaders() });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Falha ao ler arquivo');
        }
        return res.json();
    },

    saveRepoFile: async (repoId: string, filePath: string, content: string, commitMessage?: string): Promise<{ committed: boolean; message: string }> => {
        const res = await fetch(`${API_URL}/repos/${repoId}/file`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ filePath, content, commitMessage })
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Falha ao salvar arquivo');
        }
        return res.json();
    },

    getRepoCommits: async (repoId: string, limit: number = 10): Promise<{ commits: Array<{ hash: string; fullHash: string; author: string; email: string; date: string; message: string; relativeDate: string }> }> => {
        const res = await fetch(`${API_URL}/repos/${repoId}/git/commits?limit=${limit}`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('Falha ao carregar commits');
        return res.json();
    },

    // Tasks
    getTasks: async (): Promise<Task[]> => {
        const res = await fetch(`${API_URL}/tasks`, { headers: getAuthHeaders() });
        await handleResponse(res, 'Falha ao carregar tarefas');
        if (!res.ok) throw new Error('Falha ao carregar tarefas');
        return res.json();
    },

    createTask: async (task: Task): Promise<void> => {
        const payload: Record<string, any> = { ...task };
        payload.assigneeId = task.assignee?.id || null;
        delete payload.assignee;
        if (task.pairAssignee) { payload.pairAssigneeId = task.pairAssignee.id; delete payload.pairAssignee; }
        const res = await fetch(`${API_URL}/tasks`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Falha ao criar tarefa');
        }
    },

    getTaskComments: async (taskId: string): Promise<any[]> => {
        const res = await fetch(`${API_URL}/tasks/${taskId}/comments`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('Falha ao carregar comentários');
        return res.json();
    },

    createTaskComment: async (taskId: string, text: string): Promise<any> => {
        const res = await fetch(`${API_URL}/tasks/${taskId}/comments`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ text })
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Falha ao criar comentário');
        }
        return res.json();
    },

    deleteTaskComment: async (taskId: string, commentId: string): Promise<void> => {
        const res = await fetch(`${API_URL}/tasks/${taskId}/comments/${commentId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Falha ao excluir comentário');
        }
    },

    deleteTask: async (id: string): Promise<void> => {
        const res = await fetch(`${API_URL}/tasks/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Falha ao remover tarefa');
        }
    },

    updateTask: async (id: string, updates: Partial<Task>): Promise<void> => {
        const payload: Record<string, any> = { ...updates };
        // Flatten assignee/pairAssignee objects to IDs for the backend
        if (updates.assignee !== undefined) {
            payload.assigneeId = updates.assignee?.id || null;
            delete payload.assignee;
        }
        if (updates.pairAssignee !== undefined) {
            payload.pairAssigneeId = updates.pairAssignee?.id || null;
            delete payload.pairAssignee;
        }
        const res = await fetch(`${API_URL}/tasks/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Falha ao atualizar tarefa');
        }
    },

    createActivity: async (activity: { id: string; userId: string; action: string; target: string; targetType: string; taskId?: string; meta?: string }): Promise<void> => {
        const res = await fetch(`${API_URL}/activities`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(activity)
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Falha ao registrar atividade');
        }
    },

    // Git por Repositório
    getRepoGitStatus: async (repoId: string): Promise<{ branch: string; changes: GitChange[]; localPath: string }> => {
        const res = await fetch(`${API_URL}/repos/${repoId}/git/status`, { headers: getAuthHeaders() });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Falha ao obter status Git');
        }
        return res.json();
    },

    getRepoFileDiff: async (repoId: string, file: string, staged: boolean = false): Promise<{ diff: string }> => {
        const res = await fetch(`${API_URL}/repos/${repoId}/git/diff?file=${encodeURIComponent(file)}&staged=${staged}`, { headers: getAuthHeaders() });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Falha ao obter diff do arquivo');
        }
        return res.json();
    },

    getRepoBranches: async (repoId: string): Promise<{ branches: string[]; currentBranch: string }> => {
        const res = await fetch(`${API_URL}/repos/${repoId}/git/branches`, { headers: getAuthHeaders() });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Falha ao listar branches');
        }
        return res.json();
    },

    stageFiles: async (repoId: string, files: string[]): Promise<void> => {
        const res = await fetch(`${API_URL}/repos/${repoId}/git/stage`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ files })
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Falha ao adicionar arquivos ao stage');
        }
    },

    unstageFiles: async (repoId: string, files: string[]): Promise<void> => {
        const res = await fetch(`${API_URL}/repos/${repoId}/git/unstage`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ files })
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Falha ao remover arquivos do stage');
        }
    },

    commitRepoChanges: async (repoId: string, message: string, files?: string[]): Promise<void> => {
        const res = await fetch(`${API_URL}/repos/${repoId}/git/commit`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ message, files })
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Falha ao realizar commit');
        }
    },

    pushRepo: async (repoId: string, remote?: string, branch?: string): Promise<{ message: string }> => {
        const res = await fetch(`${API_URL}/repos/${repoId}/git/push`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ remote: remote || 'origin', branch })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Falha ao realizar push');
        return data;
    },

    pullRepo: async (repoId: string, remote?: string, branch?: string): Promise<{ message: string }> => {
        const res = await fetch(`${API_URL}/repos/${repoId}/git/pull`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ remote: remote || 'origin', branch })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Falha ao realizar pull');
        return data;
    },

    checkoutBranch: async (repoId: string, branch: string): Promise<void> => {
        const res = await fetch(`${API_URL}/repos/${repoId}/git/checkout`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ branch })
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Falha ao realizar checkout');
        }
    },

    createBranch: async (repoId: string, name: string, checkout?: boolean): Promise<{ branch: string }> => {
        const res = await fetch(`${API_URL}/repos/${repoId}/git/branch`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ name, checkout: checkout !== false })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Falha ao criar branch');
        return data;
    },

    setRemoteUrl: async (repoId: string, url: string, remote?: string): Promise<void> => {
        const res = await fetch(`${API_URL}/repos/${repoId}/git/remote`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ url, remote: remote || 'origin' })
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Falha ao configurar remote');
        }
    },

    getRemotes: async (repoId: string): Promise<{ remotes: Record<string, string> }> => {
        const res = await fetch(`${API_URL}/repos/${repoId}/git/remotes`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('Falha ao carregar remotes');
        return res.json();
    },

    getRepoGitLog: async (repoId: string, opts?: { branch?: string; limit?: number; skip?: number; author?: string }): Promise<{ commits: GitCommit[]; total: number; limit: number; skip: number }> => {
        const params = new URLSearchParams();
        if (opts?.branch) params.set('branch', opts.branch);
        if (opts?.limit !== undefined) params.set('limit', String(opts.limit));
        if (opts?.skip !== undefined) params.set('skip', String(opts.skip));
        if (opts?.author) params.set('author', opts.author);
        const query = params.toString() ? `?${params.toString()}` : '';
        const res = await fetch(`${API_URL}/repos/${repoId}/git/log${query}`, { headers: getAuthHeaders() });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Falha ao obter log do Git');
        }
        return res.json();
    },

    syncGitlab: async (): Promise<{ success: boolean; message?: string; count?: number; error?: string }> => {
        const res = await fetch(`${API_URL}/integrations/gitlab/sync`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Falha ao sincronizar GitLab');
        }
        return res.json();
    },

    getDashboardStats: async (): Promise<{ totalCommits: number; weeklyCommits: number; contributions: Record<string, number>; failedRepos: number; failedRepoDetails: { id: string; name: string; reason: string }[] }> => {
        const res = await fetch(`${API_URL}/dashboard/stats`, { headers: getAuthHeaders() });
        await handleResponse(res, 'Falha ao obter estatísticas');
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Falha ao obter estatísticas');
        }
        return res.json();
    },

    // MVP-2: Environments
    getEnvironments: async (repoId?: string): Promise<any[]> => {
        const params = repoId ? `?repoId=${repoId}` : '';
        const res = await fetch(`${API_URL}/environments${params}`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('Falha ao carregar ambientes');
        return res.json();
    },

    getEnvironment: async (id: string): Promise<any> => {
        const res = await fetch(`${API_URL}/environments/${id}`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('Falha ao carregar ambiente');
        return res.json();
    },

    createEnvironment: async (data: { name: string; type: 'dev' | 'stage' | 'prod'; repoId: string; description?: string; internalNotes?: string }): Promise<any> => {
        const res = await fetch(`${API_URL}/environments`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const data2 = await res.json();
            throw new Error(data2.error || 'Falha ao criar ambiente');
        }
        return res.json();
    },

    updateEnvironment: async (id: string, data: { name?: string; type?: 'dev' | 'stage' | 'prod'; description?: string; internalNotes?: string }): Promise<any> => {
        const res = await fetch(`${API_URL}/environments/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Falha ao atualizar ambiente');
        return result;
    },

    deployToEnvironment: async (envId: string, data: { version: string; buildId?: string; pipelineId?: string; notes?: string }): Promise<any> => {
        const res = await fetch(`${API_URL}/environments/${envId}/deploy`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Falha no deploy');
        return result;
    },

    promoteEnvironment: async (targetEnvId: string, sourceEnvId: string): Promise<any> => {
        const res = await fetch(`${API_URL}/environments/${targetEnvId}/promote`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ sourceEnvironmentId: sourceEnvId })
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Falha na promoção');
        return result;
    },

    rollbackEnvironment: async (envId: string, deploymentId?: string): Promise<any> => {
        const res = await fetch(`${API_URL}/environments/${envId}/rollback`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ deploymentId })
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Falha no rollback');
        return result;
    },

    // Integrations
    getIntegrations: async (): Promise<any[]> => {
        const res = await fetch(`${API_URL}/integrations`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('Falha ao carregar integrações');
        return res.json();
    },

    connectGitlab: async (data: { token: string; username: string; gitlabUrl?: string }): Promise<any> => {
        const res = await fetch(`${API_URL}/integrations/gitlab`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Falha ao conectar GitLab');
        return result;
    },

    disconnectGitlab: async (): Promise<void> => {
        const res = await fetch(`${API_URL}/integrations/gitlab`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Falha ao desconectar GitLab');
    },

    connectClickUp: async (data: { apiToken: string; workspaceId: string; listId?: string; mcpAccessToken?: string; mcpWorkspaceId?: string }): Promise<any> => {
        const res = await fetch(`${API_URL}/integrations/clickup`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Falha ao conectar ClickUp');
        return result;
    },

    disconnectClickUp: async (): Promise<void> => {
        const res = await fetch(`${API_URL}/integrations/clickup`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Falha ao desconectar ClickUp');
    },

    syncClickUp: async (): Promise<any> => {
        const res = await fetch(`${API_URL}/integrations/clickup/sync`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Falha ao sincronizar ClickUp');
        return result;
    },

    getClickUpStatus: async (): Promise<any> => {
        const res = await fetch(`${API_URL}/integrations/clickup/status`, {
            headers: getAuthHeaders()
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Falha ao obter status do ClickUp');
        return result;
    },

    getClickUpTools: async (): Promise<any> => {
        const res = await fetch(`${API_URL}/integrations/clickup/tools`, {
            headers: getAuthHeaders()
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Falha ao obter tools do ClickUp MCP');
        return result;
    },

    executeClickUpMcpTool: async (data: { toolName: string; arguments?: Record<string, unknown>; dryRun?: boolean }): Promise<any> => {
        const res = await fetch(`${API_URL}/integrations/clickup/mcp/execute`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Falha ao executar tool do ClickUp MCP');
        return result;
    },

    startClickUpMcpOAuth: async (workspaceId?: string): Promise<{ success: boolean; authorizeUrl: string; state: string; expiresAt: string }> => {
        const res = await fetch(`${API_URL}/integrations/clickup/mcp/oauth/start`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ workspaceId }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Falha ao iniciar OAuth do ClickUp MCP');
        return result;
    },

    getClickUpMcpAudit: async (limit = 50): Promise<{ success: boolean; items: any[] }> => {
        const res = await fetch(`${API_URL}/integrations/clickup/mcp/audit?limit=${limit}`, {
            headers: getAuthHeaders()
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Falha ao obter trilha de auditoria MCP');
        return result;
    },

    // Admin
    getAdminUsers: async (): Promise<any[]> => {
        const res = await fetch(`${API_URL}/admin/users`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('Falha ao carregar usuários');
        return res.json();
    },

    createAdminUser: async (data: { name: string; email: string; password: string; role: string }): Promise<any> => {
        const res = await fetch(`${API_URL}/admin/users`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Falha ao criar usuário');
        return result;
    },

    updateAdminUser: async (userId: string, data: Record<string, any>): Promise<void> => {
        const res = await fetch(`${API_URL}/admin/users/${userId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const result = await res.json();
            throw new Error(result.error || 'Falha ao atualizar usuário');
        }
    },

    deleteAdminUser: async (userId: string): Promise<void> => {
        const res = await fetch(`${API_URL}/admin/users/${userId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Falha ao remover usuário');
    },

    getAdminGroups: async (): Promise<any[]> => {
        const res = await fetch(`${API_URL}/admin/groups`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('Falha ao carregar grupos');
        return res.json();
    },

    getAdminSettings: async (): Promise<any> => {
        const res = await fetch(`${API_URL}/admin/settings`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('Falha ao carregar configurações');
        return res.json();
    },

    saveAdminSettings: async (settings: Record<string, any>): Promise<void> => {
        const res = await fetch(`${API_URL}/admin/settings`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(settings)
        });
        if (!res.ok) {
            const result = await res.json();
            throw new Error(result.error || 'Falha ao salvar configurações');
        }
    },

    getPublicSettings: async (): Promise<{ allowSelfRegister: boolean }> => {
        const res = await fetch(`${API_URL}/settings/public`);
        if (!res.ok) throw new Error('Falha ao carregar configurações públicas');
        return res.json();
    },

    deleteAccount: async (): Promise<void> => {
        const res = await fetch(`${API_URL}/auth/me`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Falha ao excluir conta');
        }
    },

};
