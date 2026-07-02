export function isHttpProtocol(protocol: string): boolean {
  return protocol === 'http:' || protocol === 'https:';
}
