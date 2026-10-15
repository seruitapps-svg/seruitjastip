import { describe, test } from "node:test";
import assert from "node:assert/strict";
const expect = (value) => ({ toBe: (expected) => assert.equal(value, expected) });
import { calculateMonetization } from "./monetization.ts";
import { calculatePrice } from "./pricing.ts";

describe("monetisasi dua sisi", () => {
  test("biaya layanan diambil dari tarif dasar tanpa menambah ongkir", () => {
    const p = calculatePrice({ distanceMeters: 5800, weightKg: 1, lengthCm: 20, widthCm: 20, heightCm: 20 });
    expect(p.shippingFare).toBe(6000);
    expect(p.consumerServiceFee).toBe(3000);
    expect(p.total).toBe(9000);
  });
  test("total konsumen adalah ongkir ditambah biaya layanan", () => {
    expect(calculateMonetization(10000, 3000, 10, "cod").total).toBe(13000);
  });
  test("komisi persentase hanya dari ongkir", () => {
    expect(calculateMonetization(10000, 3000, 15, "cod").driverCommission).toBe(1500);
  });
  test("tunai memotong deposit layanan dan komisi tanpa kredit penghasilan", () => {
    const m = calculateMonetization(10000, 3000, 10, "cod");
    expect(m.depositDeduction).toBe(4000);
    expect(m.driverNetEarnings).toBe(9000);
    expect(m.earningsCredit).toBe(0);
  });
  test("non-tunai menambah penghasilan bersih tanpa potong deposit", () => {
    const m = calculateMonetization(10000, 3000, 10, "transfer");
    expect(m.depositDeduction).toBe(0);
    expect(m.earningsCredit).toBe(9000);
  });
});