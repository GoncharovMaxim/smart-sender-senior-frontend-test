import { setupWorker } from 'msw/browser';
import { API_BASE_URL } from '../config';
import { createDb } from './db';
import { createHandlers } from './handlers';

// State lives in page memory, so a reload resets it (and the session) — allowed by the task.
export const worker = setupWorker(...createHandlers({ baseUrl: API_BASE_URL, db: createDb() }));
