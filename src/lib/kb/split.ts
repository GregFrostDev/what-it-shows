// Splits a merged ticket into the problems its reports really have. Pages explain it; this file is what runs.
// Counts follow the desk's own view (CauseTable): every report sits under its cause from causes.ts
// (`parser`, `hint`). The third problem, `one-day`, is the list the desk keeps in desk-notes.json; the desk
// files those reports under their cause by tenant, so the `one-day` row is counted inside that cause.
import { causeOf, uniqueById, type Report, type Tenant } from '#lib/kb/causes';

export type Problem = 'parser' | 'hint' | 'one-day' | 'unplaced';

export type ProblemGroup = {
  problem: Problem;
  reports: Report[];
  // Set when this row's reports are already counted under another problem.
  within?: Problem;
  tenants: number;
  firstSeen: string;
  lastSeen: string;
  // What intake tagged these reports as: tag → count.
  taggedAs: Record<string, number>;
};

export function problemOf(r: Report, t: Tenant | undefined): Problem {
  return causeOf(r, t) ?? 'unplaced';
}

export function splitTicket(
  all: Report[],
  ticket: number,
  tenantOf: (r: Report) => Tenant | undefined,
  oneDayMove: readonly string[],
): { rows: number; unique: number; groups: ProblemGroup[] } {
  const merged = all.filter((r) => r.mergedInto === ticket);
  const unique = uniqueById(merged);
  const by = new Map<Problem, Report[]>();
  for (const r of unique) {
    const p = problemOf(r, tenantOf(r));
    by.set(p, [...(by.get(p) ?? []), r]);
  }
  const moved = unique.filter((r) => oneDayMove.includes(r.id));
  const within = [...new Set(moved.map((r) => problemOf(r, tenantOf(r))))];
  const groups: ProblemGroup[] = [...by.entries()]
    .map(([problem, rs]) => summarize(problem, rs))
    .sort((a, b) => b.reports.length - a.reports.length);
  if (moved.length) groups.push({ ...summarize('one-day', moved), within: within.length === 1 ? within[0] : undefined });
  return { rows: merged.length, unique: unique.length, groups };
}

function summarize(problem: Problem, rs: Report[]): ProblemGroup {
  const days = rs.map((r) => r.receivedAt.slice(0, 10)).sort();
  return {
    problem,
    reports: rs,
    tenants: new Set(rs.map((r) => r.tenant)).size,
    firstSeen: days[0],
    lastSeen: days[days.length - 1],
    taggedAs: rs.reduce<Record<string, number>>((n, r) => ({ ...n, [r.meta.intakeTag]: (n[r.meta.intakeTag] ?? 0) + 1 }), {}),
  };
}
