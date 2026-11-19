// Trait strings are written compactly in content: "strength3 balance2 focus1".
export function parseTraits(s: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of s.matchAll(/([a-z][a-z-]*?)(\d)(?=\s|$)/g)) out[m[1]] = Number(m[2]);
  return out;
}
