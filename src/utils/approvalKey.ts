export const buildApprovalKey = (
  subjectId: string,
  classroomId: string,
  exceptions: readonly string[] | null | undefined
) =>
  `${subjectId}__${classroomId}__${[...new Set((exceptions || []).filter((value): value is string => typeof value === 'string'))].sort().join('|')}`;
