export interface SmartInsertPrompt {
  id: string;
  title: string;
  body: string;
  variables: string[];
  favorite?: boolean;
  useCount?: number;
}
export interface SmartInsertVariableMap {
  [name: string]: string;
}
export interface SmartInsertProfile {
  id: string;
  name: string;
  values: SmartInsertVariableMap;
  favorite?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
export interface SmartInsertHistoryEntry {
  id: string;
  promptId: string;
  label: string;
  reason: string;
  usedAt: string;
}
export interface SmartInsertValidationResult {
  ok: boolean;
  names: string[];
  values: SmartInsertVariableMap;
  missing: string[];
  invalid: string[];
  preview: string;
}
export type HafizeLegacyRoot = Window & Record<string, any>;
