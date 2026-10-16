import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { WebhookInput, WebhookListParams } from '../../api/types';
import { api } from '../../app/services';

export const webhookKeys = {
  all: ['webhooks'] as const,
  lists: () => [...webhookKeys.all, 'list'] as const,
  list: (params: WebhookListParams) => [...webhookKeys.lists(), params] as const,
  detail: (id: number) => [...webhookKeys.all, 'detail', id] as const,
};

export function useWebhookList(params: WebhookListParams) {
  return useQuery({
    queryKey: webhookKeys.list(params),
    queryFn: ({ signal }) => api.webhooks.list(params, signal),
    // Keep the current page on screen while the next one loads.
    placeholderData: keepPreviousData,
  });
}

export function useWebhook(id: number) {
  return useQuery({
    queryKey: webhookKeys.detail(id),
    queryFn: ({ signal }) => api.webhooks.get(id, signal),
  });
}

export function useUpdateWebhook(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: WebhookInput) => api.webhooks.update(id, input),
    onSuccess: (webhook) => {
      queryClient.setQueryData(webhookKeys.detail(id), webhook);
      return queryClient.invalidateQueries({ queryKey: webhookKeys.lists() });
    },
  });
}
