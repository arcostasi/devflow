
// Task status: added 'ready' for "Pronto para Release" before done
export type TaskStatus = 'backlog' | 'todo' | 'doing' | 'review' | 'ready' | 'done';
export type Priority = 'low' | 'medium' | 'high';
export type ThemeMode = 'light' | 'dark' | 'system';
export type DensityMode = 'comfortable' | 'compact';
export type AIFieldType =
  | 'task_title'
  | 'task_description'
  | 'task_tags'
  | 'profile_bio'
  | 'repo_name'
  | 'repo_description'
  | 'sprint_name'
  | 'sprint_goal'
  | 'environment_description'
  | 'internal_notes'
  | 'checklist_items'
  | 'branch_name'
  | 'commit_message'
  | 'deploy_notes'
  | 'comment_reply';
export type AIIntent =
  | 'generate'
  | 'refine'
  | 'suggest'
  | 'rewrite'
  | 'summarize'
  | 'expand';
export type AIFieldAssistVariant = 'inline' | 'compact' | 'expanded';
export type AISurface =
  | 'generic'
  | 'new_task_modal'
  | 'task_details'
  | 'task_comments'
  | 'task_git'
  | 'new_repo_modal'
  | 'manage_sprints_modal'
  | 'settings_profile'
  | 'environment_create'
  | 'environment_edit'
  | 'environment_inline'
  | 'environment_deploy'
  | 'git_commit';

export interface AIContextPayload {
  context: Record<string, unknown>;
  currentValue?: string;
  relatedEntities?: Record<string, unknown>;
  constraints?: Record<string, unknown>;
}

// MVP-1: New types for enhanced task model
export type TaskType = 'epic' | 'feature' | 'bug' | 'tech_debt';
export type RiskLevel = 'low' | 'medium' | 'high';
export type PipelineStatus = 'pending' | 'running' | 'success' | 'failed' | 'canceled';
export type EnvironmentType = 'dev' | 'stage' | 'prod';
export type EnvironmentStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

// Checklist item for DoR/DoD
export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

// Pipeline for CI tracking
export interface Pipeline {
  id: string;
  taskId?: string;
  repoId: string;
  gitlabPipelineId?: string;
  status: PipelineStatus;
  stages: PipelineStage[];
  webUrl?: string;
  ref?: string;
  sha?: string;
  createdAt: string;
  finishedAt?: string;
}

export interface PipelineStage {
  name: string;
  status: PipelineStatus;
}

// Environment for deploy targets
export interface Environment {
  id: string;
  name: string;
  type: EnvironmentType;
  repoId: string;
  description?: string;
  internalNotes?: string;
  currentVersion?: string;
  currentBuildId?: string;
  status: EnvironmentStatus;
  lastDeployedAt?: string;
  lastDeployedBy?: string;
}

// Deployment history record
export interface Deployment {
  id: string;
  environmentId: string;
  repoId: string;
  version: string;
  buildId?: string;
  pipelineId?: string;
  status: 'pending' | 'success' | 'failed' | 'rolled_back';
  deployedAt: string;
  deployedBy?: string;
  rollbackOf?: string;
  notes?: string;
}


export interface User {
  id: string;
  name: string;
  avatar: string;
}

export interface Comment {
  id: string;
  author: User;
  text: string;
  timestamp: string;
}

export interface Subtask {
  id: string;
  text: string;
  done: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'pdf' | 'code' | 'zip';
  url: string;
  size: string;
}

export interface Sprint {
  id: string;
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'future' | 'completed';
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  assignee?: User;
  pairAssignee?: User; // XP: Pair Programming
  storyPoints?: number; // Scrum: Estimation
  tags: string[];
  comments?: Comment[];
  subtasks?: Subtask[];
  attachments?: Attachment[];
  timeSpent?: number; // em segundos
  repositoryId?: string;
  sprintId?: string; // Scrum: Link to sprint
  xpPractices?: {
    tdd: boolean; // XP: Test Driven Development checked
    refactoring: boolean; // XP: Code cleaned
  };
  // MVP-1: Enhanced task fields for traceability
  type?: TaskType;
  acceptanceCriteria?: string;
  dorChecklist?: ChecklistItem[]; // Definition of Ready
  dodChecklist?: ChecklistItem[]; // Definition of Done
  dependencies?: string[]; // Array of task IDs
  risk?: RiskLevel;
  linkedBranch?: string;
  linkedPRUrl?: string;
  linkedMRIid?: string; // GitLab MR internal ID
}

export interface Repository {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'archived' | 'error';
  lastUpdated: string;
  branch: string;
  issues: number;
  localPath?: string;
  stars?: number;
}

export interface ActivityLog {
  id: string;
  user: User;
  action: string;
  target: string;
  targetType: 'repo' | 'pr' | 'issue' | 'commit' | 'sprint';
  taskId?: string;
  timestamp: string;
  meta?: string;
}

export interface GitChange {
  id: string;
  file: string;
  status: 'modified' | 'added' | 'deleted';
}

export interface FileNode {
  id: string;
  name: string;
  relativePath?: string; // full relative path from repo root, e.g. "src/components/Button.tsx"
  type: 'file' | 'folder';
  children?: FileNode[];
  language?: string;
}

export interface GitCommit {
  hash: string;
  fullHash: string;
  author: string;
  email: string;
  date: string;
  message: string;
  relativeDate: string;
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type: 'success' | 'error' | 'info';
}

export interface AIModelInfo {
  name: string;
  family?: string | null;
  parameterSize?: string | null;
  quantization?: string | null;
  size?: number;
}

export interface AIConfig {
  status: {
    available: boolean;
    url: string;
    version?: string | null;
    error?: string;
  };
  defaults: {
    model: string;
    language: string;
  };
  preferences: {
    model: string;
    language: string;
  };
  languageOptions: Array<{
    code: string;
    label: string;
  }>;
  models: AIModelInfo[];
}

export interface AIFillFieldResponse {
  value?: string;
  values?: string[];
  model: string;
  language: string;
  warning?: string;
  confidence?: 'low' | 'medium' | 'high';
  meta?: {
    fieldType?: AIFieldType;
    surface?: AISurface;
    intent?: AIIntent;
  };
}

export type RepoDetailTab = 'code' | 'issues' | 'settings';
export type GitIntegrationTab = 'changes' | 'source' | 'insights';

export interface WorkspaceNavigationTarget {
  source?: 'dashboard' | 'repo_list' | 'repo_detail' | 'activity' | 'command_palette';
  repoId?: string | null;
  taskId?: string | null;
  repoDetailTab?: RepoDetailTab;
  gitTab?: GitIntegrationTab;
}

export enum ViewState {
  DASHBOARD = 'dashboard',
  KANBAN = 'kanban', // Active Sprint
  BACKLOG = 'backlog', // Product Backlog
  REPOS = 'repos',
  REPO_DETAIL = 'repo_detail',
  GIT = 'git',
  ENVIRONMENTS = 'environments', // MVP-2: Deployment environments
  SETTINGS = 'settings',
  TEAM = 'team'
}
