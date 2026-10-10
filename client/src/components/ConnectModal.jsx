import React, { useState, useEffect } from 'react';
import { X, Link2, ArrowRight } from 'lucide-react';

const RELATION_TYPES = [
  { id: 'BLOCKS', label: 'BLOCKS (A blocks B)', desc: 'A must be completed before B can start' },
  { id: 'DEPENDS_ON', label: 'DEPENDS ON (A depends on B)', desc: 'A requires B to be resolved' },
  { id: 'RELATES_TO', label: 'RELATES TO (A relates to B)', desc: 'General contextual link between tasks' },
  { id: 'SUBTASK_OF', label: 'SUBTASK OF (A is child of B)', desc: 'Hierarchical breakdown relationship' },
  { id: 'DUPLICATES', label: 'DUPLICATES (A duplicates B)', desc: 'Duplicate issue relationship' }
];

export default function ConnectModal({
  isOpen,
  onClose,
  issues = [],
  preselectedSourceId = null,
  onCreateConnection
}) {
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [relationType, setRelationType] = useState('BLOCKS');

  useEffect(() => {
    if (preselectedSourceId) {
      setSourceId(preselectedSourceId);
    } else if (issues.length > 0 && !sourceId) {
      setSourceId(issues[0].id);
    }
    if (issues.length > 1 && !targetId) {
      const other = issues.find(i => i.id !== (preselectedSourceId || issues[0]?.id));
      if (other) setTargetId(other.id);
    }
  }, [preselectedSourceId, issues, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!sourceId || !targetId || sourceId === targetId) return;
    onCreateConnection(sourceId, targetId, relationType);
    onClose();
  };

  const sourceNode = issues.find(i => i.id === sourceId);
  const targetNode = issues.find(i => i.id === targetId);

  return (
    <div className="modal-overlay" onClick={onClose} id="connect-modal-backdrop">
      <div 
        className="modal-content" 
        style={{ maxWidth: '580px' }}
        onClick={(e) => e.stopPropagation()}
        id="connect-modal"
      >
        <div className="modal-header">
          <div className="modal-title">
            <Link2 size={18} style={{ color: '#0052cc' }} />
            <span>Create Neo4j Graph Connection</span>
          </div>
          <button className="btn-icon-subtle" onClick={onClose} id="btn-close-connect-modal">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '8px' }}>
              Create a directed Cypher relationship edge between two Jira issue nodes in your Neo4j database:
              <br />
              <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', color: '#0f172a' }}>
                MATCH (a:Issue), (b:Issue) MERGE (a)-[:{relationType}]-&gt;(b)
              </code>
            </p>

            <div className="form-group">
              <label className="form-label">Source Node (A)</label>
              <select
                className="form-select"
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                id="select-source-node"
                required
              >
                <option value="">Select source issue...</option>
                {issues.map(item => (
                  <option key={item.id} value={item.id}>
                    [{item.key}] {item.title} ({item.status})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Relationship Type</label>
              <select
                className="form-select"
                value={relationType}
                onChange={(e) => setRelationType(e.target.value)}
                id="select-relation-type"
              >
                {RELATION_TYPES.map(rel => (
                  <option key={rel.id} value={rel.id}>
                    {rel.label}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                {RELATION_TYPES.find(r => r.id === relationType)?.desc}
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Target Node (B)</label>
              <select
                className="form-select"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                id="select-target-node"
                required
              >
                <option value="">Select target issue...</option>
                {issues
                  .filter(item => item.id !== sourceId)
                  .map(item => (
                    <option key={item.id} value={item.id}>
                      [{item.key}] {item.title} ({item.status})
                    </option>
                  ))}
              </select>
            </div>

            {/* Visual Preview */}
            {sourceNode && targetNode && sourceId !== targetId && (
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                marginTop: '6px'
              }}>
                <div style={{ fontWeight: 700, color: '#1e3a8a', fontSize: '0.85rem' }}>
                  {sourceNode.key}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className={`rel-badge ${relationType.toLowerCase()}`}>
                    {relationType} &rarr;
                  </span>
                </div>
                <div style={{ fontWeight: 700, color: '#047857', fontSize: '0.85rem' }}>
                  {targetNode.key}
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-dark-blue"
              disabled={!sourceId || !targetId || sourceId === targetId}
              id="btn-submit-connect"
            >
              <Link2 size={16} />
              Create Connection in Neo4j
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
