import { PACKAGE_LIMITS, PRICING } from "./config";

export interface PriceInput {
  distanceMeters: number;
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

export interface PriceBreakdown {
  distanceKm: number;
  billedKm: number;
  baseFare: number;
  distanceFare: number;
  oversize: boolean;
  oversizeFee: number;
  total: number;
  // Paket terlalu besar bahkan untuk motor — perlu konfirmasi admin
  needsAdminConfirm: boolean;
}

export function isOversize(
  weightKg: number,
  lengthCm: number,
  widthCm: number,
  heightCm: number,
): boolean {
  return (
    weightKg > PACKAGE_LIMITS.maxWeightKg ||
    lengthCm > PACKAGE_LIMITS.maxDimCm ||
    widthCm > PACKAGE_LIMITS.maxDimCm ||
    heightCm > PACKAGE_LIMITS.maxDimCm
  );
}

export function calculatePrice(input: PriceInput): PriceBreakdown {
  const distanceKm = input.distanceMeters / 1000;
  const billedKm = Math.max(1, Math.ceil(distanceKm));
  const oversize = isOversize(
    input.weightKg,
    input.lengthCm,
    input.widthCm,
    input.heightCm,
  );
  const oversizeFee = oversize ? PRICING.oversizeFee : 0;
  const distanceFare = billedKm * PRICING.perKm;
  const total = PRICING.baseFare + distanceFare + oversizeFee;
  const needsAdminConfirm =
    input.weightKg > PACKAGE_LIMITS.hardMaxWeightKg ||
    input.lengthCm > PACKAGE_LIMITS.hardMaxDimCm ||
    input.widthCm > PACKAGE_LIMITS.hardMaxDimCm ||
    input.heightCm > PACKAGE_LIMITS.hardMaxDimCm;

  return {
    distanceKm,
    billedKm,
    baseFare: PRICING.baseFare,
    distanceFare,
    oversize,
    oversizeFee,
    total,
    needsAdminConfirm,
  };
}
