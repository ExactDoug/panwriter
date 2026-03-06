import { RefObject } from 'react'

export interface AppState {
  doc: Doc;
  metaEditorOpen: boolean;
  settings: Settings
  split: ViewSplit;
  paginated: boolean;
  previewDivRef: RefObject<HTMLDivElement>;
}

export interface Doc {
  /** whole editor contents (in markdown) */
  md: string;

  /** part of `md` that's the yaml metadata */
  yaml: string;

  /** rest part of `md` */
  bodyMd: string;

  /** parsed yaml metadata */
  meta: Meta;

  /** bodyMd converted to HTML */
  html: string

  fileName?: string;
  filePath?: string;
  fileDirty: boolean;
}

export type Meta = Record<string, JSON>
export type JSON = string | number | boolean | null | Meta[] | { [key: string]: JSON };

export const viewSplits = ['onlyEditor', 'split', 'onlyPreview'] as const
export type ViewSplit = typeof viewSplits[number]

export interface Settings {
  autoUpdateApp: boolean;
  defaultContentWidth: string;
}

export const defaultSettings: Settings = {
  autoUpdateApp: true
, defaultContentWidth: ''
}

export const contentWidthChoices = [
  { label: 'Default (36em)', value: '' }
, { label: 'Medium (48em)',  value: '48em' }
, { label: 'Wide (60em)',    value: '60em' }
, { label: 'Extra Wide (80em)', value: '80em' }
, { label: 'Full Width',    value: 'none' }
]
