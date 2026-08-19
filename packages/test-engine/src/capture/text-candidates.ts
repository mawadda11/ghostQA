export type VisibleTextCandidateKind =
  | "STATUS"
  | "ALERT"
  | "LIVE_REGION"
  | "HEADING"
  | "PROMINENT_TEXT";

export interface VisibleTextCandidateObservation {
  text: string;
  kind: VisibleTextCandidateKind;
  visible: boolean;
  insideNavigation: boolean;
  interactive: boolean;
}

const priority: Record<VisibleTextCandidateKind, number> = {
  ALERT: 0,
  STATUS: 1,
  LIVE_REGION: 2,
  HEADING: 3,
  PROMINENT_TEXT: 4,
};

export const selectUsefulTextCandidates = (
  observations: readonly VisibleTextCandidateObservation[],
  limit = 12,
): string[] => {
  const seen = new Set<string>();
  return [...observations]
    .map((candidate, order) => ({
      ...candidate,
      order,
      text: candidate.text.replace(/\s+/g, " ").trim(),
    }))
    .filter(
      ({ text, visible, insideNavigation, interactive }) =>
        visible &&
        !insideNavigation &&
        !interactive &&
        text.length >= 2 &&
        text.length <= 160,
    )
    .sort(
      (left, right) =>
        priority[left.kind] - priority[right.kind] || left.order - right.order,
    )
    .filter(({ text }) => {
      const key = text.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit)
    .map(({ text }) => text);
};
