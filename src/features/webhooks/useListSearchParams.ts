import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

function parsePage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

/**
 * Page and search live in the URL only — reload and back/forward restore them for free.
 * Defaults (page 1, empty search) are omitted from the URL to keep it clean.
 */
export function useListSearchParams() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parsePage(searchParams.get('page'));
  const search = searchParams.get('search') ?? '';

  const setPage = useCallback(
    (next: number) =>
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        if (next > 1) params.set('page', String(next));
        else params.delete('page');
        return params;
      }),
    [setSearchParams],
  );

  const setSearch = useCallback(
    (next: string) =>
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        if (next) params.set('search', next);
        else params.delete('search');
        params.delete('page'); // a new search always starts from the first page
        return params;
      }),
    [setSearchParams],
  );

  return { page, search, setPage, setSearch };
}
