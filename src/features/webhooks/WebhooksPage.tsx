import { Link, useLocation } from 'react-router';
import type { Webhook } from '../../api/types';
import { WEBHOOKS_PAGE_SIZE } from '../../config';
import { getErrorMessage } from '../../lib/error-message';
import { Pagination } from './Pagination';
import { useWebhookList } from './queries';
import { SearchBox } from './SearchBox';
import { useListSearchParams } from './useListSearchParams';

export function WebhooksPage() {
  const { page, search, setPage, setSearch } = useListSearchParams();
  const query = useWebhookList({ page, limit: WEBHOOKS_PAGE_SIZE, search: search.trim() });

  return (
    <section>
      <div className="toolbar">
        <h1>Вебхуки</h1>
        <SearchBox value={search} onChange={setSearch} />
      </div>

      {query.isPending ? (
        <p className="status">Завантаження…</p>
      ) : query.isError ? (
        <div className="status error" role="alert">
          <p>Не вдалося завантажити вебхуки: {getErrorMessage(query.error)}</p>
          <button type="button" onClick={() => void query.refetch()}>
            Спробувати ще раз
          </button>
        </div>
      ) : query.data.data.length === 0 ? (
        <div className="status">
          {query.data.paging.results.total > 0 ? (
            <p>Сторінки {page} не існує.</p>
          ) : search ? (
            <p>За запитом «{search}» нічого не знайдено.</p>
          ) : (
            <p>Вебхуків немає.</p>
          )}
          {page > 1 && (
            <button type="button" onClick={() => setPage(1)}>
              На першу сторінку
            </button>
          )}
        </div>
      ) : (
        <>
          <WebhookTable webhooks={query.data.data} dimmed={query.isPlaceholderData} />
          <Pagination
            page={page}
            lastPage={query.data.paging.pages.last}
            total={query.data.paging.results.total}
            onChange={setPage}
          />
        </>
      )}
    </section>
  );
}

function WebhookTable({ webhooks, dimmed }: { webhooks: Webhook[]; dimmed: boolean }) {
  const location = useLocation();
  // The edit page returns exactly to this page/search.
  const backTo = location.pathname + location.search;

  return (
    <table className={dimmed ? 'table dimmed' : 'table'} aria-busy={dimmed}>
      <thead>
        <tr>
          <th>Назва</th>
          <th>URL</th>
          <th>Активність</th>
        </tr>
      </thead>
      <tbody>
        {webhooks.map((webhook) => (
          <tr key={webhook.id}>
            <td>
              <Link to={`/webhooks/${webhook.id}`} state={{ backTo }}>
                {webhook.name}
              </Link>
            </td>
            <td className="url">{webhook.url}</td>
            <td>
              <span className={webhook.active ? 'badge on' : 'badge off'}>
                {webhook.active ? 'Активний' : 'Вимкнений'}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
