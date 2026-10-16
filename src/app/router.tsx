import { createBrowserRouter, Navigate } from 'react-router';
import { RequireAuth } from '../auth/RequireAuth';
import { LoginPage } from '../features/login/LoginPage';
import { WebhookEditPage } from '../features/webhooks/WebhookEditPage';
import { WebhooksPage } from '../features/webhooks/WebhooksPage';
import { AppLayout } from './AppLayout';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/webhooks', element: <WebhooksPage /> },
          { path: '/webhooks/:id', element: <WebhookEditPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/webhooks" replace /> },
]);
