import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { sendError } from '../utils.js';
import { validate, fillFieldSchema } from '../validation.js';
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
        sendError(res, 500, 'Falha ao carregar configuracoes de IA', err.message);
    }
});

router.get('/status', requireAuth, async (_req, res) => {
    try {
        const status = await getOllamaStatus();
        res.json(status);
    } catch (err) {
        sendError(res, 500, 'Falha ao consultar o Ollama', err.message);
    }
});

router.get('/models', requireAuth, async (_req, res) => {
    try {
        const models = await listInstalledTextModels();
        res.json({ models });
    } catch (err) {
        sendError(res, 500, 'Falha ao listar modelos locais', err.message);
    }
});

router.post('/fill-field', requireAuth, validate(fillFieldSchema), async (req, res) => {
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
        sendError(res, 500, 'Falha ao gerar conteudo com IA.', err.message);
    }
});

export default router;
