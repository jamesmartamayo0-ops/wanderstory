export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function ensureUniqueSlug(
  baseSlug: string,
  findExisting: (slug: string) => Promise<{ id: string } | null>,
  excludeId?: string
): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await findExisting(slug);

    if (!existing || (excludeId && existing.id === excludeId)) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}
