export function calculateMonetization(shippingFare: number, serviceFee: number, percent: number, paymentMethod: string) {
  const driverCommission = Math.ceil(shippingFare * percent / 100);
  const driverNetEarnings = shippingFare - driverCommission;
  return {
    shippingFare,
    serviceFee,
    total: shippingFare + serviceFee,
    percent,
    driverCommission,
    driverNetEarnings,
    depositDeduction: paymentMethod === "cod" ? serviceFee + driverCommission : 0,
    earningsCredit: paymentMethod === "cod" ? 0 : driverNetEarnings,
  };
}