import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Sparkles,
  Cpu,
  Shield,
  Send,
  Copy,
  Check,
  Play,
  RotateCcw,
  Database,
  GitCommit,
  GitPullRequest,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
  Code,
  Table as TableIcon,
  HelpCircle,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import {
  sendGraphChatMessage,
  executeDirectCypher,
  fetchGraphSchema,
  fetchLLMConfig,
  updateLLMConfig,
  testLLMConnection
} from '../services/api.js';

export default function KnowledgeChatView({
  onSelectIssue,
  onOpenModelModal,
  neo4jStatus
}) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      prompt: '',
      answer: `### 👋 Welcome to the Knowledge Graph AI Assistant!
I convert your natural language questions directly into **Neo4j Cypher queries** (Text-to-Cypher) and analyze your connected Jira tickets, Git commits, Pull Requests, and Knowledge Base documentation.

Ask me questions like:
- **"How many recent commits were there and by whom?"**
- **"What issues are currently in progress and who is assigned?"**
- **"Show all pull requests that resolve Jira issues"**
- **"What architecture documents exist in the knowledge base?"**`,
      cypher: 'MATCH (c:Commit) RETURN c.author AS author, count(c) AS commitCount ORDER BY commitCount DESC',
      explanation: 'Example Text-to-Cypher query mapping commits across team members in the Knowledge Graph.',
      records: [],
      recordCount: 0,
      executionTimeMs: 4,
      dataSource: neo4jStatus?.connected ? 'neo4j' : 'memory',
      modelUsed: 'Knowledge Graph Assistant',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [schemaData, setSchemaData] = useState(null);
  const [showSchemaDrawer, setShowSchemaDrawer] = useState(false);

  // Model & Provider State
  const [llmConfig, setLlmConfig] = useState(null);
  const [testingModel, setTestingModel] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [copiedQueryId, setCopiedQueryId] = useState(null);
  const [expandedTableMsgId, setExpandedTableMsgId] = useState(null);

  // Raw Cypher Console Drawer State
  const [rawCypher, setRawCypher] = useState('');
  const [rawRunning, setRawRunning] = useState(false);
  const [rawResult, setRawResult] = useState(null);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadModelConfig();
    loadSchema();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const loadModelConfig = async () => {
    try {
      const cfg = await fetchLLMConfig();
      setLlmConfig(cfg);
    } catch (err) {
      console.warn('Failed to fetch LLM config:', err);
    }
  };

  const loadSchema = async () => {
    try {
      const sch = await fetchGraphSchema();
      setSchemaData(sch);
    } catch (err) {
      console.warn('Failed to load schema:', err);
    }
  };

  // Quick switch to Azure OpenAI
  const handleSwitchToAzure = async () => {
    try {
      const updated = await updateLLMConfig({
        provider: 'azure',
        persist_env: false
      });
      setLlmConfig(updated);
      setTestResult(null);
    } catch (err) {
      console.error('Failed to switch model to Azure OpenAI:', err);
    }
  };

  // Quick switch to Gemini
  const handleSwitchToGemini = async () => {
    try {
      const updated = await updateLLMConfig({
        provider: 'gemini',
        persist_env: false
      });
      setLlmConfig(updated);
      setTestResult(null);
    } catch (err) {
      console.error('Failed to switch model to Gemini:', err);
    }
  };

  // Test Connection button
  const handleTestConnection = async () => {
    setTestingModel(true);
    setTestResult(null);
    try {
      const provider = llmConfig?.active_provider || 'azure';
      const res = await testLLMConnection(provider);
      setTestResult(res);
      // Auto clear test result badge after 6 seconds
      setTimeout(() => {
        setTestResult(null);
      }, 6000);
    } catch (err) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setTestingModel(false);
    }
  };

  // Send Chat message
  const handleSendMessage = async (customPrompt = null) => {
    const promptToSend = (customPrompt || inputPrompt).trim();
    if (!promptToSend || loading) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      prompt: promptToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setInputPrompt('');
    setLoading(true);

    try {
      const result = await sendGraphChatMessage({
        prompt: promptToSend,
        history: messages.slice(-4).map(m => ({ role: m.role, content: m.answer || m.prompt }))
      });

      const assistantMessage = {
        id: `assist-${Date.now()}`,
        role: 'assistant',
        prompt: promptToSend,
        answer: result.answer || 'Query processed.',
        cypher: result.cypher || '',
        explanation: result.explanation || '',
        records: result.records || [],
        recordCount: result.recordCount || 0,
        executionTimeMs: result.executionTimeMs || 0,
        dataSource: result.dataSource || 'memory',
        modelUsed: result.modelUsed || 'Graph AI Engine',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          prompt: promptToSend,
          answer: `⚠️ **Error executing query**: ${err.message}`,
          cypher: '',
          explanation: 'Execution error occurred during query generation.',
          records: [],
          recordCount: 0,
          executionTimeMs: 0,
          dataSource: 'error',
          modelUsed: 'Error Handler',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCypher = (cypher, msgId) => {
    if (!cypher) return;
    navigator.clipboard.writeText(cypher);
    setCopiedQueryId(msgId);
    setTimeout(() => setCopiedQueryId(null), 2000);
  };

  const handleRunRawCypher = async () => {
    if (!rawCypher.trim() || rawRunning) return;
    setRawRunning(true);
    setRawResult(null);
    try {
      const res = await executeDirectCypher(rawCypher.trim());
      setRawResult(res);
    } catch (err) {
      setRawResult({ error: err.message });
    } finally {
      setRawRunning(false);
    }
  };

  const activeProvider = llmConfig?.active_provider || 'azure';
  const isAzure = activeProvider === 'azure';

  return (
    <div style={{
      display: 'flex',
      height: 'calc(100vh - 60px)',
      background: '#f8fafc',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Main Chat Stream Container */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#ffffff',
        borderRight: showSchemaDrawer ? '1px solid #e2e8f0' : 'none'
      }}>
        {/* Chat Header Toolbar */}
        <div style={{
          padding: '12px 20px',
          borderBottom: '1px solid #e2e8f0',
          background: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          {/* Title & Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #0052cc 0%, #2684ff 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 2px 6px rgba(0,82,204,0.25)'
            }}>
              <Sparkles size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                  Knowledge Graph Chat Assistant
                </h1>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  background: '#ede9fe',
                  color: '#6d28d9',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  letterSpacing: '0.02em'
                }}>
                  Text-to-Cypher AI
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                Natural language querying for Neo4j Jira nodes, Git commits, PRs & Knowledge Base
              </p>
            </div>
          </div>

          {/* Model Switcher & Action Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Model Pill & Quick Switcher */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: '#f1f5f9',
              borderRadius: '8px',
              padding: '3px',
              border: '1px solid #e2e8f0'
            }}>
              {/* Azure OpenAI Button */}
              <button
                type="button"
                onClick={handleSwitchToAzure}
                style={{
                  border: 'none',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: isAzure ? '#0052cc' : 'transparent',
                  color: isAzure ? '#ffffff' : '#475569',
                  transition: 'all 0.15s ease'
                }}
                id="btn-switch-azure"
                title="Switch active LLM to Azure OpenAI"
              >
                <Cpu size={13} />
                Azure OpenAI {isAzure && `(${llmConfig?.azure?.deployment || 'gpt-4o'})`}
              </button>

              {/* Gemini Button */}
              <button
                type="button"
                onClick={handleSwitchToGemini}
                style={{
                  border: 'none',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: !isAzure ? '#0284c7' : 'transparent',
                  color: !isAzure ? '#ffffff' : '#475569',
                  transition: 'all 0.15s ease'
                }}
                id="btn-switch-gemini"
                title="Switch active LLM to Google Gemini"
              >
                <Sparkles size={13} />
                Google Gemini {!isAzure && `(${llmConfig?.gemini?.model || '2.5-flash'})`}
              </button>
            </div>

            {/* Test Connection Button */}
            <button
              type="button"
              className="btn-secondary"
              onClick={handleTestConnection}
              disabled={testingModel}
              style={{
                padding: '6px 12px',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 600,
                border: '1px solid #cbd5e1'
              }}
              id="btn-test-connection-chat"
              title="Test connection to active LLM (Azure OpenAI or Gemini)"
            >
              {testingModel ? (
                <RefreshCw size={13} className="spin" style={{ color: '#0052cc' }} />
              ) : (
                <Shield size={13} style={{ color: '#059669' }} />
              )}
              {testingModel ? 'Testing...' : 'Test Connection'}
            </button>

            {/* Configure Model Modal Opener */}
            <button
              type="button"
              className="btn-secondary"
              onClick={onOpenModelModal}
              style={{
                padding: '6px 10px',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
              title="Configure API Keys and Endpoints for Azure OpenAI and Gemini"
              id="btn-open-model-settings"
            >
              <Cpu size={14} />
              Model Settings
            </button>

            {/* Schema & Cypher Drawer Toggle */}
            <button
              type="button"
              className={showSchemaDrawer ? 'btn-dark-blue' : 'btn-secondary'}
              onClick={() => setShowSchemaDrawer(!showSchemaDrawer)}
              style={{
                padding: '6px 10px',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
              id="btn-toggle-schema-drawer"
              title="Inspect Graph Schema and execute raw Cypher queries"
            >
              <Database size={14} />
              Schema & Cypher
            </button>

            {/* Clear Chat */}
            <button
              type="button"
              className="btn-icon-subtle"
              onClick={() => setMessages([messages[0]])}
              title="Reset conversation"
              style={{ padding: '6px' }}
            >
              <RotateCcw size={15} />
            </button>
          </div>
        </div>

        {/* Real-time Connection Test Result Banner */}
        {testResult && (
          <div style={{
            padding: '8px 20px',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: testResult.success ? '#ecfdf5' : '#fff1f2',
            color: testResult.success ? '#065f46' : '#9f1239',
            borderBottom: `1px solid ${testResult.success ? '#a7f3d0' : '#fecdd3'}`,
            animation: 'fadeIn 0.2s ease-in'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {testResult.success ? (
                <CheckCircle2 size={16} style={{ color: '#059669' }} />
              ) : (
                <AlertTriangle size={16} style={{ color: '#e11d48' }} />
              )}
              <span style={{ fontWeight: 600 }}>
                {testResult.success
                  ? `${testResult.provider} Connected! (${testResult.latencyMs}ms latency • Model: ${testResult.model})`
                  : `Connection Test Failed: ${testResult.error}`}
              </span>
            </div>
            <button
              onClick={() => setTestResult(null)}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'inherit', fontWeight: 700 }}
            >
              ×
            </button>
          </div>
        )}

        {/* Message Stream */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
              }}
            >
              {/* User Message Bubble */}
              {msg.role === 'user' ? (
                <div style={{
                  maxWidth: '75%',
                  background: '#0052cc',
                  color: '#ffffff',
                  padding: '12px 16px',
                  borderRadius: '16px 16px 2px 16px',
                  boxShadow: '0 2px 8px rgba(0,82,204,0.18)',
                  fontSize: '0.92rem',
                  lineHeight: 1.5
                }}>
                  <div>{msg.prompt}</div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.8, textAlign: 'right', marginTop: '4px' }}>
                    {msg.timestamp}
                  </div>
                </div>
              ) : (
                /* Assistant Message Card */
                <div style={{
                  maxWidth: '88%',
                  width: '100%',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  overflow: 'hidden'
                }}>
                  {/* Card Header with Model & Execution Meta */}
                  <div style={{
                    padding: '10px 14px',
                    background: '#f8fafc',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '6px',
                        background: '#ede9fe',
                        color: '#7c3aed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Sparkles size={13} />
                      </div>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
                        {msg.modelUsed || 'Knowledge Graph Assistant'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {msg.executionTimeMs > 0 && (
                        <span style={{
                          fontSize: '0.7rem',
                          background: '#f1f5f9',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          color: '#64748b',
                          fontWeight: 600
                        }}>
                          ⚡ {msg.executionTimeMs}ms
                        </span>
                      )}
                      {msg.recordCount > 0 && (
                        <span style={{
                          fontSize: '0.7rem',
                          background: '#ecfdf5',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          color: '#059669',
                          fontWeight: 600
                        }}>
                          {msg.recordCount} records
                        </span>
                      )}
                      <span style={{
                        fontSize: '0.7rem',
                        background: msg.dataSource === 'neo4j' ? '#eff6ff' : '#f8fafc',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        color: msg.dataSource === 'neo4j' ? '#0052cc' : '#64748b',
                        fontWeight: 600
                      }}>
                        {msg.dataSource === 'neo4j' ? 'Neo4j Live' : 'Memory Graph'}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                        {msg.timestamp}
                      </span>
                    </div>
                  </div>

                  {/* Card Body - Natural Language Answer */}
                  <div style={{ padding: '14px 16px', fontSize: '0.9rem', lineHeight: 1.6, color: '#1e293b' }}>
                    <div style={{ whiteSpace: 'pre-wrap' }}>
                      {msg.answer}
                    </div>

                    {/* Step: Generated Cypher Query Box */}
                    {msg.cypher && (
                      <div style={{
                        marginTop: '14px',
                        background: '#0f172a',
                        borderRadius: '8px',
                        border: '1px solid #1e293b',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          padding: '6px 12px',
                          background: '#1e293b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderBottom: '1px solid #334155'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Code size={13} style={{ color: '#38bdf8' }} />
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.04em' }}>
                              GENERATED CYPHER QUERY
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => handleCopyCypher(msg.cypher, msg.id)}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: '#94a3b8',
                                cursor: 'pointer',
                                fontSize: '0.72rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 6px',
                                borderRadius: '4px'
                              }}
                              title="Copy Cypher query to clipboard"
                            >
                              {copiedQueryId === msg.id ? (
                                <>
                                  <Check size={12} style={{ color: '#4ade80' }} />
                                  <span style={{ color: '#4ade80' }}>Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={12} />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Code block */}
                        <div style={{
                          padding: '10px 14px',
                          fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                          fontSize: '0.82rem',
                          color: '#38bdf8',
                          lineHeight: 1.5,
                          whiteSpace: 'pre-wrap',
                          overflowX: 'auto'
                        }}>
                          {msg.cypher}
                        </div>

                        {/* Explanation footer */}
                        {msg.explanation && (
                          <div style={{
                            padding: '6px 12px',
                            background: '#0b1120',
                            borderTop: '1px solid #1e293b',
                            fontSize: '0.74rem',
                            color: '#94a3b8'
                          }}>
                            💡 <span style={{ color: '#cbd5e1' }}>Logic:</span> {msg.explanation}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Collapsible Records Table Button */}
                    {msg.records && msg.records.length > 0 && (
                      <div style={{ marginTop: '12px' }}>
                        <button
                          type="button"
                          onClick={() => setExpandedTableMsgId(expandedTableMsgId === msg.id ? null : msg.id)}
                          style={{
                            border: '1px solid #e2e8f0',
                            background: '#f8fafc',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            color: '#475569',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <TableIcon size={13} style={{ color: '#0052cc' }} />
                          {expandedTableMsgId === msg.id ? 'Hide Raw Graph Records' : `View Raw Records (${msg.records.length})`}
                        </button>

                        {/* Expanded Records Table */}
                        {expandedTableMsgId === msg.id && (
                          <div style={{
                            marginTop: '8px',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            maxHeight: '260px',
                            overflowY: 'auto'
                          }}>
                            <table style={{
                              width: '100%',
                              borderCollapse: 'collapse',
                              fontSize: '0.78rem',
                              textAlign: 'left'
                            }}>
                              <thead style={{ background: '#f1f5f9', position: 'sticky', top: 0 }}>
                                <tr>
                                  {Object.keys(msg.records[0] || {}).map((col) => (
                                    <th key={col} style={{ padding: '8px 10px', borderBottom: '1px solid #cbd5e1', fontWeight: 700, color: '#334155' }}>
                                      {col}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {msg.records.map((row, idx) => (
                                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                    {Object.entries(row).map(([k, val], cIdx) => (
                                      <td key={cIdx} style={{ padding: '8px 10px', color: '#1e293b' }}>
                                        {/* If it's a Jira key, make it clickable */}
                                        {typeof val === 'string' && (val.startsWith('FB-') || val.startsWith('KAN-')) ? (
                                          <button
                                            type="button"
                                            onClick={() => onSelectIssue && onSelectIssue({ key: val })}
                                            style={{
                                              border: 'none',
                                              background: '#eff6ff',
                                              color: '#0052cc',
                                              fontWeight: 700,
                                              padding: '2px 6px',
                                              borderRadius: '4px',
                                              cursor: 'pointer'
                                            }}
                                            title="Click to view Jira Issue in Modal"
                                          >
                                            {val}
                                          </button>
                                        ) : Array.isArray(val) ? (
                                          <span style={{ color: '#64748b' }}>[{val.join(', ')}]</span>
                                        ) : typeof val === 'object' && val !== null ? (
                                          <pre style={{ margin: 0, fontSize: '0.7rem' }}>{JSON.stringify(val)}</pre>
                                        ) : (
                                          String(val ?? '')
                                        )}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Loading Indicator */}
          {loading && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 16px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              maxWidth: '380px'
            }}>
              <RefreshCw size={16} className="spin" style={{ color: '#0052cc' }} />
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b' }}>
                  Translating to Cypher & Querying Neo4j...
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  Using {isAzure ? `Azure OpenAI (${llmConfig?.azure?.deployment || 'gpt-4o'})` : 'Google Gemini'}
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Prompt Chips Carousel */}
        <div style={{
          padding: '8px 20px',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap' }}>
            Quick Queries:
          </span>
          {[
            'how many recent commits where there and ny whom..??',
            'What issues are currently in progress and who is assigned?',
            'Show all pull requests that resolve Jira issues',
            'What architecture documents exist in the knowledge base?',
            'Which issues have blocking dependencies in the graph?'
          ].map((promptText, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSendMessage(promptText)}
              disabled={loading}
              style={{
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                padding: '4px 10px',
                borderRadius: '16px',
                fontSize: '0.75rem',
                color: '#334155',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontWeight: 500,
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0052cc'; e.currentTarget.style.color = '#0052cc'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#334155'; }}
            >
              {promptText}
            </button>
          ))}
        </div>

        {/* Chat Input Box */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid #e2e8f0',
          background: '#ffffff'
        }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            style={{ display: 'flex', gap: '10px', alignItems: 'center' }}
          >
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                placeholder="Ask about commits, issues, pull requests, docs (e.g. how many recent commits were there and by whom?)..."
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '0.88rem',
                  outline: 'none',
                  transition: 'border 0.2s',
                  background: '#ffffff'
                }}
                onFocus={(e) => { e.target.style.borderColor = '#0052cc'; }}
                onBlur={(e) => { e.target.style.borderColor = '#cbd5e1'; }}
                id="input-chat-query"
              />
            </div>

            <button
              type="submit"
              disabled={!inputPrompt.trim() || loading}
              className="btn-dark-blue"
              style={{
                padding: '12px 18px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 600,
                height: '45px'
              }}
              id="btn-send-chat"
            >
              <Send size={16} />
              <span>Ask Graph</span>
            </button>
          </form>

          {/* Model Status Bar Footer */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '8px',
            fontSize: '0.72rem',
            color: '#64748b'
          }}>
            <span>
              Model Provider: <strong>{isAzure ? 'Azure OpenAI' : 'Google Gemini'}</strong> ({isAzure ? llmConfig?.azure?.deployment || 'gpt-4o' : llmConfig?.gemini?.model || 'gemini-3.6-flash'}) &bull; Neo4j Bolt: {neo4jStatus?.connected ? 'Connected' : 'Local Fallback'}
            </span>
            <button
              type="button"
              onClick={onOpenModelModal}
              style={{ border: 'none', background: 'transparent', color: '#0052cc', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
            >
              Configure Azure Credentials & Endpoint
            </button>
          </div>
        </div>
      </div>

      {/* Right Drawer: Schema Cheatsheet & Direct Cypher Console */}
      {showSchemaDrawer && (
        <div style={{
          width: '380px',
          height: '100%',
          background: '#f8fafc',
          borderLeft: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto'
        }}>
          {/* Drawer Header */}
          <div style={{
            padding: '14px 16px',
            borderBottom: '1px solid #e2e8f0',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={16} style={{ color: '#0052cc' }} />
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                Graph Schema & Console
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowSchemaDrawer(false)}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b', fontWeight: 700 }}
            >
              ✕
            </button>
          </div>

          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Raw Cypher Console */}
            <div style={{
              background: '#ffffff',
              padding: '14px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>
                  Execute Raw Cypher
                </span>
                <span style={{ fontSize: '0.68rem', color: '#64748b' }}>Custom statement</span>
              </div>
              <textarea
                rows={3}
                value={rawCypher}
                onChange={(e) => setRawCypher(e.target.value)}
                placeholder="MATCH (c:Commit) RETURN c.author, count(c) LIMIT 10"
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontFamily: 'Consolas, monospace',
                  fontSize: '0.78rem',
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
              <button
                type="button"
                onClick={handleRunRawCypher}
                disabled={rawRunning || !rawCypher.trim()}
                className="btn-dark-blue"
                style={{
                  width: '100%',
                  marginTop: '8px',
                  padding: '6px',
                  fontSize: '0.78rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                {rawRunning ? <RefreshCw size={12} className="spin" /> : <Play size={12} />}
                {rawRunning ? 'Running...' : 'Run Cypher'}
              </button>

              {rawResult && (
                <div style={{ marginTop: '10px', fontSize: '0.74rem' }}>
                  {rawResult.error ? (
                    <div style={{ color: '#e11d48', background: '#fff1f2', padding: '6px', borderRadius: '4px' }}>
                      {rawResult.error}
                    </div>
                  ) : (
                    <div style={{ color: '#059669', background: '#ecfdf5', padding: '6px', borderRadius: '4px' }}>
                      Success: {rawResult.count} records ({rawResult.executionTimeMs}ms)
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Schema Entities */}
            <div>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '8px' }}>
                Labeled Node Entities
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(schemaData?.nodes || []).map((node) => (
                  <div key={node.label} style={{
                    padding: '10px',
                    borderRadius: '8px',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: node.label === 'Commit' ? '#0284c7' : node.label === 'Issue' ? '#0052cc' : node.label === 'PullRequest' ? '#059669' : '#7c3aed',
                        background: '#f1f5f9',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}>
                        :{node.label}
                      </span>
                    </div>
                    <p style={{ margin: '0 0 6px 0', fontSize: '0.72rem', color: '#64748b' }}>
                      {node.description}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                      {node.properties.map(p => (
                        <span key={p} style={{ fontSize: '0.65rem', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '1px 4px', borderRadius: '3px', color: '#475569' }}>
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Relationships */}
            <div>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '8px' }}>
                Graph Relationship Edges
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {(schemaData?.relationships || []).map((rel) => (
                  <div key={rel.type} style={{
                    padding: '8px',
                    borderRadius: '6px',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.72rem'
                  }}>
                    <div style={{ fontFamily: 'Consolas, monospace', fontWeight: 700, color: '#0052cc', marginBottom: '2px' }}>
                      {rel.pattern}
                    </div>
                    <div style={{ color: '#64748b', fontSize: '0.7rem' }}>
                      {rel.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
