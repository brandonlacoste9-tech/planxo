export interface TaxBreakout {
  subtotalCents: number;
  tpsCents: number;
  tvqCents: number;
  totalCents: number;
}

const TPS_RATE = 0.05;
const TVQ_RATE = 0.09975;

export function calculateQuebecTaxes(baseAmountCents: number): TaxBreakout {
  const tpsCents = Math.round(baseAmountCents * TPS_RATE);
  const tvqCents = Math.round(baseAmountCents * TVQ_RATE);
  const totalCents = baseAmountCents + tpsCents + tvqCents;

  return { subtotalCents: baseAmountCents, tpsCents, tvqCents, totalCents };
}

export function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function formatTaxBreakdown(tax: TaxBreakout): {
  subtotal: string;
  tps: string;
  tvq: string;
  total: string;
} {
  return {
    subtotal: `${formatCents(tax.subtotalCents)} $`,
    tps: `${formatCents(tax.tpsCents)} $`,
    tvq: `${formatCents(tax.tvqCents)} $`,
    total: `${formatCents(tax.totalCents)} $`,
  };
}
