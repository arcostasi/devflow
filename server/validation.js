import { z } from 'zod';

// --- Auth schemas ---

export const loginSchema = z.object({
  email: z.string().email('Formato de email inválido').max(255),
  password: z.string().min(1, 'Senha é obrigatória').max(255),
});

export const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').max(100),
  email: z.string().email('Formato de email inválido').max(255),
  password: z
    .string()
    .min(8, 'Senha deve ter ao menos 8 caracteres')
    .max(255)
    .regex(/[A-Z]/, 'Senha deve conter ao menos uma letra maiúscula')
    .regex(/[0-9]/, 'Senha deve conter ao menos um número'),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email('Formato de email inválido').max(255).optional(),
  avatar: z.string().url().max(2048).optional(),
  preferences: z.record(z.unknown()).optional(),
});

export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual é obrigatória').max(255),
  newPassword: z
    .string()
    .min(8, 'Nova senha deve ter ao menos 8 caracteres')
    .max(255)
    .regex(/[A-Z]/, 'Nova senha deve conter ao menos uma letra maiúscula')
    .regex(/[0-9]/, 'Nova senha deve conter ao menos um número'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token é obrigatório'),
});

// --- Task schemas ---

const taskStatusEnum = z.enum(['backlog', 'todo', 'doing', 'review', 'ready', 'done']);
const priorityEnum = z.enum(['low', 'medium', 'high']);
const taskTypeEnum = z.enum(['epic', 'feature', 'bug', 'tech_debt']);
const riskEnum = z.enum(['low', 'medium', 'high']);

export const createTaskSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1, 'Título é obrigatório').max(500),
  description: z.string().max(10000).optional().default(''),
  status: taskStatusEnum,
  priority: priorityEnum,
  assigneeId: z.string().max(64).nullable().optional(),
  pairAssigneeId: z.string().max(64).nullable().optional(),
  storyPoints: z.number().int().min(0).max(100).nullable().optional(),
  tags: z.array(z.string().max(50)).max(20).optional().default([]),
  sprintId: z.string().max(64).nullable().optional(),
  repositoryId: z.string().max(64).nullable().optional(),
  xpPractices: z.record(z.boolean()).optional().default({}),
  type: taskTypeEnum.optional().default('feature'),
  acceptanceCriteria: z.string().max(5000).nullable().optional(),
  dorChecklist: z.array(z.object({ id: z.string(), text: z.string(), checked: z.boolean() })).optional().default([]),
  dodChecklist: z.array(z.object({ id: z.string(), text: z.string(), checked: z.boolean() })).optional().default([]),
  dependencies: z.array(z.string().max(64)).optional().default([]),
  risk: riskEnum.optional().default('medium'),
  linkedBranch: z.string().max(255).nullable().optional(),
  linkedPRUrl: z.string().max(2048).nullable().optional(),
  linkedMRIid: z.string().max(64).nullable().optional(),
  subtasks: z.array(z.object({ id: z.string(), text: z.string(), done: z.boolean() })).optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).optional(),
  status: taskStatusEnum.optional(),
  priority: priorityEnum.optional(),
  assigneeId: z.string().max(64).nullable().optional(),
  pairAssigneeId: z.string().max(64).nullable().optional(),
  storyPoints: z.number().int().min(0).max(100).nullable().optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  sprintId: z.string().max(64).nullable().optional(),
  repositoryId: z.string().max(64).nullable().optional(),
  timeSpent: z.number().min(0).optional(),
  xpPractices: z.record(z.boolean()).optional(),
  type: taskTypeEnum.optional(),
  acceptanceCriteria: z.string().max(5000).nullable().optional(),
  dorChecklist: z.array(z.object({ id: z.string(), text: z.string(), checked: z.boolean() })).optional(),
  dodChecklist: z.array(z.object({ id: z.string(), text: z.string(), checked: z.boolean() })).optional(),
  dependencies: z.array(z.string().max(64)).optional(),
  risk: riskEnum.optional(),
  linkedBranch: z.string().max(255).nullable().optional(),
  linkedPRUrl: z.string().max(2048).nullable().optional(),
  linkedMRIid: z.string().max(64).nullable().optional(),
  subtasks: z.array(z.object({ id: z.string(), text: z.string(), done: z.boolean() })).optional(),
});

// --- Sprint schemas ---

export const createSprintSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  goal: z.string().max(2000).optional().default(''),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  status: z.enum(['active', 'future', 'completed']).optional().default('future'),
});

export const updateSprintSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  goal: z.string().max(2000).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(['active', 'future', 'completed']).optional(),
});

// --- Repo schemas ---

export const createRepoSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  description: z.string().max(2000).optional().default(''),
  branch: z.string().max(255).optional().default('main'),
  status: z.string().max(20).optional().default('active'),
  localPath: z.string().max(1024).optional(),
  linkExisting: z.boolean().optional(),
});

// --- Environment schemas ---

const envTypeEnum = z.enum(['dev', 'stage', 'prod']);

export const createEnvironmentSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  type: envTypeEnum,
  repoId: z.string().min(1).max(64),
  description: z.string().max(2000).optional(),
  internalNotes: z.string().max(5000).optional(),
});

export const updateEnvironmentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: envTypeEnum.optional(),
  description: z.string().max(2000).optional(),
  internalNotes: z.string().max(5000).optional(),
});

export const deployEnvironmentSchema = z.object({
  version: z.string().min(1).max(128).regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/, 'Formato de versão inválido'),
  buildId: z.string().max(128).optional(),
  pipelineId: z.string().max(128).optional(),
  notes: z.string().max(2000).optional(),
  force: z.boolean().optional(),
});

export const promoteEnvironmentSchema = z.object({
  sourceEnvironmentId: z.string().min(1, 'sourceEnvironmentId é obrigatório').max(64),
});

export const rollbackEnvironmentSchema = z.object({
  deploymentId: z.string().max(64).optional(),
});

// --- AI schemas ---

export const fillFieldSchema = z.object({
  fieldType: z.string().min(1, 'fieldType é obrigatório').max(100),
  context: z.record(z.unknown()).optional().default({}),
  instruction: z.string().max(2000).optional(),
  surface: z.string().max(50).optional(),
  intent: z.string().max(50).optional(),
  currentValue: z.string().max(10000).optional(),
  relatedEntities: z.record(z.unknown()).optional(),
  constraints: z.record(z.unknown()).optional(),
  retryOnGeneric: z.boolean().optional(),
});

// --- Validation middleware factory ---

/**
 * Express middleware that validates req.body against a Zod schema.
 * On failure returns 400 with structured issues array.
 */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issues = result.error.issues.map(i => ({
        field: i.path.join('.'),
        message: i.message,
      }));
      return res.status(400).json({ error: 'Dados inválidos', issues });
    }
    req.body = result.data;
    next();
  };
}
