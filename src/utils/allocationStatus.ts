import type { Allocation, Subject } from '../types';

export const buildAllocationCountBySubjectId = (allocations: Allocation[]) => {
  const counts = new Map<string, number>();
  allocations.forEach(allocation => {
    counts.set(allocation.subjectId, (counts.get(allocation.subjectId) || 0) + 1);
  });
  return counts;
};

export const getSubjectAllocationCount = (subject: Subject, counts: Map<string, number>) =>
  counts.get(subject.id) || 0;

export const isSubjectFullyAllocated = (subject: Subject, counts: Map<string, number>) =>
  getSubjectAllocationCount(subject, counts) >= (subject.requiredRoomCount || 1);

export const isSubjectUnfilled = (subject: Subject, counts: Map<string, number>) =>
  !isSubjectFullyAllocated(subject, counts);

export const shouldIncludeSubjectForAllocation = (
  subject: Subject,
  counts: Map<string, number>,
  options: { includeAllocated: boolean; includeUnassigned: boolean }
) => {
  const isFullyAllocated = isSubjectFullyAllocated(subject, counts);
  if (isFullyAllocated && !options.includeAllocated) return false;
  if (!isFullyAllocated && !options.includeUnassigned) return false;
  return true;
};
