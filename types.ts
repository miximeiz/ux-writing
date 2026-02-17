export interface UploadedFile {
  id: string;
  name: string;
  content: string;
  type: 'glossary' | 'style-guide' | 'general';
  mimeType?: string;
  isBinary?: boolean;
}

export enum AppMode {
  UPLOAD = 'UPLOAD',
  SEARCH = 'SEARCH',
  GENERATE = 'GENERATE',
  STYLE_GUIDE = 'STYLE_GUIDE',
  BILINGUAL_MATCH = 'BILINGUAL_MATCH',
}

export interface MicrocopyContent {
  language?: string;
  title?: string;
  description: string;
  primaryButton?: string;
  secondaryButton?: string;
}

export interface GenerationOption {
  variantName: string;
  content: MicrocopyContent[];
}

export interface GenerationResult {
  primary: GenerationOption;
  alternatives: GenerationOption[];
  rationale: string;
}

export interface SearchResultItem {
  term: string;
  definitions: Array<{ label: string; text: string }>;
  metadata: Array<{ key: string; value: string }>;
  source: string;
  usageNotes: string;
}

export interface SearchResult {
  matchFound: boolean;
  message: string;
  results: SearchResultItem[];
}

export interface BilingualAlignment {
  matches: Array<{ en: string; th: string }>;
  unmatchedEn: string[];
  unmatchedTh: string[];
}