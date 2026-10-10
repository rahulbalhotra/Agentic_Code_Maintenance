import React, { useState, useEffect } from 'react';
import { 
  GitBranch, 
  GitCommit, 
  GitPullRequest, 
  FolderGit2, 
  ExternalLink, 
  CheckCircle, 
  Clock, 
  FileCode, 
  Layers,
  Play
} from 'lucide-react';
import { fetchWorkspaceRepo } from '../services/api.js';

export default function WorkspaceRepoView({ onSelectIssue }) {
  const [repoData, setRepoData] = useState(null);
  const [activeTab, setActiveTab] = useState('prs'); // 'prs' | 'commits' | 'preview'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchWorkspaceRepo();
        setRepoData(data);
      } catch (err) {
        console.error('Failed to load workspace repo:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
        Loading /workspace/fb_clone_repo git metrics...
      </div>
    );
  }

  const prs = repoData?.pullRequests || [];
  const commits = repoData?.commits || [];

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '24px 20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Workspace Header Card */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '20px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            background: '#1877f2',
            color: '#ffffff',
            width: '48px',
            height: '48px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem'
          }}>
            <FolderGit2 size={26} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                fb_clone_repo
              </h1>
              <span style={{
                background: '#e0f2fe',
                color: '#0369a1',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '0.75rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <GitBranch size={12} />
                branch: {repoData?.branch || 'master'}
              </span>
              <span style={{
                background: '#ecfdf5',
                color: '#047857',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '0.75rem',
                fontWeight: 600
              }}>
                Git Initialized
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.88rem' }}>
              Local Repository Path: <code>d:\Auto-Jira-Agent\workspace\fb_clone_repo</code>
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <a
            href="http://localhost:4000/workspace/preview"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#0052cc',
              color: '#ffffff',
              padding: '10px 18px',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.88rem',
              textDecoration: 'none',
              boxShadow: '0 2px 4px rgba(0, 82, 204, 0.2)'
            }}
          >
            <Play size={15} />
            Launch Live FB Clone
            <ExternalLink size={14} />
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        borderBottom: '1px solid #e2e8f0',
        marginBottom: '20px'
      }}>
        <button
          onClick={() => setActiveTab('prs')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: `3px solid ${activeTab === 'prs' ? '#0052cc' : 'transparent'}`,
            color: activeTab === 'prs' ? '#0052cc' : '#64748b',
            fontWeight: 600,
            fontSize: '0.9rem',
            padding: '10px 16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <GitPullRequest size={16} />
          Pull Requests ({prs.length})
        </button>

        <button
          onClick={() => setActiveTab('commits')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: `3px solid ${activeTab === 'commits' ? '#0052cc' : 'transparent'}`,
            color: activeTab === 'commits' ? '#0052cc' : '#64748b',
            fontWeight: 600,
            fontSize: '0.9rem',
            padding: '10px 16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <GitCommit size={16} />
          Git Commits ({commits.length})
        </button>

        <button
          onClick={() => setActiveTab('preview')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: `3px solid ${activeTab === 'preview' ? '#0052cc' : 'transparent'}`,
            color: activeTab === 'preview' ? '#0052cc' : '#64748b',
            fontWeight: 600,
            fontSize: '0.9rem',
            padding: '10px 16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Play size={16} />
          Embedded Live Preview
        </button>
      </div>

      {/* Tab: Pull Requests */}
      {activeTab === 'prs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {prs.map(pr => {
            const statusBg = pr.status === 'MERGED' ? '#8b5cf6' : pr.status === 'OPEN' ? '#10b981' : '#f59e0b';
            return (
              <div
                key={pr.id}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <span style={{
                      background: statusBg,
                      color: '#ffffff',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '12px'
                    }}>
                      {pr.status}
                    </span>
                    <strong style={{ fontSize: '0.98rem', color: '#0f172a' }}>
                      #{pr.number} {pr.title}
                    </strong>
                    {pr.linkedIssue && (
                      <span style={{
                        background: '#e0f2fe',
                        color: '#0369a1',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '4px'
                      }}>
                        Jira: {pr.linkedIssue}
                      </span>
                    )}
                  </div>

                  <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#64748b' }}>
                    {pr.description}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.78rem', color: '#94a3b8' }}>
                    <span>Author: <strong>{pr.author}</strong></span>
                    <span>&bull;</span>
                    <span>Branch: <code>{pr.branch}</code> &rarr; <code>{pr.base}</code></span>
                    <span>&bull;</span>
                    <span>Changed: {pr.changedFiles?.join(', ')}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab: Commits */}
      {activeTab === 'commits' && (
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          overflow: 'hidden'
        }}>
          {commits.map((c, idx) => (
            <div
              key={c.hash || idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 20px',
                borderBottom: idx === commits.length - 1 ? 'none' : '1px solid #f1f5f9'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <code style={{
                  background: '#f1f5f9',
                  color: '#0052cc',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '0.8rem',
                  fontWeight: 600
                }}>
                  {c.hash}
                </code>
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>
                    {c.message}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                    {c.author} committed on {c.date}
                  </div>
                </div>
              </div>

              {c.linkedIssueKey && (
                <span style={{
                  background: '#e0f2fe',
                  color: '#0369a1',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '4px'
                }}>
                  {c.linkedIssueKey}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tab: Embedded Preview */}
      {activeTab === 'preview' && (
        <div style={{
          border: '1px solid #cbd5e1',
          borderRadius: '12px',
          overflow: 'hidden',
          background: '#f0f2f5',
          height: '750px'
        }}>
          <iframe
            src="http://localhost:4000/workspace/preview"
            title="Facebook Clone Live Preview"
            style={{
              width: '100%',
              height: '100%',
              border: 'none'
            }}
          />
        </div>
      )}
    </div>
  );
}
