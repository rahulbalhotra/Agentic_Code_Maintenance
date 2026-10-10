import React, { useState, useEffect } from 'react';
import { X, Link2, Plus, Trash2, ArrowRight, ArrowLeft } from 'lucide-react';

export default function IssueModal({
  isOpen,
  onClose,
  issue,
  initialStatus = 'TODO',
  allIssues = [],
  connections = [],
  onSaveIssue,
  onDeleteIssue,
  onCreateConnection,
  onDeleteConnection,
  initialTab = 'details'
}) {
  const isEditing = Boolean(issue && issue.id);

  const [activeTab, setActiveTab] = useState(initialTab);
  const [formData, setFormData] = useState({
    title: '',
    key: '',
    type: 'Task',
    status: initialStatus,
    priority: 'MEDIUM',
    assignee: 'Dev Team',
    storyPoints: 3,
    description: ''
  });

  // State for adding a connection
  const [connTargetId, setConnTargetId] = useState('');
  const [connType, setConnType] = useState('BLOCKS');

  useEffect(() => {
    if (issue) {
      setFormData({
        title: issue.title || '',
        key: issue.key || '',
        type: issue.type || 'Task',
        status: issue.status || 'TODO',
        priority: issue.priority || 'MEDIUM',
        assignee: issue.assignee || 'Dev Team',
        storyPoints: issue.storyPoints || 1,
        description: issue.description || ''
      });
    } else {
      setFormData({
        title: '',
        key: `KAN-${Math.floor(100 + Math.random() * 900)}`,
        type: 'Task',
        status: initialStatus,
        priority: 'MEDIUM',
        assignee: 'Dev Team',
        storyPoints: 3,
        description: ''
      });
    }
    setActiveTab(initialTab);
  }, [issue, initialStatus, initialTab, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    onSaveIssue(formData, issue ? issue.id : null);
    onClose();
  };

  const handleAddConnection = async (e) => {
    e.preventDefault();
    if (!connTargetId || !issue?.id) return;
    await onCreateConnection(issue.id, connTargetId, connType);
    setConnTargetId('');
  };

  // Find relationships for this issue
  const outgoingRels = connections.filter(c => c.sourceId === issue?.id);
  const incomingRels = connections.filter(c => c.targetId === issue?.id);

  // Available targets (exclude self)
  const availableTargets = allIssues.filter(i => i.id !== issue?.id);

  return (
    <div className="modal-overlay" onClick={onClose} id="issue-modal-backdrop">
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()}
        id="issue-modal"
      >
        <div className="modal-header">
          <div className="modal-title">
            <span style={{ color: '#1e40af' }}>{isEditing ? `Edit ${formData.key}` : 'Create Jira Issue'}</span>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>
              &bull; Neo4j Node
            </span>
          </div>
          <button className="btn-icon-subtle" onClick={onClose} id="btn-close-modal">
            <X size={20} />
          </button>
        </div>

        {isEditing && (
          <div className="modal-tabs">
            <button
              className={`tab-btn ${activeTab === 'details' ? 'active' : ''}`}
              onClick={() => setActiveTab('details')}
              id="tab-details"
            >
              Issue Details
            </button>
            <button
              className={`tab-btn ${activeTab === 'connections' ? 'active' : ''}`}
              onClick={() => setActiveTab('connections')}
              id="tab-connections"
            >
              <Link2 size={14} />
              Neo4j Graph Connections ({outgoingRels.length + incomingRels.length})
            </button>
          </div>
        )}

        {activeTab === 'details' ? (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Summary / Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Set up Neo4j desktop bolt connection"
                  className="form-input"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  id="input-issue-title"
                />
              </div>

              <div className="form-grid-3">
                <div className="form-group">
                  <label className="form-label">Issue Key</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.key}
                    onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                    id="input-issue-key"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select
                    className="form-select"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    id="select-issue-type"
                  >
                    <option value="Story">Story</option>
                    <option value="Task">Task</option>
                    <option value="Bug">Bug</option>
                    <option value="Epic">Epic</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    id="select-issue-status"
                  >
                    <option value="BACKLOG">Backlog</option>
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="REVIEW">Code Review</option>
                    <option value="DONE">Done</option>
                  </select>
                </div>
              </div>

              <div className="form-grid-3">
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select
                    className="form-select"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    id="select-issue-priority"
                  >
                    <option value="HIGHEST">Highest</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                    <option value="LOWEST">Lowest</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Assignee</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.assignee}
                    onChange={(e) => setFormData({ ...formData, assignee: e.target.value })}
                    id="input-issue-assignee"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Story Points</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="form-input"
                    value={formData.storyPoints}
                    onChange={(e) => setFormData({ ...formData, storyPoints: e.target.value })}
                    id="input-issue-points"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  placeholder="Detailed criteria, Neo4j graph context, or task description..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  id="textarea-issue-desc"
                />
              </div>
            </div>

            <div className="modal-footer">
              {isEditing && (
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ color: '#dc2626', borderColor: '#fca5a5', marginRight: 'auto' }}
                  onClick={() => {
                    if (window.confirm(`Delete issue ${formData.key}?`)) {
                      onDeleteIssue(issue.id);
                      onClose();
                    }
                  }}
                  id="btn-delete-issue-modal"
                >
                  <Trash2 size={15} />
                  Delete Issue
                </button>
              )}

              <button
                type="button"
                className="btn-secondary"
                onClick={onClose}
                id="btn-cancel-modal"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn-dark-blue"
                id="btn-save-issue"
              >
                {isEditing ? 'Update Node in Neo4j' : 'Create Node in Neo4j'}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div className="modal-body">
              {/* Add Connection Section */}
              <div className="connections-section">
                <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0b2545' }}>
                  Create Graph Connection from this Node
                </div>
                <div className="form-grid-3" style={{ alignItems: 'flex-end' }}>
                  <div className="form-group" style={{ gridColumn: 'span 1' }}>
                    <label className="form-label">Relationship Type</label>
                    <select
                      className="form-select"
                      value={connType}
                      onChange={(e) => setConnType(e.target.value)}
                      id="select-conn-type"
                    >
                      <option value="BLOCKS">BLOCKS (&rarr;)</option>
                      <option value="DEPENDS_ON">DEPENDS_ON (&rarr;)</option>
                      <option value="RELATES_TO">RELATES_TO (&rarr;)</option>
                      <option value="SUBTASK_OF">SUBTASK_OF (&rarr;)</option>
                      <option value="DUPLICATES">DUPLICATES (&rarr;)</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 1' }}>
                    <label className="form-label">Target Issue</label>
                    <select
                      className="form-select"
                      value={connTargetId}
                      onChange={(e) => setConnTargetId(e.target.value)}
                      id="select-conn-target"
                    >
                      <option value="">Select target node...</option>
                      {availableTargets.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.key} - {t.title.substring(0, 32)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    className="btn-dark-blue"
                    onClick={handleAddConnection}
                    disabled={!connTargetId}
                    id="btn-add-conn-inline"
                  >
                    <Plus size={15} />
                    Add Link
                  </button>
                </div>
              </div>

              {/* Active Connections List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#475569' }}>
                  Active Graph Edges in Neo4j:
                </div>

                {outgoingRels.length === 0 && incomingRels.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                    No connections for this node yet. Use the form above to link to another issue.
                  </div>
                ) : (
                  <>
                    {outgoingRels.map((rel, idx) => (
                      <div key={`out-${idx}`} className="connection-item">
                        <div className="conn-flow">
                          <strong style={{ color: '#1e3a8a' }}>{issue.key}</strong>
                          <span className={`rel-badge ${rel.type.toLowerCase()}`}>
                            {rel.type} &rarr;
                          </span>
                          <span><strong>{rel.targetKey || rel.targetId}</strong>: {rel.targetTitle || ''}</span>
                        </div>
                        <button
                          className="btn-icon-subtle"
                          style={{ color: '#ef4444' }}
                          title="Remove connection"
                          onClick={() => onDeleteConnection(issue.id, rel.targetId, rel.type)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}

                    {incomingRels.map((rel, idx) => (
                      <div key={`in-${idx}`} className="connection-item">
                        <div className="conn-flow">
                          <span><strong>{rel.sourceKey || rel.sourceId}</strong>: {rel.sourceTitle || ''}</span>
                          <span className={`rel-badge ${rel.type.toLowerCase()}`}>
                            &rarr; {rel.type}
                          </span>
                          <strong style={{ color: '#1e3a8a' }}>{issue.key}</strong>
                        </div>
                        <button
                          className="btn-icon-subtle"
                          style={{ color: '#ef4444' }}
                          title="Remove connection"
                          onClick={() => onDeleteConnection(rel.sourceId, issue.id, rel.type)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
