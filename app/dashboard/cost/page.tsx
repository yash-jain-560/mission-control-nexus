'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { formatCost, MODEL_PRICING } from '@/lib/cost-calculator';
import { formatTokenCount } from '@/lib/token-aggregator';

interface CostData {
  period: string;
  periodStart: string;
  periodEnd: string;
  summary: {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    totalCost: number;
    formattedCost: string;
    totalActivities: number;
    averageCostPerActivity: number;
    averageTokensPerActivity: number;
  };
  budget: {
    dailyBudget: number;
    periodBudget: number;
    spent: number;
    remaining: number;
    utilization: number;
  };
  breakdowns: {
    byModel: Array<{
      model: string;
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      cost: number;
      activities: number;
      pricing: { inputPer1K: number; outputPer1K: number };
    }>;
    byAgent: Array<{
      agentId: string;
      agentName: string;
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      cost: number;
      activities: number;
    }>;
    byTicket: Array<{
      ticketId: string;
      ticketTitle: string;
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      cost: number;
      activities: number;
    }>;
    byDay: Array<{
      date: string;
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      cost: number;
      activities: number;
    }>;
  };
  modelPricing: Record<string, { input: number; output: number }>;
  allTime: {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    totalCost: number;
    formattedCost: string;
  } | null;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function CostDashboardPage() {
  const [data, setData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'1d' | '7d' | '30d' | 'all'>('7d');
  const [activeTab, setActiveTab] = useState<'overview' | 'models' | 'agents' | 'tickets'>('overview');

  useEffect(() => {
    loadData();
  }, [period]);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/dashboard/cost?period=${period}&detailed=true`);
      if (!response.ok) throw new Error('Failed to fetch cost data');
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="p-4 md:p-6 bg-slate-950 min-h-screen">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="p-4 md:p-6 bg-slate-950 min-h-screen">
        <div className="text-center py-12">
          <p className="text-red-400">{error || 'Failed to load cost data'}</p>
          <button 
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  const budgetPercentage = Math.min(100, data.budget.utilization);
  const budgetColor = budgetPercentage > 90 ? 'text-red-400' : budgetPercentage > 70 ? 'text-amber-400' : 'text-emerald-400';

  return (
    <main className="p-4 md:p-6 bg-slate-950 min-h-screen">
      {/* Header */}
      <header className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Cost Dashboard</h1>
            <p className="text-slate-400 mt-1">
              Token usage and cost analysis for {period === '1d' ? 'last 24 hours' : period === '7d' ? 'last 7 days' : period === '30d' ? 'last 30 days' : 'all time'}
            </p>
          </div>
          
          {/* Period selector */}
          <div className="flex gap-2">
            {(['1d', '7d', '30d', 'all'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  period === p
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {p === '1d' ? '24h' : p === '7d' ? '7d' : p === '30d' ? '30d' : 'All'}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-sm text-slate-400">Total Cost</p>
          <p className="text-2xl font-bold text-white">{data.summary.formattedCost}</p>
          <p className="text-xs text-slate-500 mt-1">
            {data.summary.totalActivities.toLocaleString()} activities
          </p>
        </div>
        
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-sm text-slate-400">Total Tokens</p>
          <p className="text-2xl font-bold text-white">{formatTokenCount(data.summary.totalTokens)}</p>
          <p className="text-xs text-slate-500 mt-1">
            ↑{formatTokenCount(data.summary.totalInputTokens)} ↓{formatTokenCount(data.summary.totalOutputTokens)}
          </p>
        </div>
        
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-sm text-slate-400">Budget Utilization</p>
          <p className={`text-2xl font-bold ${budgetColor}`}>
            {budgetPercentage.toFixed(1)}%
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {formatCost(data.budget.spent)} / {formatCost(data.budget.periodBudget)}
          </p>
        </div>
        
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-sm text-slate-400">Avg Cost/Activity</p>
          <p className="text-2xl font-bold text-white">
            {formatCost(data.summary.averageCostPerActivity)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            ~{Math.round(data.summary.averageTokensPerActivity).toLocaleString()} tokens avg
          </p>
        </div>
      </div>

      {/* Budget Progress */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-400">Budget Usage</span>
          <span className={`text-sm font-medium ${budgetColor}`}>
            {formatCost(data.budget.spent)} of {formatCost(data.budget.periodBudget)}
          </span>
        </div>
        <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 ${
              budgetPercentage > 90 ? 'bg-red-500' : budgetPercentage > 70 ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${budgetPercentage}%` }}
          />
        </div>
        <p className="text-xs text-slate-500 mt-2">
          {formatCost(data.budget.remaining)} remaining in this period
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 mb-6">
        {(['overview', 'models', 'agents', 'tickets'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Daily Trend Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-4">Daily Cost Trend</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.breakdowns.byDay}>
                  <defs>
                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis 
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    tickFormatter={(value) => `$${value.toFixed(2)}`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                    formatter={(value) => [formatCost(Number(value)), 'Cost']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="cost" 
                    stroke="#3b82f6" 
                    fillOpacity={1} 
                    fill="url(#colorCost)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Daily Tokens Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-4">Daily Token Usage</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.breakdowns.byDay}>
                  <defs>
                    <linearGradient id="colorInput" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorOutput" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    tickFormatter={(value) => formatTokenCount(Number(value))}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                    formatter={(value, name) => [formatTokenCount(Number(value)), name === 'inputTokens' ? 'Input' : 'Output']}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="inputTokens" 
                    name="Input"
                    stroke="#10b981" 
                    fillOpacity={1} 
                    fill="url(#colorInput)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="outputTokens" 
                    name="Output"
                    stroke="#3b82f6" 
                    fillOpacity={1} 
                    fill="url(#colorOutput)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Model Distribution */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-4">Cost by Model</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.breakdowns.byModel}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(props) => `${props.name}: ${formatCost(Number(props.value))}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="cost"
                      nameKey="model"
                    >
                      {data.breakdowns.byModel.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                      formatter={(value) => formatCost(Number(value))}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-4">Tokens by Model</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.breakdowns.byModel} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis 
                      type="number" 
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      tickFormatter={(value) => formatTokenCount(value)}
                    />
                    <YAxis 
                      type="category" 
                      dataKey="model" 
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      width={100}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                      formatter={(value) => formatTokenCount(Number(value))}
                    />
                    <Bar dataKey="totalTokens" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'models' && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Model</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Input Tokens</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Output Tokens</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Total Tokens</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Cost</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Activities</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {data.breakdowns.byModel.map((model) => (
                <tr key={model.model} className="hover:bg-slate-800/30">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-white font-medium">{model.model}</p>
                      <p className="text-xs text-slate-500">
                        ${model.pricing.inputPer1K}/1K in, ${model.pricing.outputPer1K}/1K out
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-400">
                    {model.inputTokens.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-blue-400">
                    {model.outputTokens.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-white">
                    {model.totalTokens.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-amber-400 font-medium">
                    {formatCost(model.cost)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-400">
                    {model.activities.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'agents' && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Agent</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Input Tokens</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Output Tokens</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Total Tokens</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Cost</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Activities</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {data.breakdowns.byAgent.map((agent) => (
                <tr key={agent.agentId} className="hover:bg-slate-800/30">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-white font-medium">{agent.agentName}</p>
                      <p className="text-xs text-slate-500 font-mono">{agent.agentId}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-400">
                    {agent.inputTokens.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-blue-400">
                    {agent.outputTokens.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-white">
                    {agent.totalTokens.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-amber-400 font-medium">
                    {formatCost(agent.cost)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-400">
                    {agent.activities.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'tickets' && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Ticket</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Input Tokens</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Output Tokens</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Total Tokens</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Cost</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Activities</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {data.breakdowns.byTicket.map((ticket) => (
                <tr key={ticket.ticketId} className="hover:bg-slate-800/30">
                  <td className="px-4 py-3">
                    <div>
                      <Link 
                        href={`/tickets?id=${ticket.ticketId}`}
                        className="text-white font-medium hover:text-blue-400 transition-colors"
                      >
                        {ticket.ticketTitle}
                      </Link>
                      <p className="text-xs text-slate-500 font-mono">{ticket.ticketId}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-400">
                    {ticket.inputTokens.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-blue-400">
                    {ticket.outputTokens.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-white">
                    {ticket.totalTokens.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-amber-400 font-medium">
                    {formatCost(ticket.cost)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-400">
                    {ticket.activities.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Model Pricing Reference */}
      <div className="mt-8 bg-slate-900 border border-slate-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Model Pricing Reference</h3>
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
          {Object.entries(data.modelPricing).map(([model, pricing]) => (
            <div key={model} className="text-xs p-2 bg-slate-800/50 rounded">
              <p className="text-white font-medium">{model}</p>
              <p className="text-slate-400">
                ${pricing.input}/1K in, ${pricing.output}/1K out
              </p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}