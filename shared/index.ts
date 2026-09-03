export enum GenerationTone {
  PROFESSIONAL = 'professional',
  CASUAL = 'casual',
  ACADEMIC = 'academic',
  CREATIVE = 'creative',
  PERSUASIVE = 'persuasive',
}

export type LayoutType =
  | 'title'
  | 'title-hero'
  | 'title-subtitle'
  | 'title-content'
  | 'two-column'
  | 'two-column-image'
  | 'three-column'
  | 'image-left'
  | 'image-right'
  | 'image-full'
  | 'comparison'
  | 'timeline'
  | 'quote-highlight'
  | 'stats-grid'
  | 'chart-focus'
  | 'bento-grid'
  | 'gallery'
  | 'agenda'
  | 'content';
