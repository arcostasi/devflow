import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const SOURCE_EXTENSIONS = new Map([
    ['.js', 'JavaScript'], ['.jsx', 'JavaScript'], ['.mjs', 'JavaScript'], ['.cjs', 'JavaScript'],
    ['.ts', 'TypeScript'], ['.tsx', 'TypeScript'], ['.mts', 'TypeScript'], ['.cts', 'TypeScript'],
    ['.py', 'Python'], ['.java', 'Java'], ['.go', 'Go'], ['.rb', 'Ruby'], ['.php', 'PHP'],
    ['.vue', 'Vue'], ['.svelte', 'Svelte'], ['.rs', 'Rust'], ['.c', 'C'], ['.h', 'C'],
    ['.cpp', 'C++'], ['.cc', 'C++'], ['.cxx', 'C++'], ['.hpp', 'C++'], ['.cs', 'C#'],
    ['.swift', 'Swift'], ['.kt', 'Kotlin'], ['.kts', 'Kotlin'], ['.scala', 'Scala'],
    ['.groovy', 'Groovy'], ['.ex', 'Elixir'], ['.exs', 'Elixir'], ['.erl', 'Erlang'],
    ['.hrl', 'Erlang'], ['.hs', 'Haskell'], ['.lua', 'Lua'], ['.r', 'R'], ['.jl', 'Julia'],
    ['.dart', 'Dart'], ['.pl', 'Perl'], ['.pm', 'Perl'], ['.sh', 'Shell'], ['.bash', 'Shell'],
    ['.zsh', 'Shell'], ['.fish', 'Shell'], ['.ps1', 'PowerShell'], ['.psm1', 'PowerShell'],
    ['.fs', 'F#'], ['.fsx', 'F#'], ['.ml', 'OCaml'], ['.mli', 'OCaml'], ['.clj', 'Clojure'],
    ['.cljs', 'Clojure'], ['.elm', 'Elm'], ['.html', 'HTML'], ['.htm', 'HTML'],
    ['.css', 'CSS'], ['.scss', 'SCSS'], ['.sass', 'Sass'], ['.less', 'Less'],
    ['.md', 'Markdown'], ['.mdx', 'Markdown'], ['.sql', 'SQL'], ['.graphql', 'GraphQL'],
]);

const RESOLVABLE_EXTENSIONS = [...SOURCE_EXTENSIONS.keys()];
const IGNORED_DIRECTORIES = new Set([
    '.git', 'node_modules', 'dist', 'build', 'coverage', '.next', '.nuxt', '.cache',
    '.turbo', '.parcel-cache', '.vercel', '.idea', '.vscode', '__pycache__', '.venv',
    'venv', 'target', 'bin', 'obj', 'vendor', 'Pods',
]);
const MAX_FILES = 1_200;
const MAX_FILE_BYTES = 750_000;
const SEVERITY_PRIORITY = { critical: 0, high: 1, medium: 2, low: 3 };

const normalizePath = (value) => value.split(path.sep).join('/').replace(/^\.\//, '');
const isTestPath = (filePath) => /(^|\/)(__tests__|tests?|fixtures?|mocks?)(\/|$)|\.(test|spec)\.[^.]+$/i.test(filePath);

const getLanguage = (filePath) => SOURCE_EXTENSIONS.get(path.extname(filePath).toLowerCase()) || 'Other';

const detectLayer = (filePath) => {
    const normalized = `/${filePath.toLowerCase()}/`;
    if (/\/(components?|views?|pages?|screens?|ui)\//.test(normalized)) return 'Interface';
    if (/\/(routes?|controllers?|api)\//.test(normalized)) return 'API';
    if (/\/(services?|use-?cases?|domain)\//.test(normalized)) return 'Serviços';
    if (/\/(models?|entities?|schemas?|types?)\//.test(normalized)) return 'Domínio';
    if (/\/(data|database|db|repositories|migrations?)\//.test(normalized)) return 'Dados';
    if (/\/(tests?|__tests__|fixtures?|mocks?)\//.test(normalized)) return 'Testes';
    if (/\/(utils?|helpers?|lib|shared|common)\//.test(normalized)) return 'Utilitários';
    if (/\/(config|scripts?|tools?|\.github)\//.test(normalized)) return 'Infra';
    if (filePath.endsWith('.md') || filePath.endsWith('.mdx')) return 'Documentação';
    return 'Núcleo';
};

const walkFiles = (rootPath) => {
    const collected = [];
    const visit = (directory) => {
        if (collected.length >= MAX_FILES) return;
        let entries;
        try {
            entries = fs.readdirSync(directory, { withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of entries) {
            if (collected.length >= MAX_FILES) break;
            if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
            const absolutePath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                visit(absolutePath);
                continue;
            }
            if (!entry.isFile() || !SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
            try {
                const stats = fs.statSync(absolutePath);
                if (stats.size > MAX_FILE_BYTES) continue;
                collected.push({
                    absolutePath,
                    path: normalizePath(path.relative(rootPath, absolutePath)),
                    size: stats.size,
                });
            } catch {
                // A file can disappear during a scan; the remaining analysis is still useful.
            }
        }
    };
    visit(rootPath);
    return collected;
};

const extractFunctions = (content, language) => {
    const patterns = language === 'Python'
        ? [/^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/gm, /^\s*class\s+([A-Za-z_]\w*)/gm]
        : language === 'Ruby'
            ? [/^\s*def\s+([A-Za-z_]\w*[!?=]?)\b/gm, /^\s*class\s+([A-Za-z_]\w*)/gm]
            : language === 'Go'
                ? [/^\s*func\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)\s*\(/gm]
                : [
                    /\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g,
                    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g,
                    /^\s*(?:public\s+|private\s+|protected\s+|static\s+|async\s+)*(?:[\w<>,[\]?]+\s+)?([A-Za-z_$][\w$]*)\s*\([^;{}]*\)\s*\{/gm,
                    /^\s*(?:export\s+)?(?:default\s+)?class\s+([A-Za-z_$][\w$]*)/gm,
                ];

    const functions = new Map();
    for (const pattern of patterns) {
        for (const match of content.matchAll(pattern)) {
            const name = match[1];
            if (!name || ['if', 'for', 'while', 'switch', 'catch'].includes(name)) continue;
            const line = content.slice(0, match.index).split('\n').length;
            functions.set(`${name}:${line}`, { name, line });
        }
    }
    return [...functions.values()];
};

const extractImportTargets = (content, language) => {
    const targets = new Set();
    const addMatches = (pattern) => {
        for (const match of content.matchAll(pattern)) {
            if (match[1]) targets.add(match[1].trim());
        }
    };

    if (['JavaScript', 'TypeScript', 'Vue', 'Svelte'].includes(language)) {
        addMatches(/\b(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g);
        addMatches(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
        addMatches(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
    } else if (language === 'Python') {
        addMatches(/^\s*from\s+([.\w]+)\s+import\s+/gm);
        addMatches(/^\s*import\s+([.\w]+)/gm);
    } else if (language === 'Go') {
        addMatches(/^\s*import\s+"([^"]+)"/gm);
    } else if (['C', 'C++'].includes(language)) {
        addMatches(/^\s*#include\s+["<]([^">]+)[">]/gm);
    } else if (language === 'Markdown') {
        addMatches(/\[[^\]]*\]\((?!https?:|mailto:|#)([^)#]+)(?:#[^)]+)?\)/g);
        addMatches(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g);
    }
    return [...targets];
};

const calculateComplexity = (content) => {
    const decisions = content.match(/\b(if|else\s+if|for|while|case|catch)\b|&&|\|\||\?/g)?.length || 0;
    return Math.max(1, decisions + 1);
};

const resolveDependency = (fromPath, rawTarget, knownPaths) => {
    const normalizedTarget = rawTarget.replace(/[?#].*$/, '').replace(/\\/g, '/');
    if (!normalizedTarget) return null;

    let base;
    if (normalizedTarget.startsWith('.')) {
        base = normalizePath(path.posix.normalize(path.posix.join(path.posix.dirname(fromPath), normalizedTarget)));
    } else if (normalizedTarget.startsWith('/')) {
        base = normalizedTarget.slice(1);
    } else {
        const pythonTarget = normalizedTarget.replace(/^\.+/, '').replace(/\./g, '/');
        const suffixMatches = [...knownPaths].filter((candidate) =>
            candidate === normalizedTarget || candidate.startsWith(`${normalizedTarget}/`) ||
            candidate.endsWith(`/${normalizedTarget}`) || candidate.endsWith(`/${pythonTarget}.py`)
        );
        return suffixMatches.length === 1 ? suffixMatches[0] : null;
    }

    const candidates = [base];
    if (!path.posix.extname(base)) {
        for (const extension of RESOLVABLE_EXTENSIONS) candidates.push(`${base}${extension}`);
        for (const extension of RESOLVABLE_EXTENSIONS) candidates.push(`${base}/index${extension}`);
    }
    return candidates.find((candidate) => knownPaths.has(candidate)) || null;
};

const issue = (type, severity, title, description, file, line = 1) => ({
    id: `${type}:${file}:${line}:${title}`,
    type,
    severity,
    title,
    description,
    file,
    line,
});

const findLine = (content, index) => content.slice(0, index).split('\n').length;

const detectSecurityIssues = (file) => {
    if (isTestPath(file.path)) return [];
    const isScannerSource = (
        file.content.includes('detectSecurityIssues')
        && file.content.includes("type: 'hardcoded-secret'")
        && file.content.includes("type: 'sql-injection'")
    ) || (
        file.content.includes('CODEFLOW_ANALYZER_START')
        && file.content.includes('detectSecurity:function')
    );
    if (isScannerSource) return [];

    const rules = [
        {
            type: 'hardcoded-secret', severity: 'critical', title: 'Possível segredo hardcoded',
            description: 'Mova credenciais para variáveis de ambiente ou um cofre de segredos.',
            pattern: /\b(api[_-]?key|secret|password|token|private[_-]?key)\b\s*[:=]\s*['"][^'"\n]{8,}['"]/gi,
            validate: (match) => !/['"](?:\*+|x+|redacted|placeholder|example|changeme|your[_-]?\w+)['"]$/i.test(match[0]),
        },
        {
            type: 'dynamic-execution', severity: 'critical', title: 'Execução dinâmica de código',
            description: 'Evite eval e construtores dinâmicos; valide e interprete entradas com APIs específicas.',
            pattern: /\beval\s*\(|\bnew\s+Function\s*\(/g,
        },
        {
            type: 'command-execution', severity: 'high', title: 'Comando de shell construído dinamicamente',
            description: 'Use execução parametrizada e uma lista explícita de comandos permitidos.',
            pattern: /\b(exec|execSync|system|spawn)\s*\(\s*(?:`[^`]*\$\{|[^,\n]*\+)/g,
        },
        {
            type: 'sql-injection', severity: 'high', title: 'Consulta SQL construída dinamicamente',
            description: 'Use queries parametrizadas para impedir injeção SQL.',
            pattern: /\b(?:SELECT\s+.+\s+FROM|INSERT\s+INTO|UPDATE\s+[A-Za-z_][\w.]*\s+SET|DELETE\s+FROM)\b[^;\n]*(?:\$\{(?!updates\.join)[^}]+\}|['"]\s*\+\s*(?:req\.|request\.|input|user))/gi,
        },
        {
            type: 'unsafe-html', severity: 'high', title: 'Renderização de HTML não confiável',
            description: 'Sanitize o conteúdo antes de usar innerHTML ou dangerouslySetInnerHTML.',
            pattern: /\bdangerouslySetInnerHTML\b|\.innerHTML\s*=/g,
        },
    ];

    return rules.flatMap((rule) => [...file.content.matchAll(rule.pattern)]
        .filter((match) => !rule.validate || rule.validate(match))
        .map((match) => issue(rule.type, rule.severity, rule.title, rule.description, file.path, findLine(file.content, match.index))));
};

const detectPatterns = (files) => {
    const definitions = [
        ['singleton', 'Singleton', /\bgetInstance\s*\(|\b_instance\b|\bsingleton\b/i],
        ['factory', 'Factory', /\b(create|build|make)[A-Z][A-Za-z0-9_]*\s*\(|\bfactory\b/i],
        ['observer', 'Observer / eventos', /\b(addEventListener|subscribe|publish|emit|on)\s*\(/i],
        ['react-hook', 'React hooks', /\buse[A-Z][A-Za-z0-9_]*\s*\(/],
        ['middleware', 'Middleware', /\b(next|middleware)\b|\.(use)\s*\(/i],
    ];
    return definitions.map(([type, label, pattern]) => {
        const matches = files.filter((file) => pattern.test(file.content)).map((file) => file.path);
        return { type, label, count: matches.length, files: matches.slice(0, 24) };
    }).filter((pattern) => pattern.count > 0);
};

const findCycles = (filesByPath) => {
    const cycles = [];
    const visiting = new Set();
    const visited = new Set();
    const stack = [];

    const visit = (filePath) => {
        if (cycles.length >= 20 || visited.has(filePath)) return;
        if (visiting.has(filePath)) {
            const start = stack.indexOf(filePath);
            const cycle = [...stack.slice(start), filePath];
            const signature = [...new Set(cycle)].sort().join('|');
            if (!cycles.some((current) => [...new Set(current)].sort().join('|') === signature)) cycles.push(cycle);
            return;
        }
        visiting.add(filePath);
        stack.push(filePath);
        for (const dependency of filesByPath.get(filePath)?.dependencies || []) visit(dependency);
        stack.pop();
        visiting.delete(filePath);
        visited.add(filePath);
    };

    for (const filePath of filesByPath.keys()) visit(filePath);
    return cycles;
};

const readGitSignals = (rootPath, knownPaths) => {
    const churn = new Map();
    const owners = new Map();
    const changedFiles = [];
    const runGit = (args) => {
        try {
            return execFileSync('git', args, {
                cwd: rootPath,
                encoding: 'utf8',
                timeout: 5_000,
                maxBuffer: 8 * 1024 * 1024,
                stdio: ['ignore', 'pipe', 'ignore'],
            });
        } catch {
            return '';
        }
    };

    const log = runGit(['log', '-n', '350', '--format=__CODEFLOW_AUTHOR__%an', '--name-only']);
    let author = 'Desconhecido';
    for (const line of log.split(/\r?\n/)) {
        if (line.startsWith('__CODEFLOW_AUTHOR__')) {
            author = line.slice('__CODEFLOW_AUTHOR__'.length).trim() || 'Desconhecido';
            continue;
        }
        const filePath = normalizePath(line.trim());
        if (!knownPaths.has(filePath)) continue;
        churn.set(filePath, (churn.get(filePath) || 0) + 1);
        if (!owners.has(filePath)) owners.set(filePath, new Map());
        const fileOwners = owners.get(filePath);
        fileOwners.set(author, (fileOwners.get(author) || 0) + 1);
    }

    for (const line of runGit(['status', '--porcelain']).split(/\r?\n/)) {
        if (!line) continue;
        const rawPath = line.slice(3).trim().replace(/^"|"$/g, '').split(' -> ').pop();
        const filePath = normalizePath(rawPath);
        if (knownPaths.has(filePath)) changedFiles.push(filePath);
    }

    const ownerByFile = new Map();
    for (const [filePath, counts] of owners) {
        const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
        const total = sorted.reduce((sum, [, count]) => sum + count, 0);
        if (sorted[0]) ownerByFile.set(filePath, { name: sorted[0][0], share: Math.round((sorted[0][1] / total) * 100) });
    }
    return { churn, owners: ownerByFile, changedFiles: [...new Set(changedFiles)] };
};

const getImpactedFiles = (changedFiles, filesByPath) => {
    const impacted = new Set(changedFiles);
    const queue = [...changedFiles];
    while (queue.length > 0) {
        const current = queue.shift();
        for (const dependent of filesByPath.get(current)?.dependents || []) {
            if (impacted.has(dependent)) continue;
            impacted.add(dependent);
            queue.push(dependent);
        }
    }
    return [...impacted];
};

const calculateHealth = ({ files, issues, cycles, deadFunctions }) => {
    const severityPenalty = { critical: 8, high: 5, medium: 0.75, low: 0.25 };
    const issuePenalty = Math.min(40, issues.reduce((sum, current) => sum + (severityPenalty[current.severity] || 0.5), 0));
    const deadPenalty = Math.min(8, Math.round(deadFunctions.length / Math.max(2, files.length / 20)));
    const score = Math.round(Math.max(0, Math.min(100, 100 - issuePenalty - cycles.length * 4 - deadPenalty)));
    const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';
    return { score, grade };
};

export const analyzeRepository = (rootPath) => {
    const startedAt = performance.now();
    const descriptors = walkFiles(rootPath);
    const knownPaths = new Set(descriptors.map((file) => file.path));
    const internalFiles = descriptors.map((descriptor) => {
        const content = fs.readFileSync(descriptor.absolutePath, 'utf8');
        const language = getLanguage(descriptor.path);
        return {
            ...descriptor,
            content,
            language,
            layer: detectLayer(descriptor.path),
            lines: content ? content.split(/\r?\n/).length : 0,
            functions: extractFunctions(content, language),
            importTargets: extractImportTargets(content, language),
            dependencies: [],
            dependents: [],
            complexity: calculateComplexity(content),
        };
    });
    const filesByPath = new Map(internalFiles.map((file) => [file.path, file]));

    for (const file of internalFiles) {
        file.dependencies = [...new Set(file.importTargets
            .map((target) => resolveDependency(file.path, target, knownPaths))
            .filter(Boolean))];
        for (const dependency of file.dependencies) filesByPath.get(dependency).dependents.push(file.path);
    }

    const cycles = findCycles(filesByPath);
    const securityIssues = internalFiles.flatMap(detectSecurityIssues);
    const architectureIssues = [];
    for (const file of internalFiles) {
        if (file.lines >= 700 || file.functions.length >= 24) {
            architectureIssues.push(issue('god-file', 'medium', 'Arquivo concentra responsabilidades', `${file.lines} linhas e ${file.functions.length} símbolos detectados. Considere separar responsabilidades.`, file.path));
        }
        if (file.dependencies.length >= 9) {
            architectureIssues.push(issue('high-coupling', 'medium', 'Acoplamento de saída elevado', `${file.dependencies.length} dependências diretas aumentam o custo de mudança.`, file.path));
        }
        if (file.dependents.length >= 12) {
            architectureIssues.push(issue('high-fan-in', 'medium', 'Arquivo crítico para o sistema', `${file.dependents.length} arquivos dependem diretamente deste módulo.`, file.path));
        }
        if (!isTestPath(file.path) && /\bconsole\.(log|debug)\s*\(/.test(file.content)) {
            architectureIssues.push(issue('debug-code', 'low', 'Saída de debug em código de produto', 'Remova logs ocasionais ou use o logger estruturado do projeto.', file.path, findLine(file.content, file.content.search(/\bconsole\.(log|debug)\s*\(/))));
        }
    }
    cycles.forEach((cycle, index) => architectureIssues.push(issue('circular-dependency', 'high', 'Dependência circular', cycle.join(' → '), cycle[0], index + 1)));

    const symbolCounts = new Map();
    for (const file of internalFiles) {
        for (const fn of file.functions) {
            const pattern = new RegExp(`\\b${fn.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
            const occurrences = internalFiles.reduce((total, current) => total + (current.content.match(pattern)?.length || 0), 0);
            symbolCounts.set(`${file.path}:${fn.line}:${fn.name}`, occurrences);
        }
    }
    const deadFunctions = internalFiles.flatMap((file) => file.functions
        .filter((fn) => (symbolCounts.get(`${file.path}:${fn.line}:${fn.name}`) || 0) <= 1 && !/^(main|render|setup|init|default)$/i.test(fn.name))
        .map((fn) => ({ file: file.path, name: fn.name, line: fn.line }))
    ).slice(0, 120);

    const gitSignals = readGitSignals(rootPath, knownPaths);
    const impactedFiles = getImpactedFiles(gitSignals.changedFiles, filesByPath);
    const allIssues = [...securityIssues, ...architectureIssues];
    const health = calculateHealth({ files: internalFiles, issues: allIssues, cycles, deadFunctions });

    const languageTotals = new Map();
    const layerTotals = new Map();
    for (const file of internalFiles) {
        const language = languageTotals.get(file.language) || { language: file.language, files: 0, lines: 0 };
        language.files += 1;
        language.lines += file.lines;
        languageTotals.set(file.language, language);
        layerTotals.set(file.layer, (layerTotals.get(file.layer) || 0) + 1);
    }

    const files = internalFiles.map((file) => ({
        path: file.path,
        name: path.posix.basename(file.path),
        folder: path.posix.dirname(file.path) === '.' ? 'root' : path.posix.dirname(file.path),
        language: file.language,
        layer: file.layer,
        lines: file.lines,
        size: file.size,
        functions: file.functions,
        dependencies: file.dependencies,
        dependents: [...new Set(file.dependents)],
        churn: gitSignals.churn.get(file.path) || 0,
        owner: gitSignals.owners.get(file.path) || null,
        complexity: file.complexity,
        changed: gitSignals.changedFiles.includes(file.path),
    })).sort((a, b) => b.dependents.length - a.dependents.length || b.churn - a.churn || a.path.localeCompare(b.path));

    return {
        generatedAt: new Date().toISOString(),
        durationMs: Math.round(performance.now() - startedAt),
        truncated: descriptors.length >= MAX_FILES,
        stats: {
            files: files.length,
            lines: files.reduce((sum, file) => sum + file.lines, 0),
            functions: files.reduce((sum, file) => sum + file.functions.length, 0),
            dependencies: files.reduce((sum, file) => sum + file.dependencies.length, 0),
            folders: new Set(files.map((file) => file.folder)).size,
            securityIssues: securityIssues.length,
            architectureIssues: architectureIssues.length,
            circularDependencies: cycles.length,
            deadFunctions: deadFunctions.length,
            healthScore: health.score,
            grade: health.grade,
        },
        files,
        connections: files.flatMap((file) => file.dependencies.map((target) => ({ source: file.path, target }))),
        languageBreakdown: [...languageTotals.values()].sort((a, b) => b.lines - a.lines),
        layers: [...layerTotals.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
        securityIssues,
        issues: allIssues.sort((a, b) => SEVERITY_PRIORITY[a.severity] - SEVERITY_PRIORITY[b.severity]),
        patterns: detectPatterns(internalFiles),
        cycles,
        deadFunctions,
        changedFiles: gitSignals.changedFiles,
        impactedFiles,
        hotspots: files.slice().sort((a, b) => (b.churn + b.dependents * 2 + b.complexity / 4) - (a.churn + a.dependents * 2 + a.complexity / 4)).slice(0, 12).map((file) => file.path),
    };
};
