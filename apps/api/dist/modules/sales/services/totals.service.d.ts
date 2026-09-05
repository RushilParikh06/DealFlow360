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
export declare function computeLineTotals(line: LineInput): LineTotals;
export interface QuotationTotals {
    subtotalMinor: number;
    discountMinor: number;
    taxMinor: number;
    totalMinor: number;
}
export declare function computeQuotationTotals(lines: LineInput[]): QuotationTotals;
