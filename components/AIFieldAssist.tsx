import React, { useId, useMemo, useState } from 'react';
import { Loader2, SlidersHorizontal, Sparkles } from 'lucide-react';
import { api } from '../services/api';
import {
  AIFillFieldResponse,
  AIFieldAssistVariant,
  AIFieldType,
  AIIntent,
  AISurface,
  getErrorMessage,
} from '../types';

interface AIFieldAssistProps {
  fieldType: AIFieldType;
  helpText?: string;
  buildContext: () => Record<string, unknown>;
  onApply: (result: AIFillFieldResponse) => void;
  buttonLabel?: string;
  className?: string;
  disabled?: boolean;
  variant?: AIFieldAssistVariant;
  surface?: AISurface;
  intent?: AIIntent;
  currentValue?: string;
  relatedEntities?: Record<string, unknown>;
  constraints?: Record<string, unknown>;
  instructionPlaceholder?: string;
  showInstructionByDefault?: boolean;
  retryOnGeneric?: boolean;
}

const DEFAULT_LABEL_BY_INTENT: Record<AIIntent, string> = {
  generate: 'Gerar com IA',
  refine: 'Refinar com IA',
  suggest: 'Sugerir com IA',
  rewrite: 'Reescrever com IA',
  summarize: 'Resumir com IA',
  expand: 'Expandir com IA',
};

const COMPACT_LABEL_BY_INTENT: Record<AIIntent, string> = {
  generate: 'Gerar',
  refine: 'Refinar',
  suggest: 'Sugerir',
  rewrite: 'Reescrever',
  summarize: 'Resumir',
  expand: 'Expandir',
};

const AIFieldAssist: React.FC<AIFieldAssistProps> = ({
  fieldType,
  helpText = '',
  buildContext,
  onApply,
  buttonLabel,
  className = '',
  disabled = false,
  variant = 'compact',
  surface = 'generic',
  intent = 'generate',
  currentValue,
  relatedEntities,
  constraints,
  instructionPlaceholder = 'Ex: enfatize impacto, mantenha o tom técnico, cite critérios...',
  showInstructionByDefault = false,
  retryOnGeneric = true,
}) => {
  const [instruction, setInstruction] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastMeta, setLastMeta] = useState<{ model: string; language: string } | null>(null);
  const [warning, setWarning] = useState('');
  const [error, setError] = useState('');
  const [showInstruction, setShowInstruction] = useState(showInstructionByDefault || variant === 'expanded');
  const instructionId = useId();

  const resolvedButtonLabel = useMemo(
    () => buttonLabel || DEFAULT_LABEL_BY_INTENT[intent],
    [buttonLabel, intent]
  );
  const compactButtonLabel = useMemo(
    () => COMPACT_LABEL_BY_INTENT[intent],
    [intent]
  );

  const handleGenerate = async () => {
    setIsLoading(true);
    setError('');
    setWarning('');

    try {
      const result = await api.fillAIField({
        fieldType,
        context: buildContext(),
        instruction: instruction.trim() || undefined,
        surface,
        intent,
        currentValue,
        relatedEntities,
        constraints,
        retryOnGeneric,
      });
      onApply(result);
      setLastMeta({ model: result.model, language: result.language });
      setWarning(result.warning || '');
    } catch (err: unknown) {
      setError(getErrorMessage(err) || 'Não foi possível gerar conteúdo com IA.');
    } finally {
      setIsLoading(false);
    }
  };

  const triggerClassName = variant === 'inline'
    ? 'ai-assist-trigger ai-assist-trigger-inline'
    : variant === 'compact'
      ? 'ai-assist-trigger ai-assist-trigger-compact'
      : 'ai-assist-trigger';

  const toggleClassName = variant === 'compact'
    ? 'ai-assist-toggle ai-assist-toggle-compact'
    : 'ai-assist-toggle';

  const rootClassName = [
    'ai-assist',
    variant === 'expanded' ? 'ai-assist-expanded' : variant === 'inline' ? 'ai-assist-inline' : 'ai-assist-compact',
    className,
  ].filter(Boolean).join(' ');

  const showMetaLine = variant === 'expanded' && lastMeta;
  const showHelpLine = variant === 'expanded' && helpText;
  const showInstructionToggle = variant !== 'inline';
  const buttonTitle = helpText || resolvedButtonLabel;
  const instructionToggleLabel = showInstruction ? 'Ocultar ajuste' : 'Ajustar';

  return (
    <div className={rootClassName}>
      <div className="ai-assist-toolbar">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={disabled || isLoading}
          title={buttonTitle}
          aria-describedby={showInstruction ? instructionId : undefined}
          className={triggerClassName}
          aria-label={resolvedButtonLabel}
        >
          {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {variant !== 'inline' && <span>{variant === 'compact' ? compactButtonLabel : resolvedButtonLabel}</span>}
        </button>

        {showInstructionToggle && (
          <button
            type="button"
            onClick={() => setShowInstruction((current) => !current)}
            disabled={disabled || isLoading}
            className={toggleClassName}
            aria-expanded={showInstruction}
            aria-controls={instructionId}
            aria-label={instructionToggleLabel}
            title={instructionToggleLabel}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {variant === 'expanded' ? <span>{instructionToggleLabel}</span> : <span className="sr-only">{instructionToggleLabel}</span>}
          </button>
        )}

        {showHelpLine && (
          <p className="ai-assist-help">
            {helpText}
          </p>
        )}
      </div>

      {showInstruction && (
        <div className="ai-assist-instruction" id={instructionId}>
          <label className="ai-assist-input-label">
            Orientação extra opcional
          </label>
          <input
            type="text"
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            placeholder={instructionPlaceholder}
            className="app-input w-full rounded-xl px-3 py-2 text-sm"
          />
        </div>
      )}

      {(error || warning || showMetaLine) && (
        <div className="ai-assist-feedback">
          {error && (
            <p className="ai-assist-feedback-error">
              {error}
            </p>
          )}
          {!error && warning && (
            <p className="ai-assist-feedback-warning">
              {warning}
            </p>
          )}
          {showMetaLine && lastMeta && (
            <p className="ai-assist-feedback-meta">
              Modelo: <span className="font-mono">{lastMeta.model}</span> · Idioma: <span className="font-medium">{lastMeta.language}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default AIFieldAssist;
