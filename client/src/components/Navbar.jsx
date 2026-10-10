import React from 'react';
import { 
  Plus, 
  Link2, 
  Database, 
  GitFork, 
  RotateCcw, 
  Columns3, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';

export default function Navbar({
  neo4jStatus,
  onOpenCreateModal,
  onOpenConnectModal,
  onOpenConfigModal,
  onSeedData,
  activeView,
  setActiveView,
  issueCount,
  connectionCount
}) {
  return (
    <header className="navbar" id="top-navbar">
      <div className="nav-brand-group">
        <div className="logo-badge" id="app-logo">
          <GitFork size={22} />
        </div>
        <div className="brand-text-col">
          <div className="brand-title">
            Jira Graph Kanban
            <span className="neo-pill">Neo4j Desktop</span>
          </div>
          <span className="brand-subtitle">
            {issueCount} nodes &bull; {connectionCount} graph relations
          </span>
        </div>
      </div>

      <div className="nav-actions">
        {/* Connection status badge */}
        <button
          className={`connection-badge ${neo4jStatus?.connected ? 'connected' : 'disconnected'}`}
          onClick={onOpenConfigModal}
          title="Click to view or edit Neo4j connection parameters"
          id="btn-neo4j-status"
        >
          <span className={`status-dot ${neo4jStatus?.connected ? 'connected' : 'disconnected'}`} />
          {neo4jStatus?.connected ? (
            <span>Neo4j Live</span>
          ) : (
            <span>Neo4j Offline (Local Sync)</span>
          )}
        </button>

        {/* View Switcher */}
        <div style={{ display: 'flex', gap: '4px', background: '#eef2f8', padding: '3px', borderRadius: '8px' }}>
          <button
            className={activeView === 'kanban' ? 'btn-dark-blue' : 'btn-secondary'}
            style={{ padding: '6px 11px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}
            onClick={() => setActiveView('kanban')}
            id="view-toggle-kanban"
          >
            <Columns3 size={14} />
            Kanban
          </button>
          <button
            className={activeView === 'graph' ? 'btn-dark-blue' : 'btn-secondary'}
            style={{ padding: '6px 11px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}
            onClick={() => setActiveView('graph')}
            id="view-toggle-graph"
          >
            <GitFork size={14} />
            Neo4j Graph
          </button>
          <button
            className={activeView === 'agents' ? 'btn-dark-blue' : 'btn-secondary'}
            style={{ padding: '6px 11px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}
            onClick={() => setActiveView('agents')}
            id="view-toggle-agents"
          >
            <CheckCircle2 size={14} />
            Autonomous Agents
          </button>
          <button
            className={activeView === 'repo' ? 'btn-dark-blue' : 'btn-secondary'}
            style={{ padding: '6px 11px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}
            onClick={() => setActiveView('repo')}
            id="view-toggle-repo"
          >
            <GitFork size={14} />
            Repo & Diff
          </button>
          <button
            className={activeView === 'kb' ? 'btn-dark-blue' : 'btn-secondary'}
            style={{ padding: '6px 11px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}
            onClick={() => setActiveView('kb')}
            id="view-toggle-kb"
          >
            <Database size={14} />
            Knowledge Base
          </button>
        </div>

        {/* Dark Blue Action Buttons */}
        <button
          className="btn-dark-blue"
          onClick={onOpenConnectModal}
          id="btn-connect-nodes"
          title="Create a relationship between two nodes in Neo4j"
        >
          <Link2 size={16} />
          Connect Nodes
        </button>

        <button
          className="btn-dark-blue"
          onClick={onOpenCreateModal}
          id="btn-create-issue"
        >
          <Plus size={16} />
          Create Issue
        </button>

        {/* Database & Seed utility */}
        <button
          className="btn-icon-subtle"
          onClick={onOpenConfigModal}
          title="Neo4j Desktop Connection Settings"
          id="btn-settings"
        >
          <Database size={18} />
        </button>

        <button
          className="btn-icon-subtle"
          onClick={onSeedData}
          title="Seed Jira Demo Data"
          id="btn-seed"
        >
          <RotateCcw size={18} />
        </button>
      </div>
    </header>
  );
}
