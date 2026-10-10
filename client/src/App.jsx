import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar.jsx';
import KanbanBoard from './components/KanbanBoard.jsx';
import GraphVisualizer from './components/GraphVisualizer.jsx';
import AgentPipelineView from './components/AgentPipelineView.jsx';
import KnowledgeBaseView from './components/KnowledgeBaseView.jsx';
import RepoDiffView from './components/RepoDiffView.jsx';
import IssueModal from './components/IssueModal.jsx';
import ConnectModal from './components/ConnectModal.jsx';
import Neo4jSettingsModal from './components/Neo4jSettingsModal.jsx';
import {
  fetchGraph,
  fetchStatus,
  fetchKnowledgeDocs,
  createIssue,
  updateIssue,
  deleteIssue,
  createConnection,
  deleteConnection,
  seedFbCloneProject
} from './services/api.js';

export default function App() {
  const [issues, setIssues] = useState([]);
  const [connections, setConnections] = useState([]);
  const [knowledgeDocs, setKnowledgeDocs] = useState([]);
  const [neo4jStatus, setNeo4jStatus] = useState(null);
  const [activeView, setActiveView] = useState('kanban'); // 'kanban' | 'kb' | 'repo' | 'graph'
  const [loading, setLoading] = useState(true);

  // Modals state
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [modalInitialTab, setModalInitialTab] = useState('details');
  const [modalInitialStatus, setModalInitialStatus] = useState('TODO');

  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [connectSourceId, setConnectSourceId] = useState(null);

  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  // Toast notifications
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  };

  const loadData = useCallback(async () => {
    try {
      const [graphRes, statusRes, docsRes] = await Promise.all([
        fetchGraph(),
        fetchStatus(),
        fetchKnowledgeDocs().catch(() => [])
      ]);
      setIssues(graphRes.nodes || []);
      setConnections(graphRes.relationships || []);
      setNeo4jStatus(statusRes);
      setKnowledgeDocs(docsRes || []);
    } catch (err) {
      console.error('Failed to load data:', err);
      addToast('Error connecting to backend API', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Auto-refresh graph, Kanban & Knowledge Base every 3s so agent progress updates live
    const interval = setInterval(async () => {
      try {
        const [graphRes, statusRes, docsRes] = await Promise.all([
          fetchGraph().catch(() => null),
          fetchStatus().catch(() => null),
          fetchKnowledgeDocs().catch(() => null)
        ]);
        if (graphRes?.nodes) setIssues(graphRes.nodes);
        if (graphRes?.relationships) setConnections(graphRes.relationships);
        if (statusRes) setNeo4jStatus(statusRes);
        if (docsRes) setKnowledgeDocs(docsRes);
      } catch (e) {}
    }, 3000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Handle Save (Create or Update Node)
  const handleSaveIssue = async (formData, id) => {
    try {
      if (id) {
        const res = await updateIssue(id, formData);
        if (res.error) throw new Error(res.error);
        addToast(`Updated node ${formData.key || id} in Neo4j`, 'success');
      } else {
        const res = await createIssue(formData);
        if (res.error) throw new Error(res.error);
        addToast(`Created node ${res.issue?.key || ''} in Neo4j`, 'success');
      }
      await loadData();
    } catch (err) {
      addToast(`Error saving node: ${err.message}`, 'error');
    }
  };

  // Handle Delete Issue Node
  const handleDeleteIssue = async (id) => {
    try {
      await deleteIssue(id);
      addToast('Issue node deleted from Neo4j graph', 'info');
      await loadData();
    } catch (err) {
      addToast(`Delete error: ${err.message}`, 'error');
    }
  };

  // Handle Drag & Drop Status Update
  const handleUpdateStatus = async (issueId, newStatus) => {
    // Optimistic UI update
    setIssues(prev =>
      prev.map(item => (item.id === issueId ? { ...item, status: newStatus } : item))
    );

    try {
      await updateIssue(issueId, { status: newStatus });
      addToast(`Updated status to ${newStatus}`, 'info');
    } catch (err) {
      addToast(`Failed to update status: ${err.message}`, 'error');
      loadData();
    }
  };

  // Handle Create Graph Connection
  const handleCreateConnection = async (sourceId, targetId, relationType) => {
    try {
      const res = await createConnection(sourceId, targetId, relationType);
      if (res.error) throw new Error(res.error);
      addToast(`Created graph edge -[:${relationType}]-> in Neo4j`, 'success');
      await loadData();
    } catch (err) {
      addToast(`Error creating connection: ${err.message}`, 'error');
    }
  };

  // Handle Delete Graph Connection
  const handleDeleteConnection = async (sourceId, targetId, relationType) => {
    try {
      await deleteConnection(sourceId, targetId, relationType);
      addToast(`Removed graph edge -[:${relationType}]->`, 'info');
      await loadData();
    } catch (err) {
      addToast(`Error removing connection: ${err.message}`, 'error');
    }
  };

  // Handle Seeding Facebook Clone Project Plan
  const handleSeedData = async () => {
    try {
      await seedFbCloneProject();
      addToast('Seeded Facebook Clone project plan, Knowledge Base & Git PRs into Neo4j!', 'success');
      await loadData();
    } catch (err) {
      addToast(`Seed error: ${err.message}`, 'error');
    }
  };

  // Modal open helpers
  const handleOpenCreateModal = (status = 'TODO') => {
    setSelectedIssue(null);
    setModalInitialStatus(status);
    setModalInitialTab('details');
    setIsIssueModalOpen(true);
  };

  const handleSelectIssue = (issue, tab = 'details') => {
    setSelectedIssue(issue);
    setModalInitialTab(tab);
    setIsIssueModalOpen(true);
  };

  const handleOpenQuickConnect = (sourceId = null) => {
    setConnectSourceId(sourceId);
    setIsConnectModalOpen(true);
  };

  // Only Jira Issues for the Kanban Board cards
  const kanbanIssues = issues.filter(i => !i.nodeLabel || i.nodeLabel === 'Issue');

  return (
    <div className="app-container" id="jira-graph-app">
      {/* Top Navbar */}
      <Navbar
        neo4jStatus={neo4jStatus}
        issueCount={kanbanIssues.length}
        connectionCount={connections.length}
        activeView={activeView}
        setActiveView={setActiveView}
        onOpenCreateModal={() => handleOpenCreateModal('TODO')}
        onOpenConnectModal={() => handleOpenQuickConnect(null)}
        onOpenConfigModal={() => setIsConfigModalOpen(true)}
        onSeedData={handleSeedData}
      />

      {/* Main Content Area */}
      {activeView === 'kanban' && (
        <KanbanBoard
          issues={kanbanIssues}
          connections={connections}
          onSelectIssue={handleSelectIssue}
          onDeleteIssue={handleDeleteIssue}
          onUpdateStatus={handleUpdateStatus}
          onOpenCreateModalWithStatus={handleOpenCreateModal}
          onOpenQuickConnect={handleOpenQuickConnect}
        />
      )}

      {activeView === 'graph' && (
        <GraphVisualizer
          issues={issues}
          connections={connections}
          onSelectIssue={handleSelectIssue}
          onOpenConnectModal={() => handleOpenQuickConnect(null)}
        />
      )}

      {activeView === 'agents' && (
        <AgentPipelineView
          issues={kanbanIssues}
          onNavigateToRepo={() => setActiveView('repo')}
          onNavigateToGraph={() => setActiveView('graph')}
          onNavigateToKB={() => setActiveView('kb')}
          onSelectIssue={handleSelectIssue}
        />
      )}

      {activeView === 'repo' && (
        <RepoDiffView
          onSelectIssue={handleSelectIssue}
        />
      )}

      {activeView === 'kb' && (
        <KnowledgeBaseView
          docs={knowledgeDocs}
          issues={kanbanIssues}
          onSelectIssue={handleSelectIssue}
        />
      )}

      {/* Modals */}
      <IssueModal
        isOpen={isIssueModalOpen}
        onClose={() => setIsIssueModalOpen(false)}
        issue={selectedIssue}
        initialStatus={modalInitialStatus}
        initialTab={modalInitialTab}
        allIssues={kanbanIssues}
        connections={connections}
        onSaveIssue={handleSaveIssue}
        onDeleteIssue={handleDeleteIssue}
        onCreateConnection={handleCreateConnection}
        onDeleteConnection={handleDeleteConnection}
      />

      <ConnectModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        issues={issues}
        preselectedSourceId={connectSourceId}
        onCreateConnection={handleCreateConnection}
      />

      <Neo4jSettingsModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        currentStatus={neo4jStatus}
        onConfigUpdated={(res) => {
          setNeo4jStatus(res.currentStatus);
          addToast('Neo4j connection configuration updated', 'info');
          loadData();
        }}
      />

      {/* Toast notifications */}
      <div className="toast-container" id="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
