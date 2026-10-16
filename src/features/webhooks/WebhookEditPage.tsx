import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { isApiError } from '../../api/errors';
import { getErrorMessage } from '../../lib/error-message';
import { readStateString } from '../../lib/router-state';
import { useWebhook } from './queries';
import { WebhookForm } from './WebhookForm';

export function WebhookEditPage() {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const id = Number(params.id);
  const backTo = readStateString(location.state, 'backTo') ?? '/webhooks';

  return (
    <section className="narrow">
      <Link to={backTo} className="back">
        ← До списку
      </Link>
      <h1>Редагування вебхука</h1>
      {Number.isInteger(id) && id > 0 ? (
        <WebhookEditor id={id} onDone={() => navigate(backTo)} />
      ) : (
        <p className="status">Вебхук не знайдено.</p>
      )}
    </section>
  );
}

function WebhookEditor({ id, onDone }: { id: number; onDone: () => void }) {
  const query = useWebhook(id);

  if (query.isPending) return <p className="status">Завантаження…</p>;
  if (query.isError) {
    return (
      <p className="status error" role="alert">
        {isApiError(query.error, 404) ? 'Вебхук не знайдено.' : getErrorMessage(query.error)}
      </p>
    );
  }
  return <WebhookForm key={query.data.id} webhook={query.data} onSaved={onDone} onCancel={onDone} />;
}
