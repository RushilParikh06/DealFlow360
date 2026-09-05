// B1 owned. Pure arithmetic: subtotal/discount/lineTotal from unit price, qty
// and the line's own discountBps. Tax is not computed here - B3 owns tax
// rules and nothing wires that seam yet, so taxMinor stays 0 until it does.
import { applyBps } from '@dealflow/contracts';

export interface LineInput {
  unitPriceMinor: number;
  qty: number;
  discountBps: number;
}

export interface LineTotals {
  subtotalMinor: number;
  discountMinor: number;
  lineTotalMinor: number;
}

export function computeLineTotals(line: LineInput): LineTotals {
  const subtotalMinor = line.unitPriceMinor * line.qty;
  const discountMinor = applyBps(subtotalMinor, line.discountBps);
  return { subtotalMinor, discountMinor, lineTotalMinor: subtotalMinor - discountMinor };
}

export interface QuotationTotals {
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
}

export function computeQuotationTotals(lines: LineInput[]): QuotationTotals {
  const perLine = lines.map(computeLineTotals);
  const subtotalMinor = perLine.reduce((s, l) => s + l.subtotalMinor, 0);
  const discountMinor = perLine.reduce((s, l) => s + l.discountMinor, 0);
  const taxMinor = 0; // TODO(B3 seam): wire tax-rule resolution once available
  return { subtotalMinor, discountMinor, taxMinor, totalMinor: subtotalMinor - discountMinor + taxMinor };
}
