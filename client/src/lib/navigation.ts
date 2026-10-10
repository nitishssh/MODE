import type { SessionUser } from '../generated/contracts';
export const destinations = [
  { name: 'index', label: 'Overview', permission: null },
  { name: 'pass', label: 'My pass', permission: null },
  { name: 'tasks', label: 'Tasks', permission: null },
  { name: 'treasury', label: 'Treasury', permission: 'ledger:read' },
] as const;
export function canVisit(user: SessionUser, name: string): boolean {
  const route = destinations.find(item => item.name === name);
  return !!route && (!route.permission || user.permissions.includes(route.permission));
}
