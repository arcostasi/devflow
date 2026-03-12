
// Task status: added 'ready' for "Pronto para Release" before done
export type TaskStatus = 'backlog' | 'todo' | 'doing' | 'review' | 'ready' | 'done';
export type Priority = 'low' | 'medium' | 'high';
export type ThemeMode = 'light' | 'dark' | 'system';
export type DensityMode = 'comfortable' | 'compact';

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
