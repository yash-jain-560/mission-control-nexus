'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatRelativeTime } from '@/lib/utils';
import { ActivityDetailModal } from './ActivityDetailModal';
import { formatCost } from '@/lib/cost-calculator';

interface ActivityItem {
  id: string;
  agentId?: string;
  type: string;
  activityType?: string;
  message?: string;
  description?: string;
  timestamp: string;
  tokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheHits?: number;
  toolName?: string;
  duration?: number;
  costTotal?: number;
  apiEndpoint?: string;
  apiMethod?: string;
  apiStatusCode?: number;
  inputPrompt?: string;
  output?: string;
  metadata?: any;
}

interface ActivityFeedProps {
  items?: ActivityItem[];
  refreshInterval?: number;
  showFilters?: boolean;
  maxItems?: number;
  ticketId?: string; // Filter by ticket
}

// Truncate text to a certain length
function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

export function ActivityFeed({ 
  items: initialItems, 
  refreshInterval = 5000,
  showFilters = true,
  maxItems = 50,
  ticketId,
}: ActivityFeedProps) {
  const [items, setItems] = useState<ActivityItem[]>(initialItems || []);
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<string>('all');
  const [isLive, setIsLive] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch activities from API
  const fetchActivities = useCallback(async () => {
    if (!isLive && initialItems) return;
    
    try {
      setIsLoading(true);
      const params = new URLSearchParams({ limit: String(maxItems) });
      if (filter !== 'all') {
        params.set('type', filter);
      }
      if (ticketId) {
        params.set('ticketId', ticketId);
      }
      
      const response = await fetch(`/api/activities?${params}`);
      if (!response.ok) throw new Error('Failed to fetch activities');
      
      const data = await response.json();
      setItems(data.activities || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setIsLoading(false);
    }
  }, [filter, isLive, maxItems, initialItems, ticketId]);

  // Auto-refresh when live
  useEffect(() => {
    if (!isLive) return;
    
    fetchActivities();
    const interval = setInterval(fetchActivities, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchActivities, isLive, refreshInterval]);

  // Use initial items if provided
  useEffect(() => {
    if (initialItems) {
      setItems(initialItems);
    }
  }, [initialItems]);

  // Toggle expanded state for an activity
  const toggleExpanded = (activityId: string) => {
    setExpandedActivities(prev => {
      const newSet = new Set(prev);
      if (newSet.has(activityId)) {
        newSet.delete(activityId);
      } else {
        newSet.add(activityId);
      }
      return newSet;
    });
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'create_ticket':
        return '🎫';
      case 'update_ticket':
      case 'assign_ticket':
        return '🔄';
      case 'close_ticket':
      case 'delete_ticket':
        return '✅';
      case 'agent_turn':
      case 'reasoning':
        return '🧠';
      case 'tool_call':
        return '🛠️';
      case 'completion':
        return '✨';
      case 'error':
      case 'agent_error':
        return '❌';
      case 'api_call':
        return '🔌';
      case 'status_change':
        return '📊';
      case 'heartbeat':
        return '💓';
      case 'system_event':
        return '⚙️';
      default:
        return '📝';
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'create_ticket':
      case 'close_ticket':
        return 'bg-emerald-500';
      case 'agent_turn':
      case 'reasoning':
        return 'bg-amber-500';
      case 'tool_call':
        return 'bg-blue-500';
      case 'completion':
        return 'bg-purple-500';
      case 'error':
      case 'agent_error':
        return 'bg-red-500';
      case 'api_call':
        return 'bg-cyan-500';
      case 'status_change':
        return 'bg-purple-500';
      default:
        return 'bg-slate-500';
    }
  };

  const getActivityBgColor = (type: string) => {
    switch (type) {
      case 'error':
      case 'agent_error':
        return 'bg-red-500/10 border-red-500/30';
      case 'api_call':
        return 'bg-cyan-500/10 border-cyan-500/30';
      case 'tool_call':
        return 'bg-blue-500/10 border-blue-500/30';
      default:
        return 'bg-slate-900/50 border-slate-800';
    }
  };

  // Calculate token efficiency
  const getTokenDisplay = (item: ActivityItem) => {
    if (!item.inputTokens && !item.outputTokens) {
      return item.tokens ? { total: item.tokens, input: 0, output: 0 } : null;
    }
    const input = item.inputTokens || 0;
    const output = item.outputTokens || 0;
    const total = input + output;
    return { input, output, total };
  };

  // Get content to display with "read more" functionality
  const getDisplayContent = (item: ActivityItem, isExpanded: boolean) => {
    const content = item.message || item.description || '';
    const maxLength = 150;
    
    if (isExpanded || content.length <= maxLength) {
      return {
        text: content,
        needsExpansion: content.length > maxLength,
      };
    }
    
    return {
      text: truncateText(content, maxLength),
      needsExpansion: true,
    };
  };

  const filteredItems = filter === 'all' 
    ? items 
    : items.filter(item => item.type === filter || item.activityType === filter);

  // Get unique activity types for filter
  const activityTypes = ['all', ...new Set(items.map(item => item.type || item.activityType || 'unknown'))];

  return (
    <>
      <aside className="bg-slate-900 border border-slate-800 rounded-lg p-4 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold tracking-wide text-slate-200">
              {ticketId ? 'Ticket Activities' : 'Live Activity'}
            </h3>
            {isLive && !ticketId && (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">{filteredItems.length} events</span>
            {!ticketId && (
              <button
                onClick={() => setIsLive(!isLive)}
                className={`text-xs px-2 py-1 rounded ${
                  isLive 
                    ? 'bg-emerald-500/20 text-emerald-400' 
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
                {isLive ? 'Live' : 'Paused'}
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mb-3">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Activities</option>
              {activityTypes.filter(t => t !== 'all').map(type => (
                <option key={type} value={type}>
                  {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Loading state */}
        {isLoading && items.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="text-center py-4">
            <p className="text-xs text-red-400">{error}</p>
            <button
              onClick={fetchActivities}
              className="text-xs text-blue-400 hover:text-blue-300 mt-2"
            >
              Retry
            </button>
          </div>
        )}

        {/* Activity List */}
        <div className="flex-1 overflow-auto space-y-2 pr-1 min-h-0">
          {filteredItems.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-slate-400">No activity yet.</p>
              {filter !== 'all' && (
                <button
                  onClick={() => setFilter('all')}
                  className="text-xs text-blue-400 hover:text-blue-300 mt-2"
                >
                  Clear filter
                </button>
              )}
            </div>
          ) : (
            filteredItems.map((item) => {
              const tokenInfo = getTokenDisplay(item);
              const hasError = item.type === 'error' || item.type === 'agent_error' || (item.apiStatusCode !== undefined && item.apiStatusCode >= 400);
              const isExpanded = expandedActivities.has(item.id);
              const { text: displayText, needsExpansion } = getDisplayContent(item, isExpanded);
              
              return (
                <div
                  key={item.id}
                  className={`w-full text-left rounded-lg border p-3 hover:border-blue-500/50 transition-colors ${
                    getActivityBgColor(item.type || item.activityType || '')
                  }`}
                >
                  {/* Header row */}
                  <button
                    onClick={() => setSelectedActivity(item.id)}
                    className="w-full flex items-center gap-2 mb-1"
                  >
                    <span className="text-sm">{getActivityIcon(item.type || item.activityType || '')}</span>
                    <span
                      className={`h-2 w-2 rounded-full ${getActivityColor(item.type || item.activityType || '')}`}
                    />
                    <span className="text-xs uppercase text-slate-400 flex-1 truncate">
                      {item.type || item.activityType}
                    </span>
                    <span className="text-xs text-slate-500">
                      {formatRelativeTime(item.timestamp)}
                    </span>
                  </button>

                  {/* Description with Read More */}
                  <div className={`text-sm ${hasError ? 'text-red-300' : 'text-slate-200'}`}>
                    <p className={isExpanded ? '' : 'line-clamp-3'}>
                      {displayText}
                    </p>
                    {needsExpansion && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpanded(item.id);
                        }}
                        className="text-xs text-blue-400 hover:text-blue-300 mt-1 font-medium"
                      >
                        {isExpanded ? '← Show less' : 'Read more →'}
                      </button>
                    )}
                  </div>

                  {/* API endpoint if available */}
                  {item.apiEndpoint && (
                    <div className="flex items-center gap-2 mt-1">
                      {item.apiMethod && (
                        <span className="text-[10px] px-1 bg-slate-700 rounded text-slate-400">
                          {item.apiMethod}
                        </span>
                      )}
                      <span className="text-xs text-slate-500 truncate">{item.apiEndpoint}</span>
                      {item.apiStatusCode && (
                        <span className={`text-xs ${
                          item.apiStatusCode >= 400 ? 'text-red-400' : 'text-emerald-400'
                        }`}>
                          {item.apiStatusCode}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Token info */}
                  {tokenInfo && (
                    <div className="flex items-center gap-3 mt-2 text-xs">
                      <span className="text-slate-500">
                        <span className="text-emerald-400">↑{tokenInfo.input.toLocaleString()}</span>
                        {' '}
                        <span className="text-blue-400">↓{tokenInfo.output.toLocaleString()}</span>
                      </span>
                      <span className="text-slate-600">|</span>
                      <span className="text-slate-400">{tokenInfo.total.toLocaleString()} total</span>
                      {(item.cacheHits ?? 0) > 0 && (
                        <>
                          <span className="text-slate-600">|</span>
                          <span className="text-purple-400">{item.cacheHits} cached</span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Cost */}
                  {(item.costTotal ?? 0) > 0 && (
                    <div className="text-xs text-amber-400 mt-1">
                      Cost: {formatCost(item.costTotal || 0)}
                    </div>
                  )}

                  {/* Tool name */}
                  {item.toolName && (
                    <p className="text-xs text-blue-400 mt-1">Tool: {item.toolName}</p>
                  )}

                  {/* Duration */}
                  {item.duration && item.duration > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      Duration: {(item.duration / 1000).toFixed(2)}s
                    </p>
                  )}

                  {/* Input/Output Preview (when expanded) */}
                  {isExpanded && (item.inputPrompt || item.output) && (
                    <div className="mt-3 pt-3 border-t border-slate-700 space-y-2">
                      {item.inputPrompt && (
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Input:</p>
                          <p className="text-xs text-slate-400 line-clamp-4 font-mono bg-slate-800/50 p-2 rounded">
                            {item.inputPrompt}
                          </p>
                        </div>
                      )}
                      {item.output && (
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Output:</p>
                          <p className="text-xs text-slate-400 line-clamp-4 font-mono bg-slate-800/50 p-2 rounded">
                            {item.output}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-slate-800 flex justify-between items-center">
          <button
            onClick={fetchActivities}
            disabled={isLoading}
            className="text-xs text-slate-500 hover:text-slate-300 disabled:opacity-50"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
          <a
            href="/activities"
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            View All →
          </a>
        </div>
      </aside>

      {/* Activity Detail Modal */}
      {selectedActivity && (
        <ActivityDetailModal
          activityId={selectedActivity}
          onClose={() => setSelectedActivity(null)}
        />
      )}
    </>
  );
}