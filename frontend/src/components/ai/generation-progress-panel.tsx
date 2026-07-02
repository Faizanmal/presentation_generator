/**
 * GenerationProgressPanel — Visual pipeline progress indicator.
 * Shows the multi-agent pipeline stages with animated progress.
 */
'use client';

import React from 'react';
import { useGenerationStore, AGENT_LABELS, type GenerationStatus } from '@/stores/generation-store';

const PIPELINE_STAGES: GenerationStatus[] = [
  'researching',
  'outlining',
  'narrating',
  'layouting',
  'designing',
  'imaging',
  'validating',
];

export function GenerationProgressPanel() {
  const { status, progress, message, qualityReport, error } = useGenerationStore();

  if (status === 'idle') {return null;}

  const currentStageIndex = PIPELINE_STAGES.indexOf(status);

  return (
    <div className="generation-progress-panel">
      {/* Header */}
      <div className="progress-header">
        <h3 className="progress-title">
          {AGENT_LABELS[status].icon} {AGENT_LABELS[status].label}
        </h3>
        <span className="progress-percentage">{Math.round(progress)}%</span>
      </div>

      {/* Progress bar */}
      <div className="progress-bar-track">
        <div
          className="progress-bar-fill"
          style={{
            width: `${progress}%`,
            backgroundColor: AGENT_LABELS[status].color,
          }}
        />
      </div>

      {/* Pipeline stages */}
      <div className="pipeline-stages">
        {PIPELINE_STAGES.map((stage, idx) => {
          const stageInfo = AGENT_LABELS[stage];
          const isComplete = idx < currentStageIndex;
          const isCurrent = stage === status;
          const isPending = idx > currentStageIndex;

          return (
            <div
              key={stage}
              className={`pipeline-stage ${isComplete ? 'complete' : ''} ${isCurrent ? 'current' : ''} ${isPending ? 'pending' : ''}`}
            >
              <div
                className="stage-dot"
                style={{
                  backgroundColor: isComplete
                    ? '#22C55E'
                    : isCurrent
                      ? stageInfo.color
                      : '#E2E8F0',
                }}
              >
                {isComplete ? '✓' : isCurrent ? stageInfo.icon : idx + 1}
              </div>
              <span className="stage-label">{stageInfo.label}</span>
            </div>
          );
        })}
      </div>

      {/* Status message */}
      <p className="progress-message">{message}</p>

      {/* Error display */}
      {error && (
        <div className="progress-error">
          <span>❌ {error}</span>
        </div>
      )}

      {/* Quality report (when complete) */}
      {status === 'complete' && qualityReport && (
        <div className="quality-report">
          <h4>Quality Score: {qualityReport.overallScore}/100</h4>
          <div className="quality-breakdown">
            {Object.entries(qualityReport.breakdown).map(([key, value]) => (
              <div key={key} className="quality-item">
                <span className="quality-label">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                <div className="quality-bar-track">
                  <div
                    className="quality-bar-fill"
                    style={{
                      width: `${value}%`,
                      backgroundColor:
                        value >= 80 ? '#22C55E' : value >= 60 ? '#F59E0B' : '#EF4444',
                    }}
                  />
                </div>
                <span className="quality-value">{value}</span>
              </div>
            ))}
          </div>
          {qualityReport.issues.length > 0 && (
            <div className="quality-issues">
              <h5>{qualityReport.issues.length} issues found</h5>
              {qualityReport.issues.slice(0, 5).map((issue) => (
                <div key={`${issue.severity}-${issue.message}`} className={`quality-issue severity-${issue.severity}`}>
                  <span className="issue-badge">{issue.severity}</span>
                  <span>{issue.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .generation-progress-panel {
          background: rgba(15, 23, 42, 0.95);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 16px;
          padding: 24px;
          color: #F1F5F9;
          font-family: 'Inter', sans-serif;
        }

        .progress-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .progress-title {
          font-size: 18px;
          font-weight: 600;
          margin: 0;
        }

        .progress-percentage {
          font-size: 24px;
          font-weight: 700;
          color: ${AGENT_LABELS[status].color};
        }

        .progress-bar-track {
          height: 6px;
          background: rgba(148, 163, 184, 0.2);
          border-radius: 3px;
          overflow: hidden;
          margin-bottom: 24px;
        }

        .progress-bar-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 0.5s ease, background-color 0.3s ease;
        }

        .pipeline-stages {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
          gap: 4px;
        }

        .pipeline-stage {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          flex: 1;
        }

        .stage-dot {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          transition: all 0.3s ease;
          color: white;
          font-weight: 600;
        }

        .pipeline-stage.current .stage-dot {
          box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.1);
          animation: pulse 2s infinite;
        }

        .stage-label {
          font-size: 11px;
          text-align: center;
          color: #94A3B8;
          line-height: 1.2;
        }

        .pipeline-stage.current .stage-label {
          color: #F1F5F9;
          font-weight: 600;
        }

        .pipeline-stage.complete .stage-label {
          color: #22C55E;
        }

        .progress-message {
          font-size: 13px;
          color: #94A3B8;
          margin: 0;
          text-align: center;
        }

        .progress-error {
          margin-top: 12px;
          padding: 12px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 8px;
          color: #FCA5A5;
          font-size: 13px;
        }

        .quality-report {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid rgba(148, 163, 184, 0.1);
        }

        .quality-report h4 {
          margin: 0 0 16px 0;
          font-size: 16px;
        }

        .quality-breakdown {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .quality-item {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .quality-label {
          font-size: 12px;
          color: #94A3B8;
          width: 140px;
          text-transform: capitalize;
        }

        .quality-bar-track {
          flex: 1;
          height: 4px;
          background: rgba(148, 163, 184, 0.2);
          border-radius: 2px;
          overflow: hidden;
        }

        .quality-bar-fill {
          height: 100%;
          border-radius: 2px;
          transition: width 0.5s ease;
        }

        .quality-value {
          font-size: 12px;
          font-weight: 600;
          width: 30px;
          text-align: right;
        }

        .quality-issues {
          margin-top: 16px;
        }

        .quality-issues h5 {
          font-size: 13px;
          color: #94A3B8;
          margin: 0 0 8px 0;
        }

        .quality-issue {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 0;
          font-size: 12px;
          color: #CBD5E1;
        }

        .issue-badge {
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .severity-critical .issue-badge {
          background: rgba(239, 68, 68, 0.2);
          color: #FCA5A5;
        }

        .severity-warning .issue-badge {
          background: rgba(245, 158, 11, 0.2);
          color: #FCD34D;
        }

        .severity-info .issue-badge {
          background: rgba(59, 130, 246, 0.2);
          color: #93C5FD;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
