import React, { useState, useEffect } from 'react';
import { X, Cpu, CheckCircle, AlertTriangle, RefreshCw, Key, Globe, Shield, Sparkles } from 'lucide-react';
import { fetchLLMConfig, updateLLMConfig, testLLMConnection } from '../services/api.js';

const AZURE_DEPLOYMENT_PRESETS = [
  { id: 'gpt-4o', label: 'gpt-4o (High Speed & Intelligence)' },
  { id: 'gpt-4o-mini', label: 'gpt-4o-mini (Lightweight & Fast)' },
  { id: 'gpt-4-turbo', label: 'gpt-4-turbo (Reasoning & Auditing)' },
  { id: 'gpt-35-turbo', label: 'gpt-35-turbo (Legacy Standard)' }
];

const GEMINI_MODEL_PRESETS = [
  { id: 'gemini-2.5-flash', label: 'gemini-2.5-flash (Balanced & Fast)' },
  { id: 'gemini-2.5-pro', label: 'gemini-2.5-pro (High Reasoning)' },
  { id: 'gemini-1.5-pro', label: 'gemini-1.5-pro (Legacy Pro)' },
  { id: 'gemini-1.5-flash', label: 'gemini-1.5-flash (Legacy Flash)' }
];

export default function ModelSettingsModal({
  isOpen,
  onClose,
  onModelChanged
}) {
  const [provider, setProvider] = useState('azure');
  const [geminiKey, setGeminiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('gemini-2.5-flash');
  const [azureKey, setAzureKey] = useState('');
  const [azureEndpoint, setAzureEndpoint] = useState('');
  const [azureDeployment, setAzureDeployment] = useState('gpt-4o');
  const [azureApiVersion, setAzureApiVersion] = useState('2024-08-01-preview');
  const [persistEnv, setPersistEnv] = useState(true);

  const [maskedAzureKey, setMaskedAzureKey] = useState('');
  const [maskedGeminiKey, setMaskedGeminiKey] = useState('');

  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    setLoading(true);
    setTestResult(null);
    try {
      const data = await fetchLLMConfig();
      if (data) {
        setProvider(data.active_provider || 'azure');
        if (data.azure) {
          setAzureEndpoint(data.azure.endpoint || '');
          setAzureDeployment(data.azure.deployment || 'gpt-4o');
          setAzureApiVersion(data.azure.api_version || '2024-08-01-preview');
          setMaskedAzureKey(data.azure.masked_key || '');
        }
        if (data.gemini) {
          setGeminiModel(data.gemini.model || 'gemini-2.5-flash');
          setMaskedGeminiKey(data.gemini.masked_key || '');
        }
      }
    } catch (err) {
      console.warn('Could not fetch LLM config:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // First save draft settings to backend in memory so test can verify them
      await updateLLMConfig({
        provider,
        gemini_key: geminiKey || undefined,
        gemini_model: geminiModel,
        azure_key: azureKey || undefined,
        azure_endpoint: azureEndpoint,
        azure_deployment: azureDeployment,
        azure_api_version: azureApiVersion,
        persist_env: false
      });

      const res = await testLLMConnection(provider);
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
      const res = await updateLLMConfig({
        provider,
        gemini_key: geminiKey || undefined,
        gemini_model: geminiModel,
        azure_key: azureKey || undefined,
        azure_endpoint: azureEndpoint,
        azure_deployment: azureDeployment,
        azure_api_version: azureApiVersion,
        persist_env: persistEnv
      });
      if (onModelChanged) {
        onModelChanged(res);
      }
      onClose();
    } catch (err) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} id="llm-settings-backdrop">
      <div 
        className="modal-content" 
        style={{ maxWidth: '620px', width: '92%' }}
        onClick={(e) => e.stopPropagation()}
        id="llm-settings-modal"
      >
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={20} style={{ color: '#0052cc' }} />
            <span>LLM Model Provider Configuration</span>
          </div>
          <button className="btn-icon-subtle" onClick={onClose} id="btn-close-llm-modal">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="modal-form">
          {/* Provider Selection Tabs */}
          <div style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>
              Select Model Provider
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {/* Azure OpenAI Option */}
              <button
                type="button"
                onClick={() => { setProvider('azure'); setTestResult(null); }}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  border: provider === 'azure' ? '2px solid #0052cc' : '1px solid #cbd5e1',
                  background: provider === 'azure' ? '#f0f7ff' : '#ffffff',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                id="select-provider-azure"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Globe size={18} style={{ color: provider === 'azure' ? '#0052cc' : '#64748b' }} />
                  <span style={{ fontWeight: '700', color: provider === 'azure' ? '#0052cc' : '#1e293b', fontSize: '0.95rem' }}>
                    Azure OpenAI
                  </span>
                  {provider === 'azure' && (
                    <span style={{ marginLeft: 'auto', background: '#0052cc', color: '#fff', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '10px', fontWeight: '700' }}>
                      ACTIVE
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                  Enterprise Azure endpoint, custom deployments & models (GPT-4o, etc.)
                </p>
              </button>

              {/* Google Gemini Option */}
              <button
                type="button"
                onClick={() => { setProvider('gemini'); setTestResult(null); }}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  border: provider === 'gemini' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                  background: provider === 'gemini' ? '#f0f9ff' : '#ffffff',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                id="select-provider-gemini"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Sparkles size={18} style={{ color: provider === 'gemini' ? '#0284c7' : '#64748b' }} />
                  <span style={{ fontWeight: '700', color: provider === 'gemini' ? '#0284c7' : '#1e293b', fontSize: '0.95rem' }}>
                    Google Gemini
                  </span>
                  {provider === 'gemini' && (
                    <span style={{ marginLeft: 'auto', background: '#0284c7', color: '#fff', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '10px', fontWeight: '700' }}>
                      ACTIVE
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                  Google GenAI API (Gemini 2.5 Flash, 2.5 Pro)
                </p>
              </button>
            </div>
          </div>

          {/* Azure OpenAI Specific Configuration */}
          {provider === 'azure' && (
            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                <Globe size={16} style={{ color: '#0052cc' }} />
                <span style={{ fontWeight: '700', fontSize: '0.88rem', color: '#0f172a' }}>Azure OpenAI Settings</span>
              </div>

              {/* Endpoint */}
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Azure Endpoint URL</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="https://your-resource-name.openai.azure.com/"
                  value={azureEndpoint}
                  onChange={(e) => setAzureEndpoint(e.target.value)}
                  id="azure-endpoint-input"
                />
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  The Azure resource endpoint from the Azure Portal / AI Studio.
                </span>
              </div>

              {/* Deployment Name */}
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Azure Deployment / Model Name</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                  <select
                    className="form-input"
                    value={azureDeployment}
                    onChange={(e) => setAzureDeployment(e.target.value)}
                    style={{ flex: 1 }}
                    id="azure-deployment-select"
                  >
                    {AZURE_DEPLOYMENT_PRESETS.map(p => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                    {!AZURE_DEPLOYMENT_PRESETS.some(p => p.id === azureDeployment) && (
                      <option value={azureDeployment}>{azureDeployment} (Custom Deployment)</option>
                    )}
                  </select>
                </div>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Or enter custom deployment name (e.g. my-gpt4o-deployment)"
                  value={azureDeployment}
                  onChange={(e) => setAzureDeployment(e.target.value)}
                  style={{ fontSize: '0.82rem' }}
                  id="azure-deployment-custom-input"
                />
              </div>

              {/* API Key */}
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">
                  Azure OpenAI API Key
                  {maskedAzureKey && (
                    <span style={{ marginLeft: '8px', color: '#059669', fontSize: '0.75rem', fontWeight: 'normal' }}>
                      (Configured: {maskedAzureKey})
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  className="form-input"
                  placeholder={maskedAzureKey ? "Leave blank to keep existing key" : "Paste Azure OpenAI API key..."}
                  value={azureKey}
                  onChange={(e) => setAzureKey(e.target.value)}
                  id="azure-key-input"
                />
              </div>

              {/* API Version */}
              <div className="form-group" style={{ marginBottom: '0' }}>
                <label className="form-label">Azure API Version</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="2024-08-01-preview"
                  value={azureApiVersion}
                  onChange={(e) => setAzureApiVersion(e.target.value)}
                  style={{ fontSize: '0.82rem' }}
                  id="azure-version-input"
                />
              </div>
            </div>
          )}

          {/* Gemini Specific Configuration */}
          {provider === 'gemini' && (
            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                <Sparkles size={16} style={{ color: '#0284c7' }} />
                <span style={{ fontWeight: '700', fontSize: '0.88rem', color: '#0f172a' }}>Google Gemini Settings</span>
              </div>

              {/* Model */}
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Gemini Model</label>
                <select
                  className="form-input"
                  value={geminiModel}
                  onChange={(e) => setGeminiModel(e.target.value)}
                  id="gemini-model-select"
                >
                  {GEMINI_MODEL_PRESETS.map(p => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                  {!GEMINI_MODEL_PRESETS.some(p => p.id === geminiModel) && (
                    <option value={geminiModel}>{geminiModel} (Custom Model)</option>
                  )}
                </select>
              </div>

              {/* API Key */}
              <div className="form-group" style={{ marginBottom: '0' }}>
                <label className="form-label">
                  Gemini API Key
                  {maskedGeminiKey && (
                    <span style={{ marginLeft: '8px', color: '#059669', fontSize: '0.75rem', fontWeight: 'normal' }}>
                      (Configured: {maskedGeminiKey})
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  className="form-input"
                  placeholder={maskedGeminiKey ? "Leave blank to keep existing key" : "Paste Google Gemini API key..."}
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  id="gemini-key-input"
                />
              </div>
            </div>
          )}

          {/* Persist to .env toggle */}
          <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              id="persist-env-check"
              checked={persistEnv}
              onChange={(e) => setPersistEnv(e.target.checked)}
              style={{ cursor: 'pointer', width: '16px', height: '16px' }}
            />
            <label htmlFor="persist-env-check" style={{ fontSize: '0.82rem', color: '#475569', cursor: 'pointer' }}>
              Save configuration changes to backend <code>.env</code> file
            </label>
          </div>

          {/* Test connection results banner */}
          {testResult && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '8px',
              marginBottom: '14px',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              background: testResult.success ? '#ecfdf5' : '#fff1f2',
              color: testResult.success ? '#065f46' : '#9f1239',
              border: `1px solid ${testResult.success ? '#a7f3d0' : '#fecdd3'}`
            }}>
              {testResult.success ? <CheckCircle size={18} style={{ color: '#059669', flexShrink: 0 }} /> : <AlertTriangle size={18} style={{ color: '#e11d48', flexShrink: 0 }} />}
              <div>
                <div style={{ fontWeight: '700' }}>
                  {testResult.success ? `${testResult.provider} Connected Successfully!` : 'Connection Test Failed'}
                </div>
                <div style={{ marginTop: '2px', wordBreak: 'break-word' }}>
                  {testResult.success ? (
                    `Model/Deployment: ${testResult.model}`
                  ) : (
                    testResult.error || 'Failed to connect. Please verify endpoint, deployment name, and API key.'
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="modal-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleTest}
              disabled={testing || saving}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              id="btn-test-llm"
            >
              {testing ? <RefreshCw size={14} className="spin" /> : <Shield size={14} />}
              {testing ? 'Testing Connection...' : 'Test Connection'}
            </button>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-dark-blue"
                disabled={saving}
                id="btn-save-llm-config"
              >
                {saving ? 'Saving...' : 'Apply & Save Model'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
