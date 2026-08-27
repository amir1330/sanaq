/** In-store EAN-13 (prefix 20). For packed goods that have no factory barcode. */
export function makeInternalBarcode(): string {
  const body = `20${Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join("")}`;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(body[i]) * (i % 2 === 0 ? 1 : 3);
  return `${body}${(10 - (sum % 10)) % 10}`;
}
