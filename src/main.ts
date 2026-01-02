import type { Person, Group, GroupMember } from './utils/ct-types';
import { churchtoolsClient } from '@churchtools/churchtools-client';

// only import reset.css in development mode to keep the production bundle small and to simulate CT environment
if (import.meta.env.MODE === 'development') {
    import('./utils/reset.css');
}

declare const window: Window &
    typeof globalThis & {
        settings: {
            base_url?: string;
        };
    };

const baseUrl = window.settings?.base_url ?? import.meta.env.VITE_BASE_URL;
churchtoolsClient.setBaseUrl(baseUrl);

const username = import.meta.env.VITE_USERNAME;
const password = import.meta.env.VITE_PASSWORD;
if (import.meta.env.MODE === 'development' && username && password) {
    await churchtoolsClient.post('/login', { username, password });
}

const KEY = import.meta.env.VITE_KEY;
export { KEY };

const user = await churchtoolsClient.get<Person>(`/whoami`);

const groups = await churchtoolsClient.get<Group[]>('/groups');
const data = await churchtoolsClient.get<GroupMember[]>('/groups/32/members');

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div style="display: flex; place-content: center; place-items: center; height: 100vh;">
    <h1>Welcome ${[user.firstName, user.lastName].join(' ')}</h1>
    <p>${groups[0].name}</p>
    <p>${data[3].person.title}</p>
  </div>
`;
