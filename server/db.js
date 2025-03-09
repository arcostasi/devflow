import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, '../devflow.db');
const db = new Database(dbPath);

// Initialize Schema
const schema = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    password TEXT,
    avatar TEXT,
    role TEXT DEFAULT 'user',
    status TEXT DEFAULT 'active',
    preferences TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    permissions TEXT
  );

  CREATE TABLE IF NOT EXISTS user_groups (
    userId TEXT,
    groupId TEXT,
    PRIMARY KEY (userId, groupId),
    FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(groupId) REFERENCES groups(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS sprints (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    goal TEXT,
    startDate TEXT,
    endDate TEXT,
    status TEXT
  );

  CREATE TABLE IF NOT EXISTS repositories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT,
    lastUpdated TEXT,
    branch TEXT,
    issues INTEGER DEFAULT 0,
    localPath TEXT
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL,
    priority TEXT NOT NULL,
    assigneeId TEXT,
    pairAssigneeId TEXT,
    storyPoints INTEGER,
    tags TEXT,
    sprintId TEXT,
    repositoryId TEXT,
    timeSpent INTEGER DEFAULT 0,
    xpPractices TEXT,
    FOREIGN KEY(assigneeId) REFERENCES users(id),
    FOREIGN KEY(pairAssigneeId) REFERENCES users(id),
    FOREIGN KEY(sprintId) REFERENCES sprints(id),
    FOREIGN KEY(repositoryId) REFERENCES repositories(id)
  );

  CREATE TABLE IF NOT EXISTS subtasks (
    id TEXT PRIMARY KEY,
    taskId TEXT NOT NULL,
    text TEXT NOT NULL,
    done INTEGER DEFAULT 0,
    FOREIGN KEY(taskId) REFERENCES tasks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    taskId TEXT NOT NULL,
    authorId TEXT NOT NULL,
    text TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    FOREIGN KEY(taskId) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY(authorId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT NOT NULL,
    targetType TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    meta TEXT,
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS integrations (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    provider TEXT NOT NULL,
    token TEXT NOT NULL,
    meta TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
  );

  -- MVP-1: Pipelines table for CI/CD tracking
  CREATE TABLE IF NOT EXISTS pipelines (
    id TEXT PRIMARY KEY,
    taskId TEXT,
    repoId TEXT NOT NULL,
    gitlabPipelineId TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    stages TEXT,
    webUrl TEXT,
    ref TEXT,
    sha TEXT,
    createdAt TEXT,
    finishedAt TEXT,
    FOREIGN KEY(taskId) REFERENCES tasks(id) ON DELETE SET NULL,
    FOREIGN KEY(repoId) REFERENCES repositories(id) ON DELETE CASCADE
  );

  -- MVP-2: Environments table for deploy targets
  CREATE TABLE IF NOT EXISTS environments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'dev',
    repoId TEXT NOT NULL,
    currentVersion TEXT,
    currentBuildId TEXT,
    status TEXT DEFAULT 'unknown',
    lastDeployedAt TEXT,
    lastDeployedBy TEXT,
    FOREIGN KEY(repoId) REFERENCES repositories(id) ON DELETE CASCADE
  );

  -- MVP-2: Deployments history table
  CREATE TABLE IF NOT EXISTS deployments (
    id TEXT PRIMARY KEY,
    environmentId TEXT NOT NULL,
    repoId TEXT NOT NULL,
    version TEXT NOT NULL,
    buildId TEXT,
    pipelineId TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    deployedAt TEXT NOT NULL,
    deployedBy TEXT,
    rollbackOf TEXT,
    notes TEXT,
    FOREIGN KEY(environmentId) REFERENCES environments(id) ON DELETE CASCADE,
    FOREIGN KEY(repoId) REFERENCES repositories(id) ON DELETE CASCADE,
    FOREIGN KEY(pipelineId) REFERENCES pipelines(id) ON DELETE SET NULL
  );

  -- MVP-3: Policies table for gates
  CREATE TABLE IF NOT EXISTS policies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    conditions TEXT NOT NULL,
    actions TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
  );
`;

db.exec(schema);

// Migration: Add new columns to existing tasks table (preserves data)
const migrations = [
  "ALTER TABLE tasks ADD COLUMN type TEXT DEFAULT 'feature'",
  "ALTER TABLE tasks ADD COLUMN acceptanceCriteria TEXT",
  "ALTER TABLE tasks ADD COLUMN dorChecklist TEXT",
  "ALTER TABLE tasks ADD COLUMN dodChecklist TEXT",
  "ALTER TABLE tasks ADD COLUMN dependencies TEXT",
  "ALTER TABLE tasks ADD COLUMN risk TEXT DEFAULT 'medium'",
  "ALTER TABLE tasks ADD COLUMN linkedBranch TEXT",
  "ALTER TABLE tasks ADD COLUMN linkedPRUrl TEXT",
  "ALTER TABLE tasks ADD COLUMN linkedMRIid TEXT",
  "ALTER TABLE repositories ADD COLUMN remoteUrl TEXT",
  "ALTER TABLE repositories ADD COLUMN gitlabProjectPath TEXT",
];

for (const sql of migrations) {
  try {
    db.exec(sql);
  } catch (err) {
    // Column already exists, ignore
    if (!err.message.includes('duplicate column')) {
      console.warn('Migration warning:', err.message);
    }
  }
}

export default db;
