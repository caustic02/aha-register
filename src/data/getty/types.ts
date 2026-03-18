// src/data/getty/types.ts

export interface GettyTerm {
  uri: string;          // e.g., "http://vocab.getty.edu/aat/300015050"
  label_en: string;     // e.g., "oil painting"
  label_de?: string;    // e.g., "Ölmalerei"
  parent_en?: string;   // e.g., "painting techniques"
  scopeNote_en?: string;
}

export interface VocabularySelection {
  label: string;        // displayed label
  uri: string | null;   // AAT URI if Getty term, null if free text
}
