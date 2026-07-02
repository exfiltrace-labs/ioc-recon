export function compileRegex(pattern: string, flags?: string): RegExp | null {
  if (!pattern) return null;
  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

const VALID_FLAGS = 'dgimsuvy';

export function regexError(pattern: string, flags?: string): string | null {
  if (!pattern) return null;
  if (flags) {
    const seen = new Set<string>();
    for (const f of flags) {
      if (!VALID_FLAGS.includes(f)) return 'Unknown flag. Use "i" to ignore case.';
      if (seen.has(f)) return 'Repeated flag.';
      seen.add(f);
    }
  }
  try {
    new RegExp(pattern, flags);
    return null;
  } catch {
    return 'Not a valid regular expression.';
  }
}
