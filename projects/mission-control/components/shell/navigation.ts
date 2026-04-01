export type ShellDomain = 'general' | 'trading';

export type NavItem = {
  label: string;
  href: string;
  icon: string;
  match?: (pathname: string) => boolean;
};

export const GENERAL_HOME = '/general/home';
export const TRADING_HOME = '/trading';

export const DOMAIN_TABS: Array<{ label: string; href: string; domain: ShellDomain }> = [
  { label: 'General', href: GENERAL_HOME, domain: 'general' },
  { label: 'Trading', href: TRADING_HOME, domain: 'trading' },
];

export const GENERAL_NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '/general/home', icon: '⌂' },
  { label: 'Chat', href: '/general/chat', icon: '◎' },
  { label: 'Tasks', href: '/general/tasks', icon: '☑' },
  { label: 'Agents', href: '/general/agents', icon: '◉' },
  { label: 'Crons', href: '/general/crons', icon: '⊚' },
  { label: 'Memory', href: '/general/memory', icon: '◈' },
  { label: 'Files', href: '/general/files', icon: '▣' },
];

export const TRADING_NAV_ITEMS: NavItem[] = [
  { label: 'Overview', href: '/trading', icon: '◌' },
  { label: 'Market Intel', href: '/trading/market-intel', icon: '◫' },
  { label: 'Signals', href: '/trading/signals', icon: '⇡' },
  { label: 'Watchlist', href: '/trading/watchlist', icon: '◍' },
  { label: 'Bot / Dispatch', href: '/trading/bot', icon: '↗' },
  { label: 'Reports', href: '/trading/reports', icon: '▤' },
];

export function getShellDomain(pathname: string): ShellDomain {
  return pathname.startsWith('/trading') ? 'trading' : 'general';
}

export function isItemActive(pathname: string, item: NavItem) {
  if (item.match) return item.match(pathname);
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
