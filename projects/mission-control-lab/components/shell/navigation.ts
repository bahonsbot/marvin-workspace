import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BarChart3,
  Bot,
  Brain,
  CheckSquare,
  Clock,
  Eye,
  FolderOpen,
  HeartPulse,
  LayoutDashboard,
  MessageSquare,
  Newspaper,
  PieChart,
  Search,
  Wand2,
} from 'lucide-react';

export type ShellDomain = 'general' | 'trading';

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  match?: (pathname: string) => boolean;
};

export const GENERAL_HOME = '/general/home';
export const TRADING_HOME = '/trading';

export const DOMAIN_META: Record<ShellDomain, { roomLabel: string }> = {
  general: { roomLabel: 'MARVIN’S ROOM' },
  trading: { roomLabel: 'BOILER ROOM' },
};

export const DOMAIN_TABS: Array<{ label: string; href: string; domain: ShellDomain }> = [
  { label: 'General', href: GENERAL_HOME, domain: 'general' },
  { label: 'Trading', href: TRADING_HOME, domain: 'trading' },
];

export const GENERAL_NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '/general/home', icon: LayoutDashboard },
  { label: 'Chat', href: '/general/chat', icon: MessageSquare },
  { label: 'Tasks', href: '/general/tasks', icon: CheckSquare },
  { label: 'Agents', href: '/general/agents', icon: Bot },
  { label: 'Skills', href: '/general/skills', icon: Wand2 },
  { label: 'Crons', href: '/general/crons', icon: Clock },
  { label: 'Memory', href: '/general/memory', icon: Brain },
  { label: 'Files', href: '/general/files', icon: FolderOpen },
];

export const TRADING_NAV_ITEMS: NavItem[] = [
  { label: 'Overview', href: '/trading', icon: LayoutDashboard, match: (pathname) => pathname === '/trading' },
  { label: 'Portfolio', href: '/trading/portfolio', icon: PieChart },
  { label: 'Watchlist', href: '/trading/watchlist', icon: Eye },
  { label: 'Health', href: '/trading/health', icon: HeartPulse },
  { label: 'Analytics', href: '/trading/analytics', icon: BarChart3 },
  { label: 'News', href: '/trading/news', icon: Newspaper },
  { label: 'Screener', href: '/trading/screener', icon: Search },
  { label: 'Bots', href: '/trading/bots', icon: Activity },
];

export function getShellDomain(pathname: string): ShellDomain {
  return pathname.startsWith('/trading') ? 'trading' : 'general';
}

export function isItemActive(pathname: string, item: NavItem) {
  if (item.match) return item.match(pathname);
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
