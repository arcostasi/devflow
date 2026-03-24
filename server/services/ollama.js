import db from '../db.js';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const FALLBACK_MODEL = 'granite4:latest';
const FALLBACK_LANGUAGE = 'pt-BR';
const MAX_ARRAY_ITEMS = 8;
const MAX_CONTEXT_DEPTH = 4;

const AI_LANGUAGE_OPTIONS = [
    { code: 'pt-BR', label: 'Português (Brasil)' },
    { code: 'pt-PT', label: 'Português (Portugal)' },
    { code: 'en-US', label: 'English (US)' },
    { code: 'es-ES', label: 'Español' },
];

const FIELD_DEFINITIONS = {
    task_title: {
        kind: 'text',
        label: 'titulo de tarefa',
        objective: 'gerar um titulo curto, especifico e profissional para uma tarefa de software.',
        rules: [
            'maximo de 90 caracteres',
            'sem markdown',
            'sem aspas',
            'tom objetivo',
        ],
    },
    task_description: {
        kind: 'text',
        label: 'descricao de tarefa',
        objective: 'escrever uma descricao clara, coerente e util para execucao.',
        rules: [
            'texto natural e profissional',
            'incluir problema, objetivo, impacto e criterio de entrega quando houver contexto suficiente',
            'sem markdown complexo',
            'evitar introducoes genericas como esta tarefa, este item ou o objetivo principal do projeto',
        ],
    },
    task_tags: {
        kind: 'list',
        label: 'tags de tarefa',
        objective: 'sugerir tags uteis para organizacao e filtragem.',
        rules: [
            'entre 3 e 5 tags',
            'tags curtas',
            'sem hashtag',
            'sem duplicatas',
        ],
    },
    profile_bio: {
        kind: 'text',
        label: 'bio de perfil profissional',
        objective: 'escrever uma bio curta, natural e coerente para perfil de trabalho em software.',
        rules: [
            '1 a 3 frases',
            'tom profissional sem marketing exagerado',
            'evitar jargoes e frases institucionais prontas',
            'priorizar papel atual, responsabilidades e forma de atuacao quando houver contexto suficiente',
        ],
    },
    repo_name: {
        kind: 'text',
        label: 'nome de repositorio',
        objective: 'sugerir um nome tecnico curto e coerente para repositorio.',
        rules: [
            'usar kebab-case',
            'apenas letras minusculas, numeros e hifens',
            'evitar nomes genericos',
        ],
    },
    repo_description: {
        kind: 'text',
        label: 'descricao de repositorio',
        objective: 'resumir o proposito do repositorio de forma util para o time.',
        rules: [
            '1 a 3 frases',
            'incluir objetivo, dominio e responsabilidade principal',
            'sem linguagem promocional',
        ],
    },
    sprint_name: {
        kind: 'text',
        label: 'nome de sprint',
        objective: 'gerar um nome claro para a sprint.',
        rules: [
            'curto',
            'apropriado para planejamento agil',
            'evitar nomes vagos ou publicitarios',
        ],
    },
    sprint_goal: {
        kind: 'text',
        label: 'meta de sprint',
        objective: 'definir uma meta objetiva e mensuravel para a sprint.',
        rules: [
            '1 ou 2 frases',
            'foco em entrega e impacto',
            'sem generalidades vazias',
        ],
    },
    environment_description: {
        kind: 'text',
        label: 'descricao de ambiente',
        objective: 'descrever o papel operacional do ambiente de forma clara para o time.',
        rules: [
            '1 a 3 frases',
            'explicar objetivo, uso e grau de risco quando fizer sentido',
            'sem marketing',
            'se o tipo for stage, tratar como stage ou homologacao, nunca como producao',
        ],
    },
    internal_notes: {
        kind: 'text',
        label: 'notas internas',
        objective: 'registrar observacoes internas uteis para operacao e manutencao.',
        rules: [
            'texto objetivo',
            'incluir cuidados, dependencias, acessos, limitacoes ou combinados relevantes',
            'sem inventar informacoes ausentes',
        ],
    },
    checklist_items: {
        kind: 'list',
        label: 'checklist',
        objective: 'quebrar o trabalho em passos praticos e executaveis.',
        rules: [
            'entre 3 e 7 itens',
            'cada item deve ser concreto',
            'evitar duplicatas e frases vagas',
        ],
    },
    branch_name: {
        kind: 'text',
        label: 'nome de branch',
        objective: 'gerar um nome de branch padronizado e tecnico.',
        rules: [
            'usar lowercase',
            'usar hifens ou barras',
            'sem espacos',
            'refletir o trabalho tecnico real',
        ],
    },
    commit_message: {
        kind: 'text',
        label: 'mensagem de commit',
        objective: 'gerar uma mensagem de commit clara e profissional.',
        rules: [
            'uma unica linha',
            'preferir Conventional Commits quando fizer sentido',
            'sem ponto final',
        ],
    },
    deploy_notes: {
        kind: 'text',
        label: 'notas de deploy',
        objective: 'resumir o que entrou na versao para operacao.',
        rules: [
            'texto claro e objetivo',
            'mencionar melhorias, correcoes ou riscos quando houver contexto',
            'evitar frases vagas',
        ],
    },
    comment_reply: {
        kind: 'text',
        label: 'comentario',
        objective: 'sugerir um comentario coerente para contexto de trabalho.',
        rules: [
            'texto colaborativo e objetivo',
            'evitar promessas nao sustentadas',
            'responder ao contexto atual da tarefa e da conversa',
            'escrever como uma pessoa da equipe, nunca como assistente institucional',
        ],
    },
};

const INTENT_GUIDANCE = {
    generate: 'proponha um preenchimento inicial plausivel a partir do contexto disponivel, sem extrapolar fatos ausentes.',
    refine: 'mantenha os fatos centrais do valor atual e melhore clareza, especificidade e fluidez.',
    suggest: 'ofereca sugestoes diretamente utilizaveis, priorizando opcoes especificas e curtas.',
    rewrite: 'reescreva o conteudo atual preservando os fatos e corrigindo tom, clareza e aderencia ao contexto.',
    summarize: 'condense o contexto para uma versao curta, informativa e operacional.',
    expand: 'expanda apenas com detalhes que estejam apoiados no contexto; se faltar base, mantenha a resposta enxuta.',
};

const SURFACE_GUIDANCE = {
    generic: 'priorize utilidade pratica e responda de forma enxuta.',
    new_task_modal: 'considere criacao de tarefa: priorize clareza de execucao, impacto, dependencias e linguagem de backlog real.',
    task_details: 'considere detalhes da tarefa atual: mantenha consistencia com status, checklist, branch e descricao existente.',
    task_comments: 'considere a conversa da tarefa: responda ao ultimo contexto util da thread sem soar como resumo institucional.',
    task_git: 'considere o fluxo de codigo: use naming tecnico coerente com repo, branch e escopo da implementacao.',
    new_repo_modal: 'considere provisionamento de repositorio: diferencie criar novo de vincular existente e use pistas de dominio, pasta local e objetivo do servico.',
    manage_sprints_modal: 'considere planejamento de sprint: priorize foco de entrega, janela de datas e evite nomes duplicados ou slogans.',
    settings_profile: 'considere perfil profissional interno: escreva uma bio crivel, ancorada nas responsabilidades reais do usuario.',
    environment_create: 'considere cadastro operacional inicial do ambiente: descreva funcao, risco e uso esperado sem inventar infraestrutura inexistente.',
    environment_edit: 'considere manutencao operacional do ambiente: mencione tipo, versao, status, risco e historico relevante quando isso estiver no contexto.',
    environment_inline: 'considere edicao rapida do card do ambiente: responda de forma curta, direta e pronta para leitura em dashboard operacional.',
    environment_deploy: 'considere notas de deploy: destaque o que entrou, o risco e o que precisa de atencao imediata na operacao.',
    git_commit: 'considere historico de codigo: gere mensagens curtas e tecnicas, compatveis com fluxo de commit real.',
};

const LANGUAGE_GUIDANCE = {
    'pt-BR': [
        'escreva em portugues do brasil natural, direto e contemporaneo',
        'evite traducao literal, tom robótico e construcoes artificiais',
        'se o contexto mencionar stage, pode usar stage ou homologacao; nao traduza para producao intermediaria',
    ],
    'pt-PT': [
        'escreva em portugues europeu natural e direto',
        'evite traducao literal e frases promocionais',
    ],
    'en-US': [
        'write in natural, concise US English',
        'avoid corporate filler and literal translations',
    ],
    'es-ES': [
        'escribe en espanol natural, breve y profesional',
        'evita frases promocionales o traducciones literales',
    ],
};

const STOP_WORDS = new Set([
    'para', 'com', 'sem', 'uma', 'uns', 'umas', 'que', 'por', 'dos', 'das', 'nos', 'nas', 'ser',
    'mais', 'menos', 'muito', 'muita', 'muitas', 'muitos', 'como', 'deve', 'dever', 'pelo', 'pela',
    'sobre', 'entre', 'quando', 'onde', 'cada', 'ainda', 'esse', 'essa', 'isso', 'isto', 'seu',
    'sua', 'suas', 'seus', 'time', 'campo', 'texto', 'dados', 'valor', 'atual', 'gerar', 'sugerir',
    'tarefa', 'descricao', 'descrição', 'titulo', 'título', 'repositorio', 'repositório', 'ambiente',
    'notas', 'internas', 'comentario', 'comentário', 'sprint', 'nome', 'meta', 'branch', 'perfil',
]);

const GENERIC_PHRASES = [
    'melhorar performance',
    'garantir qualidade',
    'solucao escalavel',
    'solução escalável',
    'de forma clara',
    'de forma eficiente',
    'alinhado ao contexto',
    'contexto tecnico',
    'contexto técnico',
    'quando fizer sentido',
    'boas praticas',
    'boas práticas',
    'texto profissional',
    'tom profissional',
    'objetivo principal do projeto',
    'aprimorar a experiencia',
    'aprimorar a experiência',
];

const AWKWARD_PHRASES = [
    'producao intermedio',
    'produção intermédio',
    'testes aguçados',
    'teste aguçado',
    'implantação na producao',
    'implantacao na producao',
];

const RETRY_WARNING = 'A primeira resposta veio genérica; o sistema aplicou uma segunda tentativa mais restritiva.';
const LOW_CONTEXT_WARNING = 'Contexto limitado; a resposta foi gerada de forma mais conservadora.';

const getStoredSetting = (key, fallbackValue) => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row?.value || fallbackValue;
};

const parseUserPreferences = (user) => {
    if (!user?.preferences) return {};

    try {
        return JSON.parse(user.preferences);
    } catch (_err) {
        return {};
    }
};

const isTextGenerationModel = (model) => {
    const modelName = `${model?.name || ''} ${model?.model || ''}`.toLowerCase();
    if (!modelName) return false;
    if (model?.remote_host || modelName.includes(':cloud') || modelName.includes(' cloud')) return false;
    if (modelName.includes('embedding')) return false;
    if (modelName.includes('ocr')) return false;
    return true;
};

const sanitizeString = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const sanitizeRepoName = (value) => sanitizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

const sanitizeBranchName = (value) => sanitizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9/_\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/\/+/g, '/')
    .replace(/^-|-$/g, '')
    .slice(0, 120);

const sanitizeCommitMessage = (value) => sanitizeString(value)
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\.$/, '')
    .slice(0, 120);

const sanitizeArray = (values) => {
    if (!Array.isArray(values)) return [];

    const uniqueValues = [];
    for (const item of values) {
        const normalized = sanitizeString(item);
        if (!normalized) continue;
        if (uniqueValues.some((existing) => existing.toLowerCase() === normalized.toLowerCase())) continue;
        uniqueValues.push(normalized);
        if (uniqueValues.length >= MAX_ARRAY_ITEMS) break;
    }
    return uniqueValues;
};

const extractStringCandidate = (input, depth = 0) => {
    if (depth > 4 || input === null || input === undefined) return '';

    if (typeof input === 'string' || typeof input === 'number' || typeof input === 'boolean') {
        return sanitizeString(input);
    }

    if (Array.isArray(input)) {
        for (const item of input) {
            const candidate = extractStringCandidate(item, depth + 1);
            if (candidate) return candidate;
        }
        return '';
    }

    if (typeof input === 'object') {
        const preferredKeys = ['value', 'text', 'content', 'description', 'title', 'label', 'message'];
        for (const key of preferredKeys) {
            if (key in input) {
                const candidate = extractStringCandidate(input[key], depth + 1);
                if (candidate) return candidate;
            }
        }

        for (const value of Object.values(input)) {
            const candidate = extractStringCandidate(value, depth + 1);
            if (candidate) return candidate;
        }
    }

    return '';
};

const extractArrayCandidates = (input) => {
    if (Array.isArray(input)) {
        return input
            .map((item) => extractStringCandidate(item))
            .filter(Boolean);
    }

    const extracted = extractStringCandidate(input);
    return extracted ? [extracted] : [];
};

const parseModelJson = (rawText) => {
    if (!rawText) return null;

    try {
        return JSON.parse(rawText);
    } catch (_err) {
        const firstBrace = rawText.indexOf('{');
        const lastBrace = rawText.lastIndexOf('}');
        if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;

        try {
            return JSON.parse(rawText.slice(firstBrace, lastBrace + 1));
        } catch (_nestedErr) {
            return null;
        }
    }
};

const normalizeFieldResult = (fieldType, parsed) => {
    if (!parsed || typeof parsed !== 'object') {
        throw new Error('A resposta do modelo nao retornou JSON valido.');
    }

    if (fieldType === 'task_tags' || fieldType === 'checklist_items') {
        const values = sanitizeArray(extractArrayCandidates(parsed.values || parsed.items || parsed));
        if (values.length === 0) {
            throw new Error('A resposta do modelo nao trouxe itens utilizaveis.');
        }
        return { values };
    }

    let value = extractStringCandidate(parsed.value ?? parsed);
    if (!value) {
        throw new Error('A resposta do modelo nao trouxe um valor utilizavel.');
    }

    if (fieldType === 'repo_name') value = sanitizeRepoName(value);
    if (fieldType === 'branch_name') value = sanitizeBranchName(value);
    if (fieldType === 'commit_message') value = sanitizeCommitMessage(value);

    if (!value) {
        throw new Error('A resposta do modelo ficou vazia apos a normalizacao.');
    }

    return { value };
};

const normalizeForMatch = (value) => sanitizeString(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const sanitizeContextValue = (value, depth = 0) => {
    if (depth > MAX_CONTEXT_DEPTH || value === null || value === undefined) return undefined;

    if (typeof value === 'string') {
        const cleaned = sanitizeString(value);
        return cleaned || undefined;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }

    if (Array.isArray(value)) {
        const cleaned = value
            .map((item) => sanitizeContextValue(item, depth + 1))
            .filter((item) => item !== undefined);
        return cleaned.length > 0 ? cleaned : undefined;
    }

    if (typeof value === 'object') {
        const cleanedEntries = Object.entries(value)
            .map(([key, entryValue]) => [key, sanitizeContextValue(entryValue, depth + 1)])
            .filter(([, entryValue]) => entryValue !== undefined);

        if (cleanedEntries.length === 0) return undefined;
        return Object.fromEntries(cleanedEntries);
    }

    return undefined;
};

const pickFirstString = (object, keys) => {
    for (const key of keys) {
        const value = object?.[key];
        if (typeof value === 'string' && sanitizeString(value)) return sanitizeString(value);
    }
    return undefined;
};

const inferCurrentValue = (fieldType, context = {}) => {
    const fallbackMap = {
        task_title: ['title', 'currentTitle', 'value'],
        task_description: ['description', 'currentDescription', 'value'],
        task_tags: ['currentTags', 'tagsInput', 'value'],
        profile_bio: ['currentBio', 'bio', 'value'],
        repo_name: ['name', 'currentName', 'value'],
        repo_description: ['description', 'currentDescription', 'value'],
        sprint_name: ['name', 'currentName', 'value'],
        sprint_goal: ['goal', 'currentGoal', 'value'],
        environment_description: ['currentDescription', 'description', 'value'],
        internal_notes: ['currentInternalNotes', 'internalNotes', 'value'],
        branch_name: ['currentBranch', 'branch', 'value'],
        commit_message: ['currentMessage', 'message', 'value'],
        deploy_notes: ['notes', 'currentNotes', 'value'],
        comment_reply: ['currentDraft', 'draft', 'value'],
    };

    return pickFirstString(context, fallbackMap[fieldType] || ['value']);
};

const collectStrings = (input, bucket = [], depth = 0) => {
    if (depth > MAX_CONTEXT_DEPTH || input === null || input === undefined) return bucket;

    if (typeof input === 'string' || typeof input === 'number' || typeof input === 'boolean') {
        const value = sanitizeString(input);
        if (value) bucket.push(value);
        return bucket;
    }

    if (Array.isArray(input)) {
        input.forEach((item) => collectStrings(item, bucket, depth + 1));
        return bucket;
    }

    if (typeof input === 'object') {
        Object.values(input).forEach((item) => collectStrings(item, bucket, depth + 1));
    }

    return bucket;
};

const extractSignalTokens = (normalizedInput) => {
    const rawStrings = [
        ...collectStrings(normalizedInput.context),
        ...collectStrings(normalizedInput.relatedEntities),
        normalizedInput.currentValue || '',
    ];

    const tokens = [];
    const seen = new Set();

    for (const value of rawStrings) {
        const parts = normalizeForMatch(value).split(/[^a-z0-9/_-]+/g);
        for (const part of parts) {
            if (!part || part.length < 4 || STOP_WORDS.has(part)) continue;
            if (seen.has(part)) continue;
            seen.add(part);
            tokens.push(part);
            if (tokens.length >= 18) return tokens;
        }
    }

    return tokens;
};

const countFilledEntries = (value) => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'string') return sanitizeString(value) ? 1 : 0;
    if (typeof value === 'number' || typeof value === 'boolean') return 1;
    if (Array.isArray(value)) return value.reduce((sum, item) => sum + countFilledEntries(item), 0);
    if (typeof value === 'object') return Object.values(value).reduce((sum, item) => sum + countFilledEntries(item), 0);
    return 0;
};

const buildNormalizedInput = ({
    fieldType,
    context,
    instruction,
    surface,
    intent,
    currentValue,
    relatedEntities,
    constraints,
    retryOnGeneric,
}) => {
    const normalizedContext = sanitizeContextValue(context) || {};
    const normalizedRelatedEntities = sanitizeContextValue(relatedEntities) || {};
    const normalizedConstraints = sanitizeContextValue(constraints) || {};
    const normalizedCurrentValue = sanitizeString(currentValue || inferCurrentValue(fieldType, normalizedContext));
    const normalizedInstruction = sanitizeString(instruction);
    const signalTokens = extractSignalTokens({
        context: normalizedContext,
        relatedEntities: normalizedRelatedEntities,
        currentValue: normalizedCurrentValue,
    });
    const contextDepth = countFilledEntries(normalizedContext) + countFilledEntries(normalizedRelatedEntities);

    return {
        fieldType,
        surface: surface || 'generic',
        intent: intent || 'generate',
        instruction: normalizedInstruction,
        currentValue: normalizedCurrentValue || undefined,
        context: normalizedContext,
        relatedEntities: normalizedRelatedEntities,
        constraints: normalizedConstraints,
        retryOnGeneric: retryOnGeneric !== false,
        signalTokens,
        contextDepth,
        hasStrongContext: signalTokens.length >= 3 || contextDepth >= 5,
    };
};

const buildFieldPrompt = ({ fieldDefinition, normalizedInput, language, attempt }) => {
    const strictMode = attempt > 0;
    const intentGuidance = INTENT_GUIDANCE[normalizedInput.intent] || INTENT_GUIDANCE.generate;
    const surfaceGuidance = SURFACE_GUIDANCE[normalizedInput.surface] || SURFACE_GUIDANCE.generic;
    const languageGuidance = LANGUAGE_GUIDANCE[language] || LANGUAGE_GUIDANCE[FALLBACK_LANGUAGE];
    const signalLines = normalizedInput.signalTokens
        .slice(0, 8)
        .map((token) => `- ${token}`)
        .join('\n');
    const outputInstruction = fieldDefinition.kind === 'list'
        ? 'Retorne JSON com a chave "values".'
        : 'Retorne JSON com a chave "value".';

    return `
Campo: ${fieldDefinition.label}.
Surface atual: ${normalizedInput.surface}.
Intent atual: ${normalizedInput.intent}.
Idioma de saida: ${language}.
Objetivo: ${fieldDefinition.objective}
Como agir nesta intent: ${intentGuidance}
Como agir nesta surface: ${surfaceGuidance}
Regras:
${fieldDefinition.rules.map((rule) => `- ${rule}`).join('\n')}
- use apenas informacoes presentes no contexto
- nao invente fatos, pessoas, entregas ou riscos
- evite frases genericas e formulaicas
- se o contexto estiver incompleto, seja breve e conservador
${languageGuidance.map((rule) => `- ${rule}`).join('\n')}
${strictMode ? '- esta e uma segunda tentativa: a primeira resposta foi considerada genérica ou pouco ancorada no contexto' : ''}
${normalizedInput.instruction ? `Orientacao extra do usuario: ${normalizedInput.instruction}` : ''}
${normalizedInput.currentValue ? `Valor atual do campo: ${JSON.stringify(normalizedInput.currentValue)}` : ''}
${signalLines ? `Sinais prioritarios do contexto:\n${signalLines}` : ''}
${Object.keys(normalizedInput.relatedEntities).length > 0 ? `Entidades relacionadas:\n${JSON.stringify(normalizedInput.relatedEntities, null, 2)}` : ''}
${Object.keys(normalizedInput.constraints).length > 0 ? `Restricoes adicionais:\n${JSON.stringify(normalizedInput.constraints, null, 2)}` : ''}
Contexto principal:
${JSON.stringify(normalizedInput.context, null, 2)}
${outputInstruction}
`.trim();
};

const containsGenericPhrase = (value) => {
    const normalizedValue = normalizeForMatch(value);
    return GENERIC_PHRASES.some((phrase) => normalizedValue.includes(normalizeForMatch(phrase)));
};

const containsAwkwardPhrase = (value) => {
    const normalizedValue = normalizeForMatch(value);
    return AWKWARD_PHRASES.some((phrase) => normalizedValue.includes(normalizeForMatch(phrase)));
};

const hasContextAnchor = (value, signalTokens) => {
    if (signalTokens.length === 0) return true;

    const normalizedValue = normalizeForMatch(value);
    return signalTokens.some((token) => normalizedValue.includes(token));
};

const evaluateResultQuality = (fieldType, result, normalizedInput, attempt) => {
    const signalTokens = normalizedInput.signalTokens || [];
    const minimumAnchoring = normalizedInput.hasStrongContext;

    if (result.value) {
        const normalizedValue = normalizeForMatch(result.value);
        const hasGenericPhrase = containsGenericPhrase(normalizedValue);
        const hasAwkwardPhrase = containsAwkwardPhrase(normalizedValue);
        const anchored = hasContextAnchor(normalizedValue, signalTokens);
        const tooAbstract = normalizedValue.split(/\s+/).length >= 8 && minimumAnchoring && !anchored;

        if ((hasGenericPhrase || hasAwkwardPhrase || tooAbstract) && normalizedInput.retryOnGeneric && attempt === 0) {
            return {
                shouldRetry: true,
                warning: RETRY_WARNING,
                confidence: 'low',
            };
        }

        return {
            shouldRetry: false,
            warning: !normalizedInput.hasStrongContext ? LOW_CONTEXT_WARNING : undefined,
            confidence: normalizedInput.hasStrongContext && anchored && !hasAwkwardPhrase ? 'high' : normalizedInput.hasStrongContext ? 'medium' : 'low',
        };
    }

    if (result.values) {
        const joinedValues = result.values.join(' ');
        const hasGenericPhrase = containsGenericPhrase(joinedValues);
        const hasAwkwardPhrase = containsAwkwardPhrase(joinedValues);
        const anchored = hasContextAnchor(joinedValues, signalTokens);

        if ((hasGenericPhrase || hasAwkwardPhrase) && !anchored && normalizedInput.retryOnGeneric && attempt === 0) {
            return {
                shouldRetry: true,
                warning: RETRY_WARNING,
                confidence: 'low',
            };
        }

        return {
            shouldRetry: false,
            warning: !normalizedInput.hasStrongContext ? LOW_CONTEXT_WARNING : undefined,
            confidence: normalizedInput.hasStrongContext && anchored && !hasAwkwardPhrase ? 'high' : normalizedInput.hasStrongContext ? 'medium' : 'low',
        };
    }

    return {
        shouldRetry: false,
        warning: undefined,
        confidence: 'low',
    };
};

const callOllamaJson = async ({ model, prompt, fieldType, surface, intent, attempt }) => {
    console.info(`[ai.fill-field] start field=${fieldType} surface=${surface} intent=${intent} attempt=${attempt + 1}`);

    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            stream: false,
            format: 'json',
            messages: [
                {
                    role: 'system',
                    content: 'Voce preenche campos do DevFlow. Responda somente JSON valido, sem markdown e sem texto antes ou depois do JSON.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
        }),
    });

    if (!response.ok) {
        throw new Error(`Falha ao gerar texto com o Ollama (HTTP ${response.status}).`);
    }

    const payload = await response.json();
    const rawText = payload?.message?.content || '';
    const parsed = parseModelJson(rawText);

    return parsed;
};

export const getAiDefaults = () => ({
    model: getStoredSetting('aiDefaultModel', FALLBACK_MODEL),
    language: getStoredSetting('aiDefaultLanguage', FALLBACK_LANGUAGE),
});

export const getResolvedAiPreferences = (user) => {
    const defaults = getAiDefaults();
    const preferences = parseUserPreferences(user);
    const aiPreferences = preferences.ai || {};

    return {
        model: aiPreferences.model || defaults.model,
        language: aiPreferences.language || defaults.language,
    };
};

export const getAiLanguageOptions = () => AI_LANGUAGE_OPTIONS;

export const getOllamaStatus = async () => {
    try {
        const response = await fetch(`${OLLAMA_URL}/api/version`);
        if (!response.ok) {
            return { available: false, url: OLLAMA_URL, error: `HTTP ${response.status}` };
        }

        const payload = await response.json();
        return {
            available: true,
            url: OLLAMA_URL,
            version: payload?.version || null,
        };
    } catch (err) {
        return {
            available: false,
            url: OLLAMA_URL,
            error: err.message || 'Falha ao conectar no Ollama.',
        };
    }
};

export const listInstalledTextModels = async () => {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!response.ok) {
        throw new Error(`Falha ao listar modelos no Ollama (HTTP ${response.status}).`);
    }

    const payload = await response.json();
    const models = Array.isArray(payload?.models) ? payload.models : [];
    const installedModels = models
        .filter(isTextGenerationModel)
        .map((model) => ({
            name: model.name,
            family: model?.details?.family || null,
            parameterSize: model?.details?.parameter_size || null,
            quantization: model?.details?.quantization_level || null,
            size: model.size,
        }))
        .sort((left, right) => {
            if (left.name === FALLBACK_MODEL) return -1;
            if (right.name === FALLBACK_MODEL) return 1;
            return left.name.localeCompare(right.name);
        });

    return installedModels;
};

export const generateFieldContent = async ({
    user,
    fieldType,
    context,
    instruction,
    surface,
    intent,
    currentValue,
    relatedEntities,
    constraints,
    retryOnGeneric,
}) => {
    const fieldDefinition = FIELD_DEFINITIONS[fieldType];
    if (!fieldDefinition) {
        throw new Error('Tipo de campo de IA nao suportado.');
    }

    const normalizedInput = buildNormalizedInput({
        fieldType,
        context,
        instruction,
        surface,
        intent,
        currentValue,
        relatedEntities,
        constraints,
        retryOnGeneric,
    });

    const models = await listInstalledTextModels();
    const installedModelNames = models.map((model) => model.name);
    const preferences = getResolvedAiPreferences(user);
    const selectedModel = installedModelNames.includes(preferences.model)
        ? preferences.model
        : installedModelNames.includes(FALLBACK_MODEL)
            ? FALLBACK_MODEL
            : installedModelNames[0];

    if (!selectedModel) {
        throw new Error('Nenhum modelo de texto compativel foi encontrado no Ollama.');
    }

    let lastNormalizedResult = null;
    let lastQuality = {
        warning: !normalizedInput.hasStrongContext ? LOW_CONTEXT_WARNING : undefined,
        confidence: normalizedInput.hasStrongContext ? 'medium' : 'low',
    };

    for (let attempt = 0; attempt < 2; attempt += 1) {
        const prompt = buildFieldPrompt({
            fieldDefinition,
            normalizedInput,
            language: preferences.language,
            attempt,
        });

        const parsed = await callOllamaJson({
            model: selectedModel,
            prompt,
            fieldType,
            surface: normalizedInput.surface,
            intent: normalizedInput.intent,
            attempt,
        });
        const normalizedResult = normalizeFieldResult(fieldType, parsed);
        const quality = evaluateResultQuality(fieldType, normalizedResult, normalizedInput, attempt);

        lastNormalizedResult = normalizedResult;
        lastQuality = quality;

        if (!quality.shouldRetry) {
            console.info(`[ai.fill-field] done field=${fieldType} surface=${normalizedInput.surface} intent=${normalizedInput.intent} attempt=${attempt + 1} confidence=${quality.confidence}`);
            return {
                ...normalizedResult,
                model: selectedModel,
                language: preferences.language,
                warning: quality.warning,
                confidence: quality.confidence,
                meta: {
                    fieldType,
                    surface: normalizedInput.surface,
                    intent: normalizedInput.intent,
                },
            };
        }

        console.warn(`[ai.fill-field] retry field=${fieldType} surface=${normalizedInput.surface} intent=${normalizedInput.intent} reason=generic_output`);
    }

    console.warn(`[ai.fill-field] fallback field=${fieldType} surface=${normalizedInput.surface} intent=${normalizedInput.intent} warning=${lastQuality.warning || 'none'}`);

    return {
        ...lastNormalizedResult,
        model: selectedModel,
        language: preferences.language,
        warning: lastQuality.warning,
        confidence: lastQuality.confidence,
        meta: {
            fieldType,
            surface: normalizedInput.surface,
            intent: normalizedInput.intent,
        },
    };
};
