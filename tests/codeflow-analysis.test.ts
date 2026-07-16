import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { analyzeRepository } from '../server/services/codeflow.js';

const temporaryDirectories: string[] = [];

const createRepository = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'devflow-codeflow-'));
  temporaryDirectories.push(root);
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.mkdirSync(path.join(root, 'tests'), { recursive: true });
  fs.mkdirSync(path.join(root, 'node_modules', 'ignored'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'a.ts'), "import { b } from './b';\nexport const a = () => b();\n");
  fs.writeFileSync(path.join(root, 'src', 'b.ts'), "import { a } from './a';\nexport function b() { return a.name; }\n");
  fs.writeFileSync(path.join(root, 'src', 'auth.ts'), "export const apiKey = 'live-secret-value-12345';\n");
  fs.writeFileSync(path.join(root, 'tests', 'auth.test.ts'), "const apiKey = 'fixture-secret-value-12345';\n");
  fs.writeFileSync(path.join(root, 'node_modules', 'ignored', 'vendor.js'), 'export const vendor = true;\n');
  return root;
};

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('CodeFlow repository analysis', () => {
  it('maps dependencies, cycles and security findings without scanning dependencies', () => {
    const root = createRepository();
    const analysis = analyzeRepository(root);

    expect(analysis.files.map((file) => file.path)).not.toContain('node_modules/ignored/vendor.js');
    expect(analysis.connections).toEqual(expect.arrayContaining([
      { source: 'src/a.ts', target: 'src/b.ts' },
      { source: 'src/b.ts', target: 'src/a.ts' },
    ]));
    expect(analysis.cycles).toHaveLength(1);
    expect(analysis.securityIssues).toHaveLength(1);
    expect(analysis.securityIssues[0]).toMatchObject({ type: 'hardcoded-secret', file: 'src/auth.ts' });
    expect(analysis.stats.healthScore).toBeLessThan(100);
  });

  it('uses local Git state to calculate change blast radius and ownership', () => {
    const root = createRepository();
    execFileSync('git', ['init'], { cwd: root });
    execFileSync('git', ['config', 'core.autocrlf', 'false'], { cwd: root });
    execFileSync('git', ['config', 'user.name', 'DevFlow Test'], { cwd: root });
    execFileSync('git', ['config', 'user.email', 'devflow@example.test'], { cwd: root });
    execFileSync('git', ['add', '.'], { cwd: root });
    execFileSync('git', ['commit', '-m', 'initial'], { cwd: root });
    fs.appendFileSync(path.join(root, 'src', 'b.ts'), '\nexport const changed = true;\n');

    const analysis = analyzeRepository(root);
    const file = analysis.files.find((current) => current.path === 'src/b.ts');

    expect(analysis.changedFiles).toContain('src/b.ts');
    expect(analysis.impactedFiles).toEqual(expect.arrayContaining(['src/b.ts', 'src/a.ts']));
    expect(file?.owner).toMatchObject({ name: 'DevFlow Test', share: 100 });
  });
});
