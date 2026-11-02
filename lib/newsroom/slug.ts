// URL slug from a headline: lowercase ASCII words joined by hyphens, at most
// 80 characters, cut at a word boundary. Non-Latin headlines (e.g. Telugu)
// have no ASCII letters, so the editor is asked to type the slug instead.
export function slugify(input: string, max = 80): string {
  const base = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (base.length <= max) return base;
  const cut = base.slice(0, max);
  const lastDash = cut.lastIndexOf('-');
  return (lastDash > 20 ? cut.slice(0, lastDash) : cut).replace(/-+$/, '');
}

export function isValidSlug(s: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) && s.length <= 80;
}

// Makes a slug unique among `taken` by adding -2, -3, ...
export function uniqueSlug(slug: string, taken: Set<string>): string {
  if (!taken.has(slug)) return slug;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${slug.slice(0, 76)}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${slug.slice(0, 70)}-${Date.now().toString(36)}`;
}
