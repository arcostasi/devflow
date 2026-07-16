import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Boxes,
  Braces,
  ChevronRight,
  CircleDot,
  Download,
  Eye,
  FileCode2,
  GitBranch,
  GitCompareArrows,
  Loader2,
  Network,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { api } from '../services/api';
import {
  CodeFlowAnalysis as CodeFlowAnalysisData,
  CodeFlowFile,
  CodeFlowSeverity,
  Repository,
  getErrorMessage,
} from '../types';

interface CodeFlowAnalysisProps {
  repo: Repository;
  addToast: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
  onOpenFile: (filePath: string) => void;
}

type AnalysisView = 'map' | 'diagnostics' | 'files';

const layerPalette: Record<string, { fill: string; stroke: string; text: string }> = {
  Interface: { fill: '#e0f2fe', stroke: '#38bdf8', text: '#075985' },
  API: { fill: '#ede9fe', stroke: '#8b5cf6', text: '#5b21b6' },
  Serviços: { fill: '#cffafe', stroke: '#06b6d4', text: '#155e75' },
  Domínio: { fill: '#dcfce7', stroke: '#22c55e', text: '#166534' },
  Dados: { fill: '#fef3c7', stroke: '#f59e0b', text: '#92400e' },
  Testes: { fill: '#fce7f3', stroke: '#ec4899', text: '#9d174d' },
  Utilitários: { fill: '#f1f5f9', stroke: '#94a3b8', text: '#334155' },
  Infra: { fill: '#ffedd5', stroke: '#f97316', text: '#9a3412' },
  Documentação: { fill: '#ecfccb', stroke: '#84cc16', text: '#3f6212' },
  Núcleo: { fill: '#e2e8f0', stroke: '#64748b', text: '#1e293b' },
};

const severityOrder: CodeFlowSeverity[] = ['critical', 'high', 'medium', 'low'];
const severityLabels: Record<CodeFlowSeverity, string> = {
  critical: 'Crítico',
  high: 'Alto',
  medium: 'Médio',
  low: 'Baixo',
};
const severityClasses: Record<CodeFlowSeverity, string> = {
  critical: 'border-red-300 bg-red-50 text-red-700 dark:border-red-500/25 dark:bg-red-500/[0.1] dark:text-red-300',
  high: 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-500/25 dark:bg-orange-500/[0.1] dark:text-orange-300',
  medium: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/[0.1] dark:text-amber-300',
  low: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300',
};

const formatNumber = (value: number) => new Intl.NumberFormat('pt-BR').format(value);
const shortPath = (value: string, max = 26) => value.length <= max ? value : `…${value.slice(-(max - 1))}`;

const getGradeClasses = (grade: CodeFlowAnalysisData['stats']['grade']) => {
  if (grade === 'A') return 'text-emerald-600 dark:text-emerald-300';
  if (grade === 'B') return 'text-primary-600 dark:text-primary-300';
  if (grade === 'C') return 'text-amber-600 dark:text-amber-300';
  return 'text-red-600 dark:text-red-300';
};

const Metric: React.FC<{ label: string; value: React.ReactNode; detail: string; icon: React.ElementType }> = ({ label, value, detail, icon: Icon }) => (
  <div className="min-w-0 border-l border-slate-200/80 pl-4 first:border-l-0 first:pl-0 dark:border-white/10">
    <div className="flex items-center gap-2 text-slate-400 dark:text-[var(--text-muted)]">
      <Icon className="h-3.5 w-3.5" />
      <p className="app-metric-label">{label}</p>
    </div>
    <p className="mt-2 text-2xl font-light tracking-tight text-slate-900 dark:text-[var(--text-primary)]">{value}</p>
    <p className="app-copy-compact mt-1 truncate">{detail}</p>
  </div>
);

interface GraphNode {
  file: CodeFlowFile;
  x: number;
  y: number;
}

const ArchitectureGraph: React.FC<{
  analysis: CodeFlowAnalysisData;
  selectedPath: string | null;
  onSelect: (file: CodeFlowFile) => void;
  query: string;
}> = ({ analysis, selectedPath, onSelect, query }) => {
  const graph = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const byPath = new Map(analysis.files.map((file) => [file.path, file]));
    const requested = new Set<string>();

    if (normalizedQuery) {
      for (const file of analysis.files) {
        if (!file.path.toLowerCase().includes(normalizedQuery)) continue;
        requested.add(file.path);
        file.dependencies.forEach((dependency) => requested.add(dependency));
        file.dependents.forEach((dependent) => requested.add(dependent));
      }
    }

    const ranked = analysis.files
      .filter((file) => !normalizedQuery || requested.has(file.path))
      .sort((a, b) => Number(b.changed) - Number(a.changed)
        || (b.dependents.length + b.dependencies.length) - (a.dependents.length + a.dependencies.length)
        || b.churn - a.churn)
      .slice(0, 90);
    const visiblePaths = new Set(ranked.map((file) => file.path));
    const layerNames = [...new Set(ranked.map((file) => file.layer))];
    const groups = new Map(layerNames.map((layer) => [layer, ranked.filter((file) => file.layer === layer)]));
    const maxGroupSize = Math.max(1, ...[...groups.values()].map((files) => files.length));
    const width = Math.max(680, layerNames.length * 195 + 100);
    const height = Math.max(420, maxGroupSize * 54 + 100);
    const columnWidth = (width - 140) / Math.max(1, layerNames.length);
    const nodes: GraphNode[] = [];

    layerNames.forEach((layer, layerIndex) => {
      const files = groups.get(layer) || [];
      files.forEach((file, fileIndex) => nodes.push({
        file,
        x: 70 + layerIndex * columnWidth,
        y: 66 + fileIndex * 54,
      }));
    });
    const nodeByPath = new Map(nodes.map((node) => [node.file.path, node]));
    const connections = analysis.connections
      .filter((connection) => visiblePaths.has(connection.source) && visiblePaths.has(connection.target))
      .map((connection) => ({ ...connection, sourceNode: nodeByPath.get(connection.source), targetNode: nodeByPath.get(connection.target) }))
      .filter((connection) => connection.sourceNode && connection.targetNode);
    return { width, height, nodes, connections, layers: layerNames, byPath };
  }, [analysis, query]);

  const relatedPaths = useMemo(() => {
    if (!selectedPath) return new Set<string>();
    const selected = graph.byPath.get(selectedPath);
    return new Set([selectedPath, ...(selected?.dependencies || []), ...(selected?.dependents || [])]);
  }, [graph.byPath, selectedPath]);

  if (graph.nodes.length === 0) {
    return (
      <div className="surface-empty flex min-h-[28rem] items-center justify-center rounded-2xl px-6 text-center">
        <div>
          <Search className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
          <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">Nenhum arquivo corresponde à busca.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-h-[42rem] min-h-[26rem] overflow-auto rounded-2xl border border-slate-200/75 bg-slate-50/70 dark:border-white/10 dark:bg-black/10">
      <svg
        viewBox={`0 0 ${graph.width} ${graph.height}`}
        className="min-h-[26rem] min-w-[42rem]"
        style={{ width: graph.width, height: graph.height }}
        role="img"
        aria-label="Mapa interativo de dependências do repositório"
      >
        <defs>
          <marker id="codeflow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
          </marker>
          <filter id="codeflow-node-shadow" x="-20%" y="-30%" width="140%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0f172a" floodOpacity="0.12" />
          </filter>
        </defs>
        {graph.layers.map((layer, index) => {
          const x = graph.nodes.find((node) => node.file.layer === layer)?.x || 0;
          return (
            <text key={layer} x={x} y="30" fill="#64748b" fontSize="11" fontWeight="700" letterSpacing="1.6">
              {layer.toUpperCase()} · {index + 1}
            </text>
          );
        })}
        {graph.connections.map((connection) => {
          const source = connection.sourceNode!;
          const target = connection.targetNode!;
          const highlighted = selectedPath === connection.source || selectedPath === connection.target;
          const dimmed = selectedPath && !highlighted;
          const sourceX = source.x + 154;
          const targetX = target.x;
          const midpoint = (sourceX + targetX) / 2;
          return (
            <path
              key={`${connection.source}:${connection.target}`}
              d={`M ${sourceX} ${source.y + 18} C ${midpoint} ${source.y + 18}, ${midpoint} ${target.y + 18}, ${targetX} ${target.y + 18}`}
              fill="none"
              stroke={highlighted ? '#0ea5e9' : '#94a3b8'}
              strokeWidth={highlighted ? 2 : 1}
              strokeOpacity={dimmed ? 0.08 : highlighted ? 0.9 : 0.28}
              markerEnd="url(#codeflow-arrow)"
              className="transition-all duration-200"
            />
          );
        })}
        {graph.nodes.map((node) => {
          const palette = layerPalette[node.file.layer] || layerPalette.Núcleo;
          const isSelected = selectedPath === node.file.path;
          const isRelated = relatedPaths.has(node.file.path);
          const dimmed = selectedPath && !isRelated;
          return (
            <g
              key={node.file.path}
              transform={`translate(${node.x} ${node.y})`}
              onClick={() => onSelect(node.file)}
              className="cursor-pointer transition-opacity duration-200"
              opacity={dimmed ? 0.28 : 1}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') onSelect(node.file);
              }}
              aria-label={`Selecionar ${node.file.path}`}
            >
              <rect
                width="154"
                height="36"
                rx="9"
                fill={palette.fill}
                stroke={isSelected ? '#0284c7' : node.file.changed ? '#f59e0b' : palette.stroke}
                strokeWidth={isSelected ? 2.5 : node.file.changed ? 2 : 1}
                filter={isSelected ? 'url(#codeflow-node-shadow)' : undefined}
              />
              {node.file.changed && <circle cx="143" cy="8" r="4" fill="#f59e0b" />}
              <text x="11" y="15" fill={palette.text} fontSize="10.5" fontWeight="700">
                {shortPath(node.file.name, 21)}
              </text>
              <text x="11" y="28" fill={palette.text} fillOpacity="0.68" fontSize="8.5">
                {node.file.dependencies.length} deps · {node.file.dependents.length} usos
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

const FileInspector: React.FC<{
  file: CodeFlowFile | null;
  analysis: CodeFlowAnalysisData;
  onClose: () => void;
  onSelectPath: (path: string) => void;
  onOpenFile: (path: string) => void;
}> = ({ file, analysis, onClose, onSelectPath, onOpenFile }) => {
  if (!file) {
    const changedCount = analysis.changedFiles.length;
    const blastCount = Math.max(0, analysis.impactedFiles.length - changedCount);
    return (
      <div className="surface-muted h-full rounded-2xl p-5">
        <p className="app-section-label">Impacto local</p>
        <div className="mt-5 flex items-end gap-3">
          <p className="text-4xl font-light text-slate-900 dark:text-white">{blastCount}</p>
          <p className="pb-1 text-sm text-slate-500 dark:text-slate-400">arquivos potencialmente afetados</p>
        </div>
        <p className="app-copy-compact mt-3">
          {changedCount > 0
            ? `${changedCount} arquivo(s) alterado(s) no working tree originam este blast radius.`
            : 'O working tree está limpo. Selecione um nó para inspecionar dependências e ownership.'}
        </p>
        {analysis.impactedFiles.length > 0 && (
          <div className="mt-5 space-y-1.5">
            {analysis.impactedFiles.slice(0, 8).map((filePath) => (
              <button key={filePath} onClick={() => onSelectPath(filePath)} className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs text-slate-600 transition-colors hover:bg-white/80 hover:text-primary-600 dark:text-slate-300 dark:hover:bg-white/[0.05] dark:hover:text-primary-300">
                <CircleDot className={`h-3 w-3 ${analysis.changedFiles.includes(filePath) ? 'text-amber-500' : 'text-primary-500'}`} />
                <span className="truncate font-mono">{filePath}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const relatedIssues = analysis.issues.filter((current) => current.file === file.path);
  return (
    <div className="surface-muted h-full rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="app-section-label">Arquivo selecionado</p>
          <h3 className="mt-2 truncate font-mono text-sm font-semibold text-slate-900 dark:text-white" title={file.path}>{file.path}</h3>
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white hover:text-slate-700 dark:hover:bg-white/[0.06] dark:hover:text-white" aria-label="Fechar detalhes">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div><p className="app-metric-label">Complexidade</p><p className="mt-1 text-lg font-medium text-slate-800 dark:text-white">{file.complexity}</p></div>
        <div><p className="app-metric-label">Churn</p><p className="mt-1 text-lg font-medium text-slate-800 dark:text-white">{file.churn}</p></div>
        <div><p className="app-metric-label">Linhas</p><p className="mt-1 text-lg font-medium text-slate-800 dark:text-white">{formatNumber(file.lines)}</p></div>
        <div><p className="app-metric-label">Símbolos</p><p className="mt-1 text-lg font-medium text-slate-800 dark:text-white">{file.functions.length}</p></div>
      </div>
      <div className="mt-5 rounded-xl border border-slate-200/75 bg-white/70 p-3 dark:border-white/10 dark:bg-black/10">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400"><UserRound className="h-3.5 w-3.5" /> Ownership</div>
        <p className="mt-1.5 text-sm font-medium text-slate-800 dark:text-slate-200">{file.owner ? `${file.owner.name} · ${file.owner.share}%` : 'Sem histórico Git suficiente'}</p>
      </div>
      {relatedIssues.length > 0 && (
        <div className="mt-5">
          <p className="app-metric-label">Sinais</p>
          <div className="mt-2 space-y-2">
            {relatedIssues.slice(0, 3).map((current) => <p key={current.id} className="text-xs leading-5 text-slate-600 dark:text-slate-300">{current.title}</p>)}
          </div>
        </div>
      )}
      <div className="mt-5 space-y-4">
        {[
          { label: 'Depende de', paths: file.dependencies },
          { label: 'Usado por', paths: file.dependents },
        ].map((group) => (
          <div key={group.label}>
            <p className="app-metric-label">{group.label} · {group.paths.length}</p>
            <div className="mt-1.5 space-y-1">
              {group.paths.slice(0, 5).map((filePath) => (
                <button key={filePath} onClick={() => onSelectPath(filePath)} className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs text-slate-600 transition-colors hover:bg-white/80 hover:text-primary-600 dark:text-slate-300 dark:hover:bg-white/[0.05] dark:hover:text-primary-300">
                  <ChevronRight className="h-3 w-3" /><span className="truncate font-mono">{filePath}</span>
                </button>
              ))}
              {group.paths.length === 0 && <p className="px-2 text-xs text-slate-400">Nenhum vínculo detectado.</p>}
            </div>
          </div>
        ))}
      </div>
      <button onClick={() => onOpenFile(file.path)} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700">
        <Eye className="h-4 w-4" /> Abrir código
      </button>
    </div>
  );
};

const DiagnosticsView: React.FC<{
  analysis: CodeFlowAnalysisData;
  onSelectFile: (path: string) => void;
}> = ({ analysis, onSelectFile }) => {
  const [severity, setSeverity] = useState<CodeFlowSeverity | 'all'>('all');
  const visibleIssues = analysis.issues.filter((current) => severity === 'all' || current.severity === severity);

  return (
    <div className="page-panel-grid xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.7fr)]">
      <section className="surface-card overflow-hidden rounded-[1.6rem]">
        <div className="surface-header panel-header-compact flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="app-section-label">Qualidade e segurança</p>
            <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">{analysis.issues.length} diagnósticos acionáveis</h3>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setSeverity('all')} className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${severity === 'all' ? 'border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-primary-300' : 'border-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.05]'}`}>Todos</button>
            {severityOrder.map((item) => (
              <button key={item} onClick={() => setSeverity(item)} className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${severity === item ? severityClasses[item] : 'border-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.05]'}`}>
                {severityLabels[item]} · {analysis.issues.filter((issue) => issue.severity === item).length}
              </button>
            ))}
          </div>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-white/10">
          {visibleIssues.length === 0 ? (
            <div className="surface-empty m-4 rounded-2xl px-6 py-12 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-emerald-500" />
              <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">Nenhum diagnóstico neste nível.</p>
            </div>
          ) : visibleIssues.map((current) => (
            <button key={current.id} onClick={() => onSelectFile(current.file)} className="group flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50/80 dark:hover:bg-white/[0.025]">
              <span className={`mt-0.5 inline-flex rounded-lg border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${severityClasses[current.severity]}`}>{severityLabels[current.severity]}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800 group-hover:text-primary-600 dark:text-slate-200 dark:group-hover:text-primary-300">{current.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{current.description}</p>
                <p className="mt-2 truncate font-mono text-[11px] text-slate-400">{current.file}:{current.line}</p>
              </div>
              <ChevronRight className="mt-1 h-4 w-4 flex-shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-primary-500" />
            </button>
          ))}
        </div>
      </section>
      <div className="panel-stack">
        <section className="surface-card rounded-[1.6rem] p-5">
          <p className="app-section-label">Padrões detectados</p>
          <div className="mt-4 space-y-3">
            {analysis.patterns.map((pattern) => (
              <div key={pattern.type} className="surface-muted flex items-center justify-between gap-3 rounded-xl px-3.5 py-3">
                <div><p className="text-sm font-medium text-slate-800 dark:text-slate-200">{pattern.label}</p><p className="mt-0.5 text-xs text-slate-400">{pattern.count} arquivo(s)</p></div>
                <Braces className="h-4 w-4 text-primary-500" />
              </div>
            ))}
            {analysis.patterns.length === 0 && <p className="text-sm text-slate-400">Nenhum padrão reconhecido.</p>}
          </div>
        </section>
        <section className="surface-card rounded-[1.6rem] p-5">
          <p className="app-section-label">Dívida estrutural</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="surface-muted rounded-xl p-3"><p className="text-2xl font-light text-slate-900 dark:text-white">{analysis.cycles.length}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">ciclos</p></div>
            <div className="surface-muted rounded-xl p-3"><p className="text-2xl font-light text-slate-900 dark:text-white">{analysis.deadFunctions.length}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">símbolos isolados</p></div>
          </div>
        </section>
      </div>
    </div>
  );
};

const FilesView: React.FC<{
  analysis: CodeFlowAnalysisData;
  query: string;
  onQueryChange: (query: string) => void;
  onSelectFile: (file: CodeFlowFile) => void;
}> = ({ analysis, query, onQueryChange, onSelectFile }) => {
  const files = analysis.files.filter((file) => file.path.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <section className="surface-card overflow-hidden rounded-[1.6rem]">
      <div className="surface-header panel-header-compact flex flex-wrap items-center justify-between gap-4">
        <div><p className="app-section-label">Inventário técnico</p><h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">Arquivos, ownership e acoplamento</h3></div>
        <label className="relative block w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Buscar caminho ou arquivo" className="app-input w-full rounded-xl py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30" />
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[54rem] text-left text-sm">
          <thead className="border-b border-slate-200/75 text-[10px] uppercase tracking-[0.14em] text-slate-400 dark:border-white/10">
            <tr><th className="px-5 py-3 font-semibold">Arquivo</th><th className="px-4 py-3 font-semibold">Camada</th><th className="px-4 py-3 font-semibold">Owner</th><th className="px-4 py-3 text-right font-semibold">Deps</th><th className="px-4 py-3 text-right font-semibold">Usos</th><th className="px-4 py-3 text-right font-semibold">Churn</th><th className="px-5 py-3 text-right font-semibold">Complexidade</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/10">
            {files.map((file) => (
              <tr key={file.path} onClick={() => onSelectFile(file)} className="cursor-pointer transition-colors hover:bg-slate-50/80 dark:hover:bg-white/[0.025]">
                <td className="max-w-md px-5 py-3.5"><div className="flex items-center gap-2.5"><FileCode2 className={`h-4 w-4 flex-shrink-0 ${file.changed ? 'text-amber-500' : 'text-primary-500'}`} /><div className="min-w-0"><p className="truncate font-mono text-xs font-medium text-slate-700 dark:text-slate-200">{file.path}</p><p className="mt-0.5 text-[11px] text-slate-400">{file.language} · {formatNumber(file.lines)} linhas</p></div></div></td>
                <td className="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-300">{file.layer}</td>
                <td className="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-300">{file.owner?.name || '—'}</td>
                <td className="px-4 py-3.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{file.dependencies.length}</td>
                <td className="px-4 py-3.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{file.dependents.length}</td>
                <td className="px-4 py-3.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{file.churn}</td>
                <td className="px-5 py-3.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{file.complexity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

const CodeFlowAnalysis: React.FC<CodeFlowAnalysisProps> = ({ repo, addToast, onOpenFile }) => {
  const [analysis, setAnalysis] = useState<CodeFlowAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<AnalysisView>('map');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const loadAnalysis = async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await api.getCodeFlowAnalysis(repo.id, refresh);
      setAnalysis(result);
      if (refresh) addToast('Análise atualizada', 'success', `${result.stats.files} arquivos analisados em ${result.durationMs} ms.`);
    } catch (error) {
      addToast('Falha na análise', 'error', getErrorMessage(error) || 'Não foi possível analisar o repositório local.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setAnalysis(null);
    setSelectedPath(null);
    setQuery('');
    loadAnalysis();
  }, [repo.id]);

  const selectedFile = useMemo(() => analysis?.files.find((file) => file.path === selectedPath) || null, [analysis, selectedPath]);

  const selectPath = (filePath: string) => {
    if (!analysis?.files.some((file) => file.path === filePath)) return;
    setSelectedPath(filePath);
    setView('map');
  };

  const exportAnalysis = () => {
    if (!analysis) return;
    const blob = new Blob([JSON.stringify(analysis, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `codeflow-${repo.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="surface-card flex min-h-[32rem] items-center justify-center rounded-[1.6rem]">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 dark:bg-primary-500/[0.1] dark:text-primary-300"><Loader2 className="h-5 w-5 animate-spin" /></div>
          <p className="mt-4 text-sm font-medium text-slate-700 dark:text-slate-200">Mapeando arquitetura do repositório…</p>
          <p className="mt-1 text-xs text-slate-400">Dependências, Git, segurança e padrões estão sendo correlacionados.</p>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="surface-empty rounded-[1.6rem] px-6 py-14 text-center">
        <AlertTriangle className="mx-auto h-9 w-9 text-amber-500" />
        <h3 className="mt-4 text-base font-semibold text-slate-800 dark:text-slate-200">Análise indisponível</h3>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Confirme se o caminho local do repositório continua acessível.</p>
        <button onClick={() => loadAnalysis(true)} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"><RefreshCw className="h-4 w-4" /> Tentar novamente</button>
      </div>
    );
  }

  return (
    <div className="panel-stack">
      <section className="surface-card overflow-hidden rounded-[1.6rem]">
        <div className="surface-header panel-header-block flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 dark:bg-primary-500/[0.1] dark:text-primary-300"><Network className="h-5 w-5" /></div>
            <div>
              <div className="flex flex-wrap items-center gap-2"><p className="app-section-label">CodeFlow integrado</p>{analysis.cache?.hit && <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-400 dark:border-white/10">cache</span>}</div>
              <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">Arquitetura e saúde do código</h2>
              <p className="app-copy-compact mt-1">Análise local gerada em {analysis.durationMs} ms · {new Date(analysis.generatedAt).toLocaleString('pt-BR')}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={exportAnalysis} className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/70 px-3.5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-primary-300 hover:text-primary-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:text-primary-300"><Download className="h-4 w-4" /> Exportar JSON</button>
            <button onClick={() => loadAnalysis(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-3.5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Atualizar</button>
          </div>
        </div>
        <div className="grid gap-5 px-6 py-5 sm:grid-cols-2 lg:grid-cols-5">
          <Metric label="Saúde" value={<span className={getGradeClasses(analysis.stats.grade)}>{analysis.stats.grade} <span className="text-base text-slate-400">{analysis.stats.healthScore}</span></span>} detail="score estrutural" icon={Activity} />
          <Metric label="Escala" value={formatNumber(analysis.stats.lines)} detail={`${analysis.stats.files} arquivos`} icon={FileCode2} />
          <Metric label="Conexões" value={formatNumber(analysis.stats.dependencies)} detail={`${analysis.stats.circularDependencies} ciclos`} icon={GitBranch} />
          <Metric label="Segurança" value={analysis.stats.securityIssues} detail="sinais encontrados" icon={ShieldAlert} />
          <Metric label="Blast radius" value={Math.max(0, analysis.impactedFiles.length - analysis.changedFiles.length)} detail={`${analysis.changedFiles.length} alterados`} icon={GitCompareArrows} />
        </div>
      </section>

      {analysis.truncated && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/[0.08] dark:text-amber-200">
          O repositório excede o limite de 1.200 arquivos analisáveis; diretórios gerados foram ignorados e o resultado foi truncado.
        </div>
      )}

      <div className="page-tabs flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-2" aria-label="Visões da análise CodeFlow">
          {[
            { id: 'map' as const, label: 'Mapa', icon: Network },
            { id: 'diagnostics' as const, label: 'Diagnósticos', icon: ShieldAlert },
            { id: 'files' as const, label: 'Arquivos', icon: Boxes },
          ].map((item) => (
            <button key={item.id} onClick={() => setView(item.id)} className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${view === item.id ? 'border-slate-200/80 bg-white/85 text-primary-600 shadow-sm dark:border-white/10 dark:bg-white/[0.08] dark:text-primary-300' : 'border-transparent text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-white/[0.04]'}`}>
              <item.icon className="h-4 w-4" /> {item.label}
            </button>
          ))}
        </nav>
        {view === 'map' && (
          <label className="relative block w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filtrar mapa" className="app-input w-full rounded-xl py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30" />
          </label>
        )}
      </div>

      {view === 'map' && (
        <div className="page-panel-grid xl:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="surface-card overflow-hidden rounded-[1.6rem]">
            <div className="surface-header panel-header-compact flex flex-wrap items-center justify-between gap-3">
              <div><p className="app-section-label">Mapa de dependências</p><p className="app-copy-compact mt-1">Selecione um módulo para realçar entradas, saídas e impacto.</p></div>
              <div className="flex flex-wrap gap-3 text-[11px] text-slate-400"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> alterado</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary-500" /> selecionado</span></div>
            </div>
            <div className="p-4"><ArchitectureGraph analysis={analysis} selectedPath={selectedPath} onSelect={(file) => setSelectedPath(file.path)} query={query} /></div>
          </section>
          <FileInspector file={selectedFile} analysis={analysis} onClose={() => setSelectedPath(null)} onSelectPath={selectPath} onOpenFile={onOpenFile} />
        </div>
      )}
      {view === 'diagnostics' && <DiagnosticsView analysis={analysis} onSelectFile={selectPath} />}
      {view === 'files' && <FilesView analysis={analysis} query={query} onQueryChange={setQuery} onSelectFile={(file) => { setSelectedPath(file.path); setView('map'); }} />}
    </div>
  );
};

export default CodeFlowAnalysis;
