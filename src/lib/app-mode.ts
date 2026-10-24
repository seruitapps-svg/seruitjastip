// Hanya di memori: hilang saat halaman di-reload atau aplikasi dibuka ulang.
let orderingMode = false;

export function setOrderingMode(value: boolean) {
  orderingMode = value;
}

export function isOrderingMode() {
  return orderingMode;
}
