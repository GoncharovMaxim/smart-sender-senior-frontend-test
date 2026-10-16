import { builtinEnvironments, type Environment } from 'vitest/environments';

/**
 * jsdom, but with Node's AbortController/AbortSignal: Node's fetch/Request (used by MSW and
 * React Router) reject jsdom's AbortSignal ("Expected signal to be an instance of AbortSignal").
 */
export default {
  name: 'jsdom-node-abort',
  transformMode: 'web',
  async setup(global, options) {
    const { AbortController, AbortSignal } = global as typeof globalThis;
    const env = await builtinEnvironments.jsdom.setup(global, options);
    Object.assign(global, { AbortController, AbortSignal });
    return env;
  },
} satisfies Environment;
