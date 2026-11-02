import { revalidatePath } from 'next/cache';
import type { Article } from './types';
import { articlePath } from './categories';

// Refresh cached pages when an editor saves, publishes or unpublishes, so
// readers see the change at once instead of waiting for the cache to expire.
export function revalidateNewsroom(a?: Pick<Article, 'section' | 'category' | 'slug'>) {
  try {
    revalidatePath('/');
    revalidatePath('/sports');
    if (a) {
      revalidatePath(`/${a.section}`);
      revalidatePath(`/${a.section}/${a.category}`);
      revalidatePath(articlePath(a));
    } else {
      revalidatePath('/news');
      revalidatePath('/politics');
    }
  } catch {
    /* outside a request (tests): nothing to refresh */
  }
}
