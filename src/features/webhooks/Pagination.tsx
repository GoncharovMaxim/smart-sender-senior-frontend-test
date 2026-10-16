interface PaginationProps {
  page: number;
  lastPage: number;
  total: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, lastPage, total, onChange }: PaginationProps) {
  return (
    <nav className="pagination" aria-label="Пагінація">
      <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1}>
        ← Назад
      </button>
      <span>
        Сторінка {page} з {lastPage} · записів: {total}
      </span>
      <button type="button" onClick={() => onChange(page + 1)} disabled={page >= lastPage}>
        Далі →
      </button>
    </nav>
  );
}
