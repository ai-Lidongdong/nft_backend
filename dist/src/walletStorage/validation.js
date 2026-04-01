const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
export function normalizeAddress(address) {
    return address.trim().toLowerCase();
}
export function isValidEthAddress(address) {
    return ethAddressRegex.test(address.trim());
}
//# sourceMappingURL=validation.js.map