// ============================================================================
// SIDEBAR NAVIGATION - Adapted for Wouter
// Arquivo: src/components/layout/Sidebar.tsx
// ============================================================================

import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { 
  LayoutDashboard, 
  Activity,
  TrendingUp,
  Shield,
  Target,
  Waves,
  LineChart,
  AlertTriangle,
  Swords,
  Rocket,
  Gauge,
  Zap,
  BookOpen,
  DollarSign,
  Menu,
  X,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: any;
  path: string;
  badge?: string;
  badgeColor?: string;
}

interface NavSection {
  id: string;
  label: string;
  icon: any;
  items: NavItem[];
}

const navigationSections: NavSection[] = [
  {
    id: 'gamma',
    label: 'Gamma Analysis',
    icon: Activity,
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/' },
      { id: 'gamma-profile', label: 'Gamma Profile', icon: TrendingUp, path: '/gamma-profile' },
      { id: 'wall-zones', label: 'Wall Zones', icon: Shield, path: '/wall-zones' },
      { id: 'max-pain', label: 'Max Pain', icon: Target, path: '/max-pain' }
    ]
  },
  {
    id: 'volatility',
    label: 'Volatility',
    icon: Waves,
    items: [
      { id: 'vol-surface', label: 'Vol Surface (3D)', icon: LineChart, path: '/volatility-surface' },
      { id: 'vol-skew', label: 'Vol Skew', icon: TrendingUp, path: '/volatility-skew' },
      { id: 'anomalies', label: 'Anomalies', icon: AlertTriangle, path: '/anomalies' }
    ]
  },
  {
    id: 'trading',
    label: 'Trading Signals',
    icon: Zap,
    items: [
      { id: 'strategy-center', label: 'Strategy Center', icon: Swords, path: '/strategy-center', badge: 'NEW', badgeColor: 'bg-cyan-500' },
      { id: 'escape-detector', label: 'Half Pipe / Escape', icon: Rocket, path: '/half-pipe' },
      { id: 'microstructure', label: 'Market Microstructure', icon: Gauge, path: '/microstructure', badge: 'HOT', badgeColor: 'bg-orange-500' }
    ]
  },
  {
    id: 'realtime',
    label: 'Real-Time Data',
    icon: Zap,
    items: [
      { id: 'liquidations', label: 'Liquidations', icon: DollarSign, path: '/liquidations' },
      { id: 'orderbook', label: 'Orderbook', icon: BookOpen, path: '/orderbook' },
      { id: 'sentiment', label: 'Market Sentiment', icon: Activity, path: '/sentiment' }
    ]
  }
];

export default function Sidebar() {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(['gamma', 'volatility', 'trading']);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => 
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const isActive = (path: string) => {
    return location === path;
  };

  const isSectionActive = (section: NavSection) => {
    return section.items.some(item => isActive(item.path));
  };

  return (
    <>
      {/* Sidebar */}
      <div className={`
        fixed left-0 top-0 h-screen bg-slate-900 border-r border-slate-800 
        transition-all duration-300 z-40
        ${collapsed ? 'w-20' : 'w-72'}
      `}>
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-linear-to-br from-cyan-500 to-purple-500 rounded-lg flex items-center justify-center">
                <img
                    src="/assets/favicon180x180.png"
                    alt="Logo"
                    className="w-15 h-15"
                />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-100">Gamma Tracker</h1>
                <p className="text-xs text-slate-400">Options Analytics</p>
              </div>
            </div>
          )}
          
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            {collapsed ? (
              <Menu className="w-5 h-5 text-slate-400" />
            ) : (
              <X className="w-5 h-5 text-slate-400" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <div className="overflow-y-auto h-[calc(100vh-4rem)] py-4">
          {navigationSections.map((section) => {
            const SectionIcon = section.icon;
            const isExpanded = expandedSections.includes(section.id);
            const isSectionHighlighted = isSectionActive(section);

            return (
              <div key={section.id} className="mb-2">
                {/* Section Header */}
                {!collapsed && (
                  <button
                    onClick={() => toggleSection(section.id)}
                    className={`
                      w-full flex items-center justify-between px-4 py-2 
                      hover:bg-slate-800/50 transition-colors
                      ${isSectionHighlighted ? 'bg-slate-800/30' : ''}
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <SectionIcon className={`w-4 h-4 ${isSectionHighlighted ? 'text-cyan-400' : 'text-slate-400'}`} />
                      <span className={`text-xs font-semibold uppercase tracking-wider ${
                        isSectionHighlighted ? 'text-cyan-400' : 'text-slate-400'
                      }`}>
                        {section.label}
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                )}

                {/* Section Items */}
                {(isExpanded || collapsed) && (
                  <div className={collapsed ? 'space-y-1' : 'mt-1 space-y-1'}>
                    {section.items.map((item) => {
                      const ItemIcon = item.icon;
                      const active = isActive(item.path);

                      return (
                        <Link
                          key={item.id}
                          href={item.path}
                          className={`
                            flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg
                            transition-all group relative
                            ${active 
                              ? 'bg-linear-to-r from-cyan-500/20 to-purple-500/20 text-cyan-400 border border-cyan-500/30' 
                              : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                            }
                            ${collapsed ? 'justify-center' : ''}
                          `}
                        >
                          <a className="flex items-center gap-3 w-full">
                            <ItemIcon className={`w-5 h-5 ${active ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
                            
                            {!collapsed && (
                              <>
                                <span className="text-sm font-medium flex-1">
                                  {item.label}
                                </span>
                                
                                {item.badge && (
                                  <span className={`
                                    px-2 py-0.5 rounded text-xs font-bold text-white
                                    ${item.badgeColor || 'bg-slate-600'}
                                  `}>
                                    {item.badge}
                                  </span>
                                )}
                              </>
                            )}

                            {/* Active Indicator */}
                            {active && (
                              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-cyan-500 rounded-r" />
                            )}

                            {/* Tooltip for collapsed state */}
                            {collapsed && (
                              <div className="
                                absolute left-full ml-2 px-3 py-2 bg-slate-800 rounded-lg
                                opacity-0 group-hover:opacity-100 pointer-events-none
                                transition-opacity whitespace-nowrap border border-slate-700
                                shadow-xl z-50
                              ">
                                <p className="text-sm text-slate-200">{item.label}</p>
                                {item.badge && (
                                  <span className={`
                                    inline-block mt-1 px-2 py-0.5 rounded text-xs font-bold text-white
                                    ${item.badgeColor || 'bg-slate-600'}
                                  `}>
                                    {item.badge}
                                  </span>
                                )}
                              </div>
                            )}
                          </a>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800 bg-slate-900">
          {!collapsed ? (
            <div className="text-xs text-slate-500 text-center">
              <p>Gamma Tracker v1.0</p>
              <p className="mt-1">Real-time Options Analytics</p>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            </div>
          )}
        </div>
      </div>

      {/* Spacer for content */}
      <div className={`${collapsed ? 'w-20' : 'w-72'} shrink-0 transition-all duration-300`} />
    </>
  );
}