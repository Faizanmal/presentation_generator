'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import type {
  ThinkingGenerationResult,
  ThinkingStep,
  ThinkingState,
  ThinkingPresentation,
  ThinkingPhase,
} from '@/types';

// Phase icons and colors
const phaseConfig: Record<
  ThinkingPhase,
  { icon: string; color: string; label: string; description: string }
> = {
  planning: {
    icon: '🎯',
    color: '#6366f1',
    label: 'Planning',
    description: 'Analyzing topic, audience, and creating content strategy',
  },
  research: {
    icon: '🔍',
    color: '#8b5cf6',
    label: 'Research',
    description: 'Gathering relevant insights and context',
  },
  generation: {
    icon: '✨',
    color: '#06b6d4',
    label: 'Generating',
    description: 'Creating slide content section by section',
  },
  reflection: {
    icon: '🔬',
    color: '#f59e0b',
    label: 'Evaluating',
    description: 'Assessing quality across multiple criteria',
  },
  refinement: {
    icon: '🔧',
    color: '#10b981',
    label: 'Refining',
    description: 'Applying improvements based on evaluation',
  },
  complete: {
    icon: '✅',
    color: '#22c55e',
    label: 'Complete',
    description: 'Presentation ready!',
  },
};

interface ThinkingModeGeneratorProps {
  onComplete?: (result: ThinkingGenerationResult) => void;
  onError?: (error: Error) => void;
  className?: string;
}

export function ThinkingModeGenerator({
  onComplete,
  onError,
  className = '',
}: ThinkingModeGeneratorProps) {
  // Form state
  const [topic, setTopic] = useState('');
  const [audience, setAudience] = useState('');
  const [tone, setTone] = useState<'professional' | 'casual' | 'academic' | 'creative'>('professional');
  const [length, setLength] = useState(8);
  const [qualityLevel, setQualityLevel] = useState<'standard' | 'high' | 'premium'>('high');
  const [imageSource, setImageSource] = useState<'none' | 'ai' | 'stock'>('ai');
  const [inputMode, setInputMode] = useState<'topic' | 'raw'>('topic');
  const [rawContent, setRawContent] = useState('');

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<ThinkingPhase | null>(null);
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [progress, setProgress] = useState(0);
  const [qualityScore, setQualityScore] = useState<number | null>(null);
  const [result, setResult] = useState<ThinkingGenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const stepsContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest step
  useEffect(() => {
    if (stepsContainerRef.current) {
      stepsContainerRef.current.scrollTop = stepsContainerRef.current.scrollHeight;
    }
  }, [thinkingSteps]);

  // Handle non-streaming generation
  const handleGenerate = useCallback(async () => {
    if (inputMode === 'topic' && !topic.trim()) {
      setError('Please enter a topic');
      return;
    }
    if (inputMode === 'raw' && (!topic.trim() || !rawContent.trim())) {
      setError('Please enter a topic/title and raw data content');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setThinkingSteps([]);
    setResult(null);
    setProgress(0);
    setCurrentPhase('planning');

    try {
      // Simulate progress updates for non-streaming
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) { return prev; }
          return prev + 5;
        });
      }, 500);

      const result = await api.generateWithThinking({
        topic,
        tone,
        audience: audience || undefined,
        length,
        qualityLevel,
        smartLayout: true,
        generateImages: imageSource !== 'none',
        imageSource: imageSource !== 'none' ? imageSource : undefined,
        rawData: inputMode === 'raw' ? rawContent : undefined,
      });

      clearInterval(progressInterval);
      setProgress(100);
      setCurrentPhase('complete');
      setResult(result);
      // Accept either `thinkingSteps` (frontend contract) or the newer `thinkingProcess.steps` shape
      setThinkingSteps(result.thinkingSteps ?? []);
      setQualityScore(result.qualityReport.overallScore);
      onComplete?.(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Generation failed';
      setError(errorMessage);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setIsGenerating(false);
    }
  }, [topic, rawContent, inputMode, tone, audience, length, qualityLevel, imageSource, onComplete, onError]);

  // Handle generation with streaming
  const _handleGenerateStream = useCallback(async () => {
    if (inputMode === 'topic' && !topic.trim()) {
      setError('Please enter a topic');
      return;
    }
    if (inputMode === 'raw' && (!topic.trim() || !rawContent.trim())) {
      setError('Please enter a topic/title and raw data content');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setThinkingSteps([]);
    setResult(null);
    setProgress(0);
    setCurrentPhase('planning');

    const cleanup = api.streamThinkingGeneration(
      {
        topic,
        tone,
        audience: audience || undefined,
        length,
        qualityLevel,
        imageSource,
        rawData: inputMode === 'raw' ? rawContent : undefined,
      },
      (step: ThinkingStep) => {
        setThinkingSteps((prev) => [...prev, step]);
        setCurrentPhase(step.phase);
      },
      (state: ThinkingState) => {
        setProgress(state.overallProgress);
        setCurrentPhase(state.currentPhase);
        if (state.qualityScore) {
          setQualityScore(state.qualityScore);
        }
      },
      (_presentation: ThinkingPresentation) => {
        // Streaming complete - need to fetch full result
        handleGenerate();
      },
      (err: Error) => {
        setError(err.message);
        setIsGenerating(false);
        onError?.(err);
      },
    );

    return cleanup;
  }, [topic, rawContent, inputMode, tone, audience, length, qualityLevel, imageSource, handleGenerate, onError]);

  // Quick generate handler
  const handleQuickGenerate = useCallback(async () => {
    if (inputMode === 'topic' && !topic.trim()) {
      setError('Please enter a topic');
      return;
    }
    if (inputMode === 'raw' && (!topic.trim() || !rawContent.trim())) {
      setError('Please enter a topic/title and raw data content');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setCurrentPhase('generation');

    try {
      const result = await api.generateQuick({
        topic,
        tone,
        audience: audience || undefined,
        length: Math.min(length, 6),
        rawData: inputMode === 'raw' ? rawContent : undefined,
      });

      setProgress(100);
      setCurrentPhase('complete');
      setResult(result);
      setQualityScore(result.qualityReport.overallScore);
      onComplete?.(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Generation failed';
      setError(errorMessage);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setIsGenerating(false);
    }
  }, [topic, rawContent, inputMode, tone, audience, length, onComplete, onError]);

  return (
    <div className={`thinking-mode-generator ${className}`}>
      {/* Form Section */}
      <div className="generator-form">
        <h2 className="form-title">
          <span className="title-icon">🧠</span>
          AI Thinking Mode
        </h2>
        <p className="form-description">
          Generate high-quality presentations using multi-step reasoning and iterative refinement.
        </p>

        <div className="input-mode-tabs">
          <button
            className={`tab-btn ${inputMode === 'topic' ? 'active' : ''}`}
            onClick={() => setInputMode('topic')}
            disabled={isGenerating}
          >
            Topic Based
          </button>
          <button
            className={`tab-btn ${inputMode === 'raw' ? 'active' : ''}`}
            onClick={() => setInputMode('raw')}
            disabled={isGenerating}
          >
            From Raw Data
          </button>
        </div>

        <div className="form-fields">
          {/* Topic/Title Input */}
          <div className="form-group">
            <label htmlFor="topic">{inputMode === 'raw' ? 'Presentation Title *' : 'Topic *'}</label>
            <input
              id="topic"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={inputMode === 'raw' ? "e.g., Q3 Financial Report" : "e.g., The Future of Artificial Intelligence"}
              disabled={isGenerating}
              className="form-input"
            />
          </div>

          {/* Raw Content Input */}
          {inputMode === 'raw' && (
            <div className="form-group">
              <label htmlFor="rawContent">Raw Data / Unstructured Content *</label>
              <textarea
                id="rawContent"
                value={rawContent}
                onChange={(e) => setRawContent(e.target.value)}
                placeholder="Paste your raw text, JSON, or unstructured data here..."
                disabled={isGenerating}
                className="form-textarea"
                rows={8}
              />
            </div>
          )}

          {/* Audience Input */}
          <div className="form-group">
            <label htmlFor="audience">Target Audience</label>
            <input
              id="audience"
              type="text"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="e.g., Tech executives, Marketing team"
              disabled={isGenerating}
              className="form-input"
            />
          </div>

          {/* Tone Select */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="tone">Tone</label>
              <select
                id="tone"
                value={tone}
                onChange={(e) => setTone(e.target.value as typeof tone)}
                disabled={isGenerating}
                className="form-select"
              >
                <option value="professional">Professional</option>
                <option value="casual">Casual</option>
                <option value="academic">Academic</option>
                <option value="creative">Creative</option>
              </select>
            </div>

            {/* Length Input */}
            <div className="form-group">
              <label htmlFor="length">Slides: {length}</label>
              <input
                id="length"
                type="range"
                min="4"
                max="20"
                value={length}
                onChange={(e) => setLength(parseInt(e.target.value))}
                disabled={isGenerating}
                className="form-range"
              />
            </div>
          </div>

          {/* Quality Level */}
          <div className="form-group">
            <label>Quality Level</label>
            <div className="quality-options">
              {(['standard', 'high', 'premium'] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  className={`quality-option ${qualityLevel === level ? 'active' : ''}`}
                  onClick={() => setQualityLevel(level)}
                  disabled={isGenerating}
                >
                  <span className="quality-icon">
                    {level === 'standard' ? '⚡' : level === 'high' ? '✨' : '💎'}
                  </span>
                  <span className="quality-label">{level.charAt(0).toUpperCase() + level.slice(1)}</span>
                  <span className="quality-desc">
                    {level === 'standard'
                      ? 'Fast (1 iteration)'
                      : level === 'high'
                        ? 'Balanced (3 iterations)'
                        : 'Best (5 iterations)'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Image Source */}
          <div className="form-group">
            <label>Images</label>
            <div className="quality-options">
              <button
                type="button"
                className={`quality-option ${imageSource === 'none' ? 'active' : ''}`}
                onClick={() => setImageSource('none')}
                disabled={isGenerating}
              >
                <span className="quality-icon">🚫</span>
                <span className="quality-label">None</span>
                <span className="quality-desc">Text only</span>
              </button>
              <button
                type="button"
                className={`quality-option ${imageSource === 'ai' ? 'active' : ''}`}
                onClick={() => setImageSource('ai')}
                disabled={isGenerating}
              >
                <span className="quality-icon">🎨</span>
                <span className="quality-label">AI Generated</span>
                <span className="quality-desc">Unique DALL-E images</span>
              </button>
              <button
                type="button"
                className={`quality-option ${imageSource === 'stock' ? 'active' : ''}`}
                onClick={() => setImageSource('stock')}
                disabled={isGenerating}
              >
                <span className="quality-icon">📸</span>
                <span className="quality-label">Stock Photos</span>
                <span className="quality-desc">High-quality photos</span>
              </button>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="form-actions">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !topic.trim()}
            className="btn-primary"
          >
            {isGenerating ? (
              <>
                <span className="spinner" />
                Generating...
              </>
            ) : (
              <>
                <span>🧠</span>
                Generate with Thinking
              </>
            )}
          </button>

          <button
            onClick={handleQuickGenerate}
            disabled={isGenerating || !topic.trim()}
            className="btn-secondary"
          >
            <span>⚡</span>
            Quick Generate
          </button>
        </div>
      </div>

      {/* Thinking Process Visualization */}
      {(isGenerating || thinkingSteps.length > 0) && (
        <div className="thinking-process">
          <h3 className="process-title">
            {currentPhase && phaseConfig[currentPhase] && (
              <>
                <span className="phase-icon">{phaseConfig[currentPhase].icon}</span>
                {phaseConfig[currentPhase].label}
              </>
            )}
          </h3>

          {/* Progress Bar */}
          <div className="progress-container">
            <div
              className="progress-bar"
              style={{
                width: `${progress}%`,
                backgroundColor: currentPhase ? phaseConfig[currentPhase]?.color : '#6366f1',
              }}
            />
            <span className="progress-text">{Math.round(progress)}%</span>
          </div>

          {/* Phase Description */}
          {currentPhase && phaseConfig[currentPhase] && (
            <p className="phase-description">{phaseConfig[currentPhase].description}</p>
          )}

          {/* Thinking Steps */}
          <div className="thinking-steps" ref={stepsContainerRef}>
            {thinkingSteps.map((step) => (
              <div
                key={`thinking-step-${step.stepNumber}-${step.phase}-${step.action}`}
                className={`thinking-step phase-${step.phase}`}
                style={{
                  borderLeftColor: phaseConfig[step.phase]?.color || '#6366f1',
                }}
              >
                <div className="step-header">
                  <span className="step-phase-icon">{phaseConfig[step.phase]?.icon}</span>
                  <span className="step-action">{step.action}</span>
                  <span className="step-number">#{step.stepNumber}</span>
                </div>
                <p className="step-thought">{step.thought}</p>
                {step.observation && (
                  <p className="step-observation">
                    <span className="observation-label">→</span> {step.observation}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Quality Score */}
          {qualityScore !== null && (
            <div className="quality-score-display">
              <div className="score-circle">
                <span className="score-value">{qualityScore.toFixed(1)}</span>
                <span className="score-max">/10</span>
              </div>
              <span className="score-label">Quality Score</span>
            </div>
          )}
        </div>
      )}

      {/* Result Summary */}
      {result && (
        <div className="result-summary">
          <h3>
            <span>🎉</span> Generation Complete!
          </h3>
          <div className="result-stats">
            <div className="stat">
              <span className="stat-value">{result.presentation.sections.length}</span>
              <span className="stat-label">Slides</span>
            </div>
            <div className="stat">
              <span className="stat-value">{result.metadata.totalIterations}</span>
              <span className="stat-label">Iterations</span>
            </div>
            <div className="stat">
              <span className="stat-value">{(result.metadata.generationTimeMs / 1000).toFixed(1)}s</span>
              <span className="stat-label">Time</span>
            </div>
            <div className="stat">
              <span className="stat-value">{result.qualityReport.overallScore.toFixed(1)}</span>
              <span className="stat-label">Quality</span>
            </div>
            <div className="stat">
              <span className="stat-value">{(result.metadata.totalTokensUsed / 1000).toFixed(1)}k</span>
              <span className="stat-label">Tokens</span>
            </div>
          </div>

          {result.metadata.qualityImprovement > 0 && (
            <div className="quality-improvement">
              <span className="improvement-icon">📈</span>
              <span>
                Quality improved by <strong>{result.metadata.qualityImprovement.toFixed(0)}%</strong> through{' '}
                {result.metadata.totalIterations} refinement iterations
              </span>
            </div>
          )}

          <div className="result-actions">
            <button className="btn-primary">View Presentation</button>
            <button className="btn-secondary">Export</button>
          </div>
        </div>
      )}

      <style jsx>{`
        .thinking-mode-generator {
          max-width: 800px;
          margin: 0 auto;
          font-family: var(--font-sans, system-ui, -apple-system, sans-serif);
        }

        .generator-form {
          background: linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%);
          border-radius: 16px;
          padding: 32px;
          margin-bottom: 24px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }

        .form-title {
          font-size: 28px;
          font-weight: 700;
          color: #fff;
          margin: 0 0 8px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .title-icon {
          font-size: 32px;
        }

        .form-description {
          color: #a1a1aa;
          margin: 0 0 24px;
          font-size: 15px;
        }

        .input-mode-tabs {
          display: flex;
          gap: 16px;
          margin-bottom: 24px;
          border-bottom: 1px solid #3f3f46;
          padding-bottom: 0;
        }

        .tab-btn {
          background: none;
          border: none;
          color: #a1a1aa;
          padding: 8px 16px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.2s;
        }

        .tab-btn:hover {
          color: #fff;
        }

        .tab-btn.active {
          color: #6366f1;
          border-bottom-color: #6366f1;
        }

        .form-fields {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-group label {
          font-size: 14px;
          font-weight: 600;
          color: #e4e4e7;
        }

        .form-input,
        .form-select,
        .form-textarea {
          padding: 12px 16px;
          border-radius: 8px;
          border: 1px solid #3f3f46;
          background: #27272a;
          color: #fff;
          font-size: 15px;
          transition: all 0.2s;
        }

        .form-textarea {
          resize: vertical;
          font-family: inherit;
        }

        .form-input:focus,
        .form-select:focus,
        .form-textarea:focus {
          outline: none;
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
        }

        .form-input:disabled,
        .form-select:disabled,
        .form-textarea:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .form-range {
          width: 100%;
          height: 8px;
          border-radius: 4px;
          background: #3f3f46;
          appearance: none;
          cursor: pointer;
        }

        .form-range::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #6366f1;
          cursor: pointer;
        }

        .quality-options {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        .quality-option {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 16px 12px;
          border-radius: 12px;
          border: 2px solid #3f3f46;
          background: transparent;
          color: #a1a1aa;
          cursor: pointer;
          transition: all 0.2s;
        }

        .quality-option:hover:not(:disabled) {
          border-color: #6366f1;
          background: rgba(99, 102, 241, 0.1);
        }

        .quality-option.active {
          border-color: #6366f1;
          background: rgba(99, 102, 241, 0.2);
          color: #fff;
        }

        .quality-option:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .quality-icon {
          font-size: 24px;
        }

        .quality-label {
          font-weight: 600;
          font-size: 14px;
        }

        .quality-desc {
          font-size: 11px;
          opacity: 0.7;
        }

        .error-message {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 8px;
          color: #fca5a5;
          margin-top: 16px;
        }

        .form-actions {
          display: flex;
          gap: 12px;
          margin-top: 24px;
        }

        .btn-primary,
        .btn-secondary {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px 24px;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .btn-primary {
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: #fff;
          flex: 1;
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(99, 102, 241, 0.4);
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: #3f3f46;
          color: #e4e4e7;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #52525b;
        }

        .btn-secondary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .thinking-process {
          background: linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%);
          border-radius: 16px;
          padding: 24px;
          margin-bottom: 24px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }

        .process-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 20px;
          font-weight: 600;
          color: #fff;
          margin: 0 0 16px;
        }

        .phase-icon {
          font-size: 24px;
        }

        .progress-container {
          position: relative;
          height: 8px;
          background: #3f3f46;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 8px;
        }

        .progress-bar {
          height: 100%;
          border-radius: 4px;
          transition: width 0.3s ease;
        }

        .progress-text {
          position: absolute;
          right: 0;
          top: 12px;
          font-size: 12px;
          color: #a1a1aa;
        }

        .phase-description {
          color: #a1a1aa;
          font-size: 14px;
          margin: 12px 0 20px;
        }

        .thinking-steps {
          max-height: 400px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding-right: 8px;
        }

        .thinking-steps::-webkit-scrollbar {
          width: 6px;
        }

        .thinking-steps::-webkit-scrollbar-track {
          background: #27272a;
          border-radius: 3px;
        }

        .thinking-steps::-webkit-scrollbar-thumb {
          background: #52525b;
          border-radius: 3px;
        }

        .thinking-step {
          background: rgba(255, 255, 255, 0.03);
          border-radius: 10px;
          padding: 14px;
          border-left: 3px solid;
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .step-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .step-phase-icon {
          font-size: 16px;
        }

        .step-action {
          font-weight: 600;
          color: #e4e4e7;
          font-size: 14px;
          flex: 1;
        }

        .step-number {
          font-size: 12px;
          color: #71717a;
        }

        .step-thought {
          color: #a1a1aa;
          font-size: 13px;
          margin: 0 0 6px;
          line-height: 1.5;
        }

        .step-observation {
          display: flex;
          gap: 6px;
          font-size: 12px;
          color: #71717a;
          margin: 0;
        }

        .observation-label {
          color: #6366f1;
        }

        .quality-score-display {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #3f3f46;
        }

        .score-circle {
          display: flex;
          align-items: baseline;
          gap: 2px;
        }

        .score-value {
          font-size: 36px;
          font-weight: 700;
          color: #22c55e;
        }

        .score-max {
          font-size: 16px;
          color: #71717a;
        }

        .score-label {
          font-size: 14px;
          color: #a1a1aa;
        }

        .result-summary {
          background: linear-gradient(135deg, #134e4a 0%, #1e3a3a 100%);
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }

        .result-summary h3 {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 22px;
          font-weight: 700;
          color: #fff;
          margin: 0 0 20px;
        }

        .result-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 20px;
        }

        .stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }

        .stat-value {
          font-size: 28px;
          font-weight: 700;
          color: #fff;
        }

        .stat-label {
          font-size: 12px;
          color: #a1a1aa;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .quality-improvement {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 16px;
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.3);
          border-radius: 10px;
          color: #86efac;
          font-size: 14px;
          margin-bottom: 20px;
        }

        .improvement-icon {
          font-size: 20px;
        }

        .result-actions {
          display: flex;
          gap: 12px;
        }

        @media (max-width: 640px) {
          .form-row {
            grid-template-columns: 1fr;
          }

          .quality-options {
            grid-template-columns: 1fr;
          }

          .result-stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .form-actions {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}

export default ThinkingModeGenerator;
