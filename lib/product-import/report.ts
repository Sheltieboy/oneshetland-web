/**
 * report.ts — the downloadable "rows that need attention" file.
 *
 * Every cell goes through csvCell, which neutralises anything a spreadsheet
 * would run as a formula; the report echoes merchant-supplied (untrusted) text,
 * so this is not optional. Pure, so it runs in the browser from the plan or the
 * stored batch rows.
 */
import { toCsv } from './csv.ts';

export interface ReportItem {
  rows: number[];
  title: string;
  ref?: string | null;
  sku?: string | null;
  action: string;
  status?: string;
  errors: { message: string; field?: string }[];
  warnings: { message: string }[];
  imageProblems?: string[];
}

export const REPORT_HEADERS = ['file_rows', 'title', 'ref', 'sku', 'outcome', 'problems', 'warnings'];

const OUTCOME: Record<string, string> = {
  create: 'Will be added', update: 'Will be updated', unchanged: 'Unchanged', skip: 'Not imported', error: 'Needs attention',
  failed: 'Failed', applied: 'Imported',
};

export function buildReport(items: ReportItem[], opts: { onlyProblems?: boolean } = {}): string {
  const rows = items
    .filter((i) => !opts.onlyProblems || i.errors.length > 0 || i.status === 'failed' || i.action === 'skip' || (i.imageProblems?.length ?? 0) > 0)
    .map((i) => [
      i.rows.join(' '),
      i.title,
      i.ref ?? '',
      i.sku ?? '',
      OUTCOME[i.status === 'failed' ? 'failed' : i.action] ?? i.action,
      [...i.errors.map((e) => e.message), ...(i.imageProblems ?? [])].join(' | '),
      i.warnings.map((w) => w.message).join(' | '),
    ]);
  return toCsv([REPORT_HEADERS, ...rows]);
}
