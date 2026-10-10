import React, { useState, useEffect } from 'react';
import { X, Database, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { testNeo4jConnection, updateNeo4jConfig } from '../services/api.js';

export default function Neo4jSettingsModal({
  isOpen,
  onClose,
  currentStatus,
  onConfigUpdated
}) {
  const [uri, setUri] = useState('bolt://localhost:7687');
  const [user, setUser] = useState('neo4j');
  const [password, setPassword] = useState('12345678');
  const [database, setDatabase] = useState('neo4j');

  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    if (currentStatus) {
      if (currentStatus.uri) setUri(currentStatus.uri);
      if (currentStatus.user) setUser(currentStatus.user);
      if (currentStatus.database) setDatabase(currentStatus.database);
    }
  }, [currentStatus, isOpen]);

  if (!isOpen) return null;

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testNeo4jConnection({ uri, user, password });
      setTestResult(res);
    } catch (err) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await updateNeo4jConfig({ uri, user, password, database });
      if (onConfigUpdated) onConfigUpdated(res);
      onClose();
    } catch (err) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} id="neo4j-settings-backdrop">
      <div 
        className="modal-content" 
        style={{ maxWidth: '600px' }}
        onClick={(e) => e.stopPropagation()}
        id="neo4j-settings-modal"
      >
        <div className="modal-header">
          <div className="modal-title">
            <Database size={20} style={{ color: '#0052cc' }} />
            <span>Neo4j Desktop Graph Configuration</span>
          </div>
          <button className="btn-icon-subtle" onClick={onClose} id="btn-close-settings">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div className="modal-body">
            {/* Connection Status Banner */}
            <div style={{
              background: currentStatus?.connected ? '#ecfdf5' : '#fffbeb',
              border: `1px solid ${currentStatus?.connected ? '#a7f3d0' : '#fde68a'}`,
              borderRadius: '8px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '0.85rem'
            }}>
              {currentStatus?.connected ? (
                <>
                  <CheckCircle size={20} style={{ color: '#059669', flexShrink: 0 }} />
                  <div>
                    <strong style={{ color: '#047857' }}>Neo4j Desktop is Connected!</strong>
                    <div style={{ color: '#065f46', fontSize: '0.78rem' }}>
                      Graph queries and Cypher updates are synced directly with your local Neo4j instance at {currentStatus.uri}.
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <AlertTriangle size={20} style={{ color: '#d97706', flexShrink: 0 }} />
                  <div>
                    <strong style={{ color: '#b45309' }}>Neo4j Local Instance Offline or Locked</strong>
                    <div style={{ color: '#92400e', fontSize: '0.78rem' }}>
                      Start your local database in <strong>Neo4j Desktop</strong> and verify your credentials below. The app is currently caching changes locally and will synchronize immediately once connected.
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Bolt URI</label>
              <input
                type="text"
                className="form-input"
                value={uri}
                onChange={(e) => setUri(e.target.value)}
                placeholder="bolt://localhost:7687"
                required
                id="input-neo4j-uri"
              />
              <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                Default Neo4j Desktop protocol and port is bolt://localhost:7687
              </span>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  type="text"
                  className="form-input"
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  placeholder="neo4j"
                  required
                  id="input-neo4j-user"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password entered in Neo4j Desktop"
                  required
                  id="input-neo4j-password"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Database Name</label>
              <input
                type="text"
                className="form-input"
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
                placeholder="neo4j"
                required
                id="input-neo4j-database"
              />
            </div>

            {/* Test result feedback */}
            {testResult && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '6px',
                fontSize: '0.82rem',
                background: testResult.success ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${testResult.success ? '#bbf7d0' : '#fecaca'}`,
                color: testResult.success ? '#166534' : '#991b1b'
              }}>
                {testResult.success ? (
                  <span>Success! Neo4j Agent verified: {testResult.agent}</span>
                ) : (
                  <span>Connection failed: {testResult.error}</span>
                )}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleTest}
              disabled={testing}
              id="btn-test-neo4j"
            >
              <RefreshCw size={14} className={testing ? 'animate-spin' : ''} />
              {testing ? 'Testing...' : 'Test Connection'}
            </button>

            <button
              type="submit"
              className="btn-dark-blue"
              disabled={saving}
              id="btn-save-neo4j"
            >
              {saving ? 'Connecting...' : 'Save & Connect to Neo4j'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
