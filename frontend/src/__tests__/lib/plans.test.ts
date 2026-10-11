import {
  PLAN_LIMITS,
  canExportFormat,
  presentationLimit,
  aiGenerationLimit,
  getPlanLimits,
} from '@/lib/plans';

describe('PLAN_LIMITS', () => {
  it('defines Free as 3 presentations and 10 AI generations', () => {
    expect(PLAN_LIMITS.FREE.presentations).toBe(3);
    expect(PLAN_LIMITS.FREE.aiGenerationsPerMonth).toBe(10);
  });

  it('allows Free HTML/JSON and locks PDF/PPTX', () => {
    expect(canExportFormat('FREE', 'html')).toBe(true);
    expect(canExportFormat('FREE', 'json')).toBe(true);
    expect(canExportFormat('FREE', 'pdf')).toBe(false);
    expect(canExportFormat('FREE', 'pptx')).toBe(false);
  });

  it('allows Pro PDF and PowerPoint', () => {
    expect(canExportFormat('PRO', 'pdf')).toBe(true);
    expect(canExportFormat('PRO', 'pptx')).toBe(true);
  });

  it('resolves helpers from plan id', () => {
    expect(presentationLimit('FREE')).toBe(3);
    expect(aiGenerationLimit('FREE')).toBe(10);
    expect(getPlanLimits('unknown').id).toBe('FREE');
  });
});
