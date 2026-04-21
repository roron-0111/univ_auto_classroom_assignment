import type { Subject, Term } from '../types';

const TERM_PARTNERS: Partial<Record<Term, Term>> = {
    spring: 'autumn',
    autumn: 'spring'
};

const isProvisionalTeacherCode = (code: string) => code.trim().startsWith('9');

export const subjectsShareTeacherIdentity = (a: Subject, b: Subject) => {
    const aCode = (a.teacherCode || '').trim();
    const bCode = (b.teacherCode || '').trim();

    if (aCode && bCode) {
        if (isProvisionalTeacherCode(aCode) || isProvisionalTeacherCode(bCode)) return false;
        return aCode === bCode;
    }
    if (aCode || bCode) return false;
    return a.teacher.trim() !== '' && a.teacher === b.teacher;
};

export const findTermPartner = (subject: Subject, subjects: Subject[]) => {
    if (subject.linkedSubjectId) {
        const linked = subjects.find(s => s.id === subject.linkedSubjectId);
        if (linked) return linked;
    }

    const oppositeTerm = TERM_PARTNERS[subject.term];
    if (!oppositeTerm) return null;

    const candidates = subjects.filter(s =>
        s.term === oppositeTerm &&
        s.day === subject.day &&
        s.period === subject.period &&
        subjectsShareTeacherIdentity(subject, s)
    );

    return candidates.length === 1 ? candidates[0] : null;
};
