import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
    generateFieldContent,
    getAiDefaults,
    getAiLanguageOptions,
    getOllamaStatus,
    getResolvedAiPreferences,
    listInstalledTextModels,
} from '../services/ollama.js';

const router = express.Router();

const normalizeRecord = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value;
};

const normalizeOptionalString = (value) => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed || undefined;
};

router.get('/config', requireAuth, async (req, res) => {
    try {
        const [status, models] = await Promise.all([
            getOllamaStatus(),
            listInstalledTextModels().catch(() => []),
        ]);

        res.json({
            status,
            defaults: getAiDefaults(),
            preferences: getResolvedAiPreferences(req.user),
            languageOptions: getAiLanguageOptions(),
            models,
        });
    } catch (err) {
        res.status(500).json({ error: 'Falha ao carregar configuracoes de IA', details: err.message });
    }
});

router.get('/status', requireAuth, async (_req, res) => {
    try {
        const status = await getOllamaStatus();
        res.json(status);
    } catch (err) {
        res.status(500).json({ error: 'Falha ao consultar o Ollama', details: err.message });
    }
});

router.get('/models', requireAuth, async (_req, res) => {
    try {
        const models = await listInstalledTextModels();
        res.json({ models });
    } catch (err) {
        res.status(500).json({ error: 'Falha ao listar modelos locais', details: err.message });
    }
});

router.post('/fill-field', requireAuth, async (req, res) => {
    const {
        fieldType,
        context,
        instruction,
        surface,
        intent,
        currentValue,
        relatedEntities,
        constraints,
        retryOnGeneric,
    } = req.body || {};

    if (!fieldType) {
        return res.status(400).json({ error: 'fieldType e obrigatorio.' });
    }

    try {
        const result = await generateFieldContent({
            user: req.user,
            fieldType,
            context: normalizeRecord(context),
            instruction: normalizeOptionalString(instruction),
            surface: normalizeOptionalString(surface) || 'generic',
            intent: normalizeOptionalString(intent) || 'generate',
            currentValue: normalizeOptionalString(currentValue),
            relatedEntities: normalizeRecord(relatedEntities),
            constraints: normalizeRecord(constraints),
            retryOnGeneric: retryOnGeneric !== false,
        });

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message || 'Falha ao gerar conteudo com IA.' });
    }
});

export default router;
