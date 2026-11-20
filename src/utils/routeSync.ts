import type { ViewId } from '../types/postharvest';

export interface ParsedRoute {
  view: ViewId;
  roomId?: string;
}

export function parseRoutePath(
  pathname: string,
  validRoomIds: string[]
): ParsedRoute | null {
  const clean = pathname.replace(/\/+$/, '') || '/';

  if (clean === '/' || clean === '/dashboard') {
    return { view: 'dashboard' };
  }

  if (clean === '/rooms') {
    return { view: 'rooms' };
  }

  if (clean.startsWith('/rooms/')) {
    const candidate = decodeURIComponent(clean.slice('/rooms/'.length));
    if (validRoomIds.includes(candidate)) {
      return { view: 'rooms', roomId: candidate };
    }
    return { view: 'rooms' };
  }

  if (clean === '/inventory') {
    return { view: 'inventory' };
  }

  if (clean === '/alerts') {
    return { view: 'alerts' };
  }

  return null;
}

export function buildRoutePath(view: ViewId, selectedRoomId?: string): string {
  switch (view) {
    case 'dashboard':
      return '/';
    case 'rooms':
      return selectedRoomId
        ? `/rooms/${encodeURIComponent(selectedRoomId)}`
        : '/rooms';
    case 'inventory':
      return '/inventory';
    case 'alerts':
      return '/alerts';
  }
}
