const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;

export function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

export function isValidEthAddress(address: string): boolean {
  return ethAddressRegex.test(address.trim());
}
