'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatRelativeTime } from '@/lib/utils';
import { formatCost } from '@/lib/cost-calculator';

interface ActivityDetail {
  id: string;
  agentId: string;
  activityType: string;
  description: string;
  inputPrompt?: string;
  output?: string;
  contentParts?: {
    request?: any;
    response?: any;
    headers?: any;
    metadata?: any;
  };
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheHits: number;
  toolName?: string;
  toolInput?: any;
  toolOutput?: any;
  apiEndpoint?: string;
  apiMethod?: string;
  apiStatusCode?: number;
  duration: number;
  timestamp: string;
  ticketId?: string;
  parentActivityId?: string;
  traceId?: string;
  sessionId?: string;
  requestId?: string;
  modelName?: string;
  costInput?: number;
  costOutput?: number;
  costTotal?: number;
  metadata?: any;
  ticket?: {
    id: string;
    title: string;
    status: string;
    priority: string;
  };
  parent?: ActivityDetail;
  children?: ActivityDetail[];
}

interface ActivityDetailModalProps {
  activityId: string;
  onClose: () => void;
}

export function ActivityDetailModal({ activityId, onClose }: ActivityDetailModalProps) {
  const [activity, setActivity] = useState<ActivityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'request' | 'response' | 'chain' | 'json'>('overview');
  const [linkedActivities, setLinkedActivities] = useState<ActivityDetail[]>([]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  useEffect(() => {
    fetchActivityDetails();
  }, [activityId]);

  const fetchActivityDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/activities/${activityId}?detailed=true&includeChain=true`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch activity details');
      }
      
      const data = await response.json();
      setActivity(data);
      
      // Fetch linked activities if we have a traceId or ticketId
      if (data.traceId || data.ticketId) {
        const linkedResponse = await fetch(
          `/api/activities?${data.traceId ? `traceId=${data.traceId}` : `ticketId=${data.ticketId}`}&limit=50`
        );
        if (linkedResponse.ok) {
          const linkedData = await linkedResponse.json();
          setLinkedActivities(linkedData.activities.filter((a: any) => a.id !== activityId));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'create_ticket':
        return '🎫';
      case 'update_ticket':
      case 'assign_ticket':
        return '🔄';
      case 'close_ticket':
        return '✅';
      case 'agent_turn':
      case 'reasoning':
        return '🧠';
      case 'tool_call':
        return '🛠️';
      case 'completion':
        return '✨';
      case 'error':
        return '❌';
      case 'api_call':
        return '🔌';
      case 'status_change':
        return '📊';
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
        return 'bg-red-500';
      case 'api_call':
        return 'bg-cyan-500';
      case 'status_change':
        return 'bg-purple-500';
      default:
        return 'bg-slate-500';
    }
  };

  const getStatusCodeColor = (code: number) => {
    if (code >= 200 && code < 300) return 'text-emerald-400';
    if (code >= 300 && code < 400) return 'text-amber-400';
    if (code >= 400 && code < 500) return 'text-orange-400';
    return 'text-red-400';
  };

  const formatJson = (obj: any) => JSON.stringify(obj, null, 2);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Handle backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  if (loading) {
    return (
      <div 
        className="fixed inset-0 z-50 bg-black/70 p-4 flex items-center justify-center"
        onClick={handleBackdropClick}
      >
        <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-4xl w-full max-h-[80vh] p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !activity) {
    return (
      <div 
        className="fixed inset-0 z-50 bg-black/70 p-4 flex items-center justify-center"
        onClick={handleBackdropClick}
      >
        <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-4xl w-full max-h-[80vh]">
          <div className="p-6 text-center">
            <p className="text-red-400">{error || 'Activity not found'}</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totalCost = activity.costTotal || (activity.costInput || 0) + (activity.costOutput || 0);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 p-4 flex items-center justify-center"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-lg max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{getActivityIcon(activity.activityType)}</span>
            <div>
              <h3 className="text-lg font-semibold text-white">Activity Details</h3>
              <p className="text-xs text-slate-500">ID: {activity.id}</p>
            </div>
          </div>
          <button
            className="text-slate-400 hover:text-white text-2xl px-2 transition-colors"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-900/30">
          {(['overview', 'request', 'response', 'chain', 'json'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-800/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">Type</p>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${getActivityColor(activity.activityType)}`} />
                    <p className="text-sm text-white font-medium">{activity.activityType}</p>
                  </div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">Agent ID</p>
                  <p className="text-sm text-white font-mono truncate">{activity.agentId}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">Timestamp</p>
                  <p className="text-sm text-white">{new Date(activity.timestamp).toLocaleString()}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">Relative Time</p>
                  <p className="text-sm text-white">{formatRelativeTime(activity.timestamp)}</p>
                </div>
              </div>

              {/* Description */}
              <div className="bg-slate-800/50 rounded-lg p-4">
                <p className="text-xs text-slate-500 mb-2">Description</p>
                <p className="text-sm text-slate-200">{activity.description}</p>
              </div>

              {/* API Details */}
              {(activity.apiEndpoint || activity.apiMethod) && (
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <p className="text-xs text-slate-500 mb-2">API Call</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    {activity.apiMethod && (
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-mono">
                        {activity.apiMethod}
                      </span>
                    )}
                    {activity.apiEndpoint && (
                      <span className="text-sm text-white font-mono">{activity.apiEndpoint}</span>
                    )}
                    {activity.apiStatusCode && (
                      <span className={`text-sm font-bold ${getStatusCodeColor(activity.apiStatusCode)}`}>
                        {activity.apiStatusCode}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Tool Details */}
              {activity.toolName && (
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <p className="text-xs text-slate-500 mb-2">Tool</p>
                  <p className="text-sm text-blue-400 font-mono">{activity.toolName}</p>
                </div>
              )}

              {/* Token Usage Card */}
              <div className="bg-slate-800/50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-white mb-4">Token Usage</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-xs text-slate-500 mb-1">Input Tokens</p>
                    <p className="text-2xl font-bold text-emerald-400">{activity.inputTokens.toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-500 mb-1">Output Tokens</p>
                    <p className="text-2xl font-bold text-blue-400">{activity.outputTokens.toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-500 mb-1">Total Tokens</p>
                    <p className="text-2xl font-bold text-white">{activity.totalTokens.toLocaleString()}</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className="text-xs text-slate-500 mb-1">Cache Hits</p>
                    <p className="text-lg font-semibold text-purple-400">{activity.cacheHits.toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-500 mb-1">Duration</p>
                    <p className="text-lg font-semibold text-amber-400">{(activity.duration / 1000).toFixed(2)}s</p>
                  </div>
                </div>
              </div>

              {/* Cost Tracking */}
              {(activity.costInput !== undefined || activity.costOutput !== undefined || totalCost > 0) && (
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-white mb-4">Cost</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-xs text-slate-500 mb-1">Input Cost</p>
                      <p className="text-lg font-semibold text-emerald-400">
                        {formatCost(activity.costInput || 0)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-500 mb-1">Output Cost</p>
                      <p className="text-lg font-semibold text-blue-400">
                        {formatCost(activity.costOutput || 0)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-500 mb-1">Total Cost</p>
                      <p className="text-lg font-semibold text-white">
                        {formatCost(totalCost)}
                      </p>
                    </div>
                  </div>
                  {activity.modelName && (
                    <p className="text-xs text-slate-500 mt-3 text-center">
                      Model: <span className="text-slate-300">{activity.modelName}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Ticket Link */}
              {activity.ticket && (
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <p className="text-xs text-slate-500 mb-2">Associated Ticket</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white font-medium">{activity.ticket.title}</p>
                      <p className="text-xs text-slate-500">ID: {activity.ticket.id}</p>
                    </div>
                    <div className="flex gap-2">
                      <span className="px-2 py-1 bg-slate-700 rounded text-xs">{activity.ticket.status}</span>
                      <span className="px-2 py-1 bg-slate-700 rounded text-xs">{activity.ticket.priority}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Trace Info */}
              {(activity.traceId || activity.sessionId || activity.requestId) && (
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <p className="text-xs text-slate-500 mb-2">Trace Information</p>
                  <div className="space-y-1 text-xs">
                    {activity.traceId && (
                      <div className="flex">
                        <span className="text-slate-500 w-24">Trace ID:</span>
                        <span className="text-slate-300 font-mono">{activity.traceId}</span>
                      </div>
                    )}
                    {activity.sessionId && (
                      <div className="flex">
                        <span className="text-slate-500 w-24">Session ID:</span>
                        <span className="text-slate-300 font-mono">{activity.sessionId}</span>
                      </div>
                    )}
                    {activity.requestId && (
                      <div className="flex">
                        <span className="text-slate-500 w-24">Request ID:</span>
                        <span className="text-slate-300 font-mono">{activity.requestId}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'request' && (
            <div className="space-y-4">
              {activity.inputPrompt ? (
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-slate-500">Input Prompt</p>
                    <button
                      onClick={() => copyToClipboard(activity.inputPrompt || '')}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      Copy
                    </button>
                  </div>
                  <pre className="text-xs text-slate-300 overflow-auto max-h-96 bg-slate-900/50 p-3 rounded">
                    {activity.inputPrompt}
                  </pre>
                </div>
              ) : (
                <p className="text-slate-500 text-center py-8">No input prompt available</p>
              )}

              {activity.toolInput && (
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <p className="text-xs text-slate-500 mb-2">Tool Input</p>
                  <pre className="text-xs text-slate-300 overflow-auto max-h-96 bg-slate-900/50 p-3 rounded">
                    {formatJson(activity.toolInput)}
                  </pre>
                </div>
              )}

              {activity.contentParts?.request && (
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <p className="text-xs text-slate-500 mb-2">Request Details</p>
                  <pre className="text-xs text-slate-300 overflow-auto max-h-96 bg-slate-900/50 p-3 rounded">
                    {formatJson(activity.contentParts.request)}
                  </pre>
                </div>
              )}

              {activity.contentParts?.headers && (
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <p className="text-xs text-slate-500 mb-2">Headers</p>
                  <pre className="text-xs text-slate-300 overflow-auto max-h-48 bg-slate-900/50 p-3 rounded">
                    {formatJson(activity.contentParts.headers)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {activeTab === 'response' && (
            <div className="space-y-4">
              {activity.output ? (
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-slate-500">Output / Response</p>
                    <button
                      onClick={() => copyToClipboard(activity.output || '')}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      Copy
                    </button>
                  </div>
                  <pre className="text-xs text-slate-300 overflow-auto max-h-96 bg-slate-900/50 p-3 rounded">
                    {activity.output}
                  </pre>
                </div>
              ) : (
                <p className="text-slate-500 text-center py-8">No output available</p>
              )}

              {activity.toolOutput && (
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <p className="text-xs text-slate-500 mb-2">Tool Output</p>
                  <pre className="text-xs text-slate-300 overflow-auto max-h-96 bg-slate-900/50 p-3 rounded">
                    {typeof activity.toolOutput === 'string' 
                      ? activity.toolOutput 
                      : formatJson(activity.toolOutput)}
                  </pre>
                </div>
              )}

              {activity.contentParts?.response && (
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <p className="text-xs text-slate-500 mb-2">Response Details</p>
                  <pre className="text-xs text-slate-300 overflow-auto max-h-96 bg-slate-900/50 p-3 rounded">
                    {formatJson(activity.contentParts.response)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {activeTab === 'chain' && (
            <div className="space-y-4">
              {/* Parent Activity */}
              {activity.parentActivityId && (
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <p className="text-xs text-slate-500 mb-2">Parent Activity</p>
                  <div className="flex items-center gap-2 text-sm">
                    <span>{getActivityIcon(activity.parent?.activityType || '')}</span>
                    <span className="text-slate-300">{activity.parent?.description || activity.parentActivityId}</span>
                  </div>
                </div>
              )}

              {/* Current Activity */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <p className="text-xs text-blue-400 mb-2">Current Activity</p>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getActivityIcon(activity.activityType)}</span>
                  <span className="text-white font-medium">{activity.description}</span>
                </div>
              </div>

              {/* Linked Activities */}
              {linkedActivities.length > 0 && (
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <p className="text-xs text-slate-500 mb-3">Related Activities ({linkedActivities.length})</p>
                  <div className="space-y-2 max-h-64 overflow-auto">
                    {linkedActivities.map((linked) => (
                      <div
                        key={linked.id}
                        className="flex items-center gap-3 p-2 bg-slate-900/50 rounded hover:bg-slate-900 cursor-pointer"
                        onClick={() => window.location.href = `?activity=${linked.id}`}
                      >
                        <span>{getActivityIcon(linked.activityType)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-300 truncate">{linked.description}</p>
                          <p className="text-xs text-slate-500">{formatRelativeTime(linked.timestamp)}</p>
                        </div>
                        <span className={`h-2 w-2 rounded-full ${getActivityColor(linked.activityType)}`} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ticket Timeline */}
              {activity.ticket && linkedActivities.length > 0 && (
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <p className="text-xs text-slate-500 mb-3">Ticket Timeline</p>
                  <div className="relative pl-4 border-l-2 border-slate-700 space-y-4">
                    {[...linkedActivities, activity]
                      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                      .map((item, index) => (
                        <div key={item.id} className="relative">
                          <span className={`absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-slate-900 ${
                            item.id === activity.id ? 'bg-blue-500' : 'bg-slate-600'
                          }`} />
                          <div className={`text-sm ${item.id === activity.id ? 'text-white' : 'text-slate-400'}`}>
                            {item.description}
                          </div>
                          <div className="text-xs text-slate-500">
                            {formatRelativeTime(item.timestamp)}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'json' && (
            <div className="bg-slate-800/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-500">Raw Activity Data</p>
                <button
                  onClick={() => copyToClipboard(formatJson(activity))}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Copy JSON
                </button>
              </div>
              <pre className="text-xs text-slate-300 overflow-auto max-h-[60vh] bg-slate-900/50 p-3 rounded">
                {formatJson(activity)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}