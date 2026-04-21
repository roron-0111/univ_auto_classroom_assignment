export const buildApprovalKey = (subjectId: string, classroomId: string, exceptions: string[]) =>
  `${subjectId}__${classroomId}__${[...new Set(exceptions)].sort().join('|')}`;
