import { normalizeCampusLabel } from '../types';

export interface SubjectTaxonomy {
  faculties: string[];
  departments: string[];
}

const DEFAULT_FACULTIES = ['理工学部', '法学部', '経済学部', '文学部', '全学共通'];
const DEFAULT_DEPARTMENTS = ['理', '工', '法', '経', '文', '他'];

const dedupe = (items: string[]) => Array.from(new Set(items.map(item => item.trim()).filter(Boolean)));

export const getDefaultSubjectTaxonomy = (campusLabel: string): SubjectTaxonomy => {
  void campusLabel;
  return {
    faculties: [...DEFAULT_FACULTIES],
    departments: [...DEFAULT_DEPARTMENTS]
  };
};

export const normalizeSubjectTaxonomy = (value: unknown, campusLabel: string): SubjectTaxonomy => {
  const defaults = getDefaultSubjectTaxonomy(normalizeCampusLabel(campusLabel) || campusLabel);
  if (!value || typeof value !== 'object') return defaults;
  const raw = value as Partial<SubjectTaxonomy> & { faculties?: unknown; departments?: unknown };
  const faculties = Array.isArray(raw.faculties)
    ? dedupe(raw.faculties.filter((item): item is string => typeof item === 'string'))
    : defaults.faculties;
  const departments = Array.isArray(raw.departments)
    ? dedupe(raw.departments.filter((item): item is string => typeof item === 'string'))
    : defaults.departments;
  return {
    faculties: faculties.length > 0 ? faculties : defaults.faculties,
    departments: departments.length > 0 ? departments : defaults.departments
  };
};
