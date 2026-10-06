import { HttpClient } from './http';
import { LocalClient } from './local';
import type { ApiClient } from './types';

export * from './types';

const mode = (import.meta.env.VITE_API_MODE as string | undefined) ?? 'demo';

export const api: ApiClient = mode === 'server' ? new HttpClient() : new LocalClient();
