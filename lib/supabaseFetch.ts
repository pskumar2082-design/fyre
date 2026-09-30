// Asks Supabase for uncompressed responses: Next's server-side fetch has
// failed to decompress them (see lib/supabaseClient.ts).
export const supabaseFetch: typeof fetch = (input, init) => {
  // init?.headers can be a Headers instance, a plain object, or an array
  // of tuples depending on caller -- spreading it with `...` silently
  // drops everything if it's a Headers instance (its entries aren't
  // enumerable own properties), which would strip the `apikey`/
  // `Authorization` headers supabase-js sets and break every request.
  // Routing it through the Headers constructor merges correctly no
  // matter which shape came in.
  const headers = new Headers(init?.headers);
  headers.set('Accept-Encoding', 'identity');
  return fetch(input, { ...init, headers });
};
