import React, { useState, useEffect } from 'react';
import { 
  GitBranch, 
  GitCommit, 
  GitCompare, 
  FileCode, 
  FolderGit2, 
  ChevronRight, 
  ChevronDown, 
  Play, 
  ExternalLink, 
  Plus, 
  Minus, 
  Copy, 
  Check, 
  Eye, 
  Columns, 
  List, 
  FileText,
  RotateCcw
} from 'lucide-react';
import { 
  fetchWorkspaceRepos, 
  fetchWorkspaceCommits, 
  fetchWorkspaceFiles, 
  fetchWorkspaceFileContent, 
  fetchWorkspaceDiff 
} from '../services/api.js';

export default function RepoDiffView({ onSelectIssue }) {
  const [repos, setRepos] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState('fb_clone_repo');
  const [commits, setCommits] = useState([]);
  const [allFiles, setAllFiles] = useState([]);

  // Version selection state
  // Mode: 'single' (inspect commit vs parent) | 'range' (compare base vs target)
  const [compareMode, setCompareMode] = useState('single');
  const [selectedCommitHash, setSelectedCommitHash] = useState('');
  const [baseCommitHash, setBaseCommitHash] = useState('');
  const [targetCommitHash, setTargetCommitHash] = useState('');

  // Diff data state
  const [diffData, setDiffData] = useState(null);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [selectedFileForDiff, setSelectedFileForDiff] = useState(null);

  // Full file view mode (when user clicks an arbitrary file in repo)
  const [viewingFullFile, setViewingFullFile] = useState(null);
  const [fullFileContent, setFullFileContent] = useState('');
  const [loadingFileContent, setLoadingFileContent] = useState(false);

  // UI display options
  const [diffLayout, setDiffLayout] = useState('unified'); // 'unified' | 'split'
  const [copiedPath, setCopiedPath] = useState(null);

  // 1. Initial Load: Repos, Commits, and Files
  useEffect(() => {
    (async () => {
      try {
        const [reposRes, commitsRes, filesRes] = await Promise.all([
          fetchWorkspaceRepos(),
          fetchWorkspaceCommits('fb_clone_repo'),
          fetchWorkspaceFiles('fb_clone_repo')
        ]);

        setRepos(reposRes || []);
        setCommits(commitsRes || []);
        setAllFiles(filesRes || []);

        if (commitsRes && commitsRes.length > 0) {
          // Default to latest commit
          const latest = commitsRes[0];
          setSelectedCommitHash(latest.hash);
          setTargetCommitHash(latest.hash);
          if (commitsRes.length > 1) {
            setBaseCommitHash(commitsRes[commitsRes.length - 1].hash);
          } else {
            setBaseCommitHash(latest.hash);
          }
        }
      } catch (err) {
        console.error('Failed to initialize RepoDiffView:', err);
      }
    })();
  }, []);

  // 2. Fetch Diff whenever selection changes
  useEffect(() => {
    if (!selectedCommitHash && !targetCommitHash) return;

    (async () => {
      setLoadingDiff(true);
      try {
        let res;
        if (compareMode === 'single') {
          res = await fetchWorkspaceDiff({
            repo: selectedRepo,
            target: selectedCommitHash,
            file: selectedFileForDiff
          });
        } else {
          res = await fetchWorkspaceDiff({
            repo: selectedRepo,
            base: baseCommitHash,
            target: targetCommitHash,
            file: selectedFileForDiff
          });
        }
        setDiffData(res);
      } catch (err) {
        console.error('Failed to load git diff:', err);
      } finally {
        setLoadingDiff(false);
      }
    })();
  }, [selectedRepo, compareMode, selectedCommitHash, baseCommitHash, targetCommitHash, selectedFileForDiff]);

  // Handle Full File Content Inspection
  const handleInspectFullFile = async (filePath) => {
    setViewingFullFile(filePath);
    setLoadingFileContent(true);
    try {
      const refToUse = compareMode === 'single' ? selectedCommitHash : targetCommitHash;
      const res = await fetchWorkspaceFileContent(selectedRepo, filePath, refToUse);
      setFullFileContent(res.content || '');
    } catch (err) {
      console.error('Failed to load full file content:', err);
      setFullFileContent('// Failed to read file content');
    } finally {
      setLoadingFileContent(false);
    }
  };

  const currentCommitObj = commits.find(c => c.hash === selectedCommitHash) || commits[0];
  const targetCommitObj = commits.find(c => c.hash === targetCommitHash);
  const baseCommitObj = commits.find(c => c.hash === baseCommitHash);

  const handleCopy = (text, path) => {
    navigator.clipboard.writeText(text);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  return (
    <div className="repo-diff-pane" style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 60px)',
      background: '#f6f8fa',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif'
    }}>
      {/* Top GitHub-style Navigation & Version Dropdown Toolbar */}
      <div style={{
        background: '#ffffff',
        borderBottom: '1px solid #d0d7de',
        padding: '12px 20px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}>
        {/* Left: Repo Info & Mode Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderGit2 size={20} style={{ color: '#0969da' }} />
            <strong style={{ fontSize: '1rem', color: '#1f2328' }}>
              workspace / {selectedRepo}
            </strong>
            <span style={{
              background: '#dafbe1',
              color: '#1a7f37',
              fontSize: '0.72rem',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <GitBranch size={12} />
              master
            </span>
          </div>

          <div style={{ height: '20px', width: '1px', background: '#d0d7de' }} />

          {/* Version Mode Switcher */}
          <div style={{ display: 'flex', background: '#f6f8fa', padding: '2px', borderRadius: '6px', border: '1px solid #d0d7de' }}>
            <button
              onClick={() => { setCompareMode('single'); setViewingFullFile(null); }}
              style={{
                border: 'none',
                background: compareMode === 'single' ? '#ffffff' : 'transparent',
                fontWeight: 600,
                fontSize: '0.78rem',
                color: compareMode === 'single' ? '#0969da' : '#656d76',
                padding: '4px 10px',
                borderRadius: '5px',
                cursor: 'pointer',
                boxShadow: compareMode === 'single' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
              }}
            >
              Commit Version
            </button>
            <button
              onClick={() => { setCompareMode('range'); setViewingFullFile(null); }}
              style={{
                border: 'none',
                background: compareMode === 'range' ? '#ffffff' : 'transparent',
                fontWeight: 600,
                fontSize: '0.78rem',
                color: compareMode === 'range' ? '#0969da' : '#656d76',
                padding: '4px 10px',
                borderRadius: '5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: compareMode === 'range' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
              }}
            >
              <GitCompare size={12} />
              Compare Versions
            </button>
          </div>
        </div>

        {/* Center: Version / Commit Dropdowns */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {compareMode === 'single' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#656d76' }}>
                Version:
              </span>
              <select
                value={selectedCommitHash}
                onChange={(e) => {
                  setSelectedCommitHash(e.target.value);
                  setViewingFullFile(null);
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid #d0d7de',
                  background: '#f6f8fa',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: '#1f2328',
                  outline: 'none',
                  cursor: 'pointer',
                  maxWidth: '420px'
                }}
              >
                {commits.map((c, idx) => (
                  <option key={c.hash} value={c.hash}>
                    v{commits.length - idx}: [{c.shortHash}] {c.message}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#656d76' }}>
                Base (From):
              </span>
              <select
                value={baseCommitHash}
                onChange={(e) => { setBaseCommitHash(e.target.value); setViewingFullFile(null); }}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #d0d7de',
                  background: '#f6f8fa',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  maxWidth: '220px',
                  outline: 'none'
                }}
              >
                {commits.map((c, idx) => (
                  <option key={`base-${c.hash}`} value={c.hash}>
                    v{commits.length - idx} [{c.shortHash}] {c.message.substring(0, 24)}...
                  </option>
                ))}
              </select>

              <span style={{ color: '#0969da', fontWeight: 700 }}>&rarr;</span>

              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#656d76' }}>
                Compare (To):
              </span>
              <select
                value={targetCommitHash}
                onChange={(e) => { setTargetCommitHash(e.target.value); setViewingFullFile(null); }}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #d0d7de',
                  background: '#f6f8fa',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  maxWidth: '220px',
                  outline: 'none'
                }}
              >
                {commits.map((c, idx) => (
                  <option key={`target-${c.hash}`} value={c.hash}>
                    v{commits.length - idx} [{c.shortHash}] {c.message.substring(0, 24)}...
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Unified vs Split Layout */}
          <div style={{ display: 'flex', background: '#f6f8fa', padding: '2px', borderRadius: '6px', border: '1px solid #d0d7de' }}>
            <button
              onClick={() => setDiffLayout('unified')}
              title="Unified diff format"
              style={{
                border: 'none',
                background: diffLayout === 'unified' ? '#ffffff' : 'transparent',
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                color: diffLayout === 'unified' ? '#0969da' : '#656d76'
              }}
            >
              <List size={14} />
            </button>
            <button
              onClick={() => setDiffLayout('split')}
              title="Split side-by-side diff"
              style={{
                border: 'none',
                background: diffLayout === 'split' ? '#ffffff' : 'transparent',
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                color: diffLayout === 'split' ? '#0969da' : '#656d76'
              }}
            >
              <Columns size={14} />
            </button>
          </div>
        </div>

        {/* Right: Live Preview link */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <a
            href="http://localhost:4000/workspace/preview"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#0969da',
              color: '#ffffff',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: 600,
              textDecoration: 'none'
            }}
          >
            <Play size={13} />
            Preview App
            <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* Commit Info Banner */}
      {currentCommitObj && (
        <div style={{
          background: '#ffffff',
          borderBottom: '1px solid #d0d7de',
          padding: '10px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.84rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <GitCommit size={16} style={{ color: '#0969da' }} />
            <span style={{ fontWeight: 600, color: '#1f2328' }}>
              {compareMode === 'single' ? currentCommitObj.message : `Comparing ${baseCommitObj?.shortHash} to ${targetCommitObj?.shortHash}`}
            </span>
            {currentCommitObj.linkedIssueKey && (
              <span style={{
                background: '#ddf4ff',
                color: '#0969da',
                fontWeight: 700,
                fontSize: '0.74rem',
                padding: '2px 8px',
                borderRadius: '4px'
              }}>
                Jira: {currentCommitObj.linkedIssueKey}
              </span>
            )}
            <span style={{ color: '#656d76', fontSize: '0.78rem' }}>
              by <strong>{currentCommitObj.author}</strong> on {currentCommitObj.date}
            </span>
          </div>

          {/* Diff stats (+ / -) */}
          {diffData?.summary && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 600 }}>
              <span style={{ color: '#656d76' }}>
                {diffData.summary.changedFiles} changed file{diffData.summary.changedFiles === 1 ? '' : 's'}
              </span>
              <span style={{ color: '#1a7f37', background: '#dafbe1', padding: '2px 6px', borderRadius: '4px' }}>
                +{diffData.summary.additions}
              </span>
              <span style={{ color: '#cf222e', background: '#ffebe9', padding: '2px 6px', borderRadius: '4px' }}>
                -{diffData.summary.deletions}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Main 2-Column Split Workspace */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Sidebar: Changed Files & Repo File Tree */}
        <div style={{
          width: '300px',
          borderRight: '1px solid #d0d7de',
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          height: '100%'
        }}>
          {/* Changed Files in this commit/version */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #d0d7de', background: '#f6f8fa' }}>
            <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#656d76', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Files Changed in Version ({diffData?.files?.length || 0})
            </div>
          </div>

          <div style={{ flex: '0 0 auto', maxHeight: '200px', overflowY: 'auto', borderBottom: '1px solid #d0d7de' }}>
            {diffData?.files?.length > 0 ? (
              diffData.files.map(file => {
                const isSelected = selectedFileForDiff === file.path;
                return (
                  <div
                    key={file.path}
                    onClick={() => {
                      setSelectedFileForDiff(file.path);
                      setViewingFullFile(null);
                    }}
                    style={{
                      padding: '8px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      background: isSelected && !viewingFullFile ? '#e7f3ff' : 'transparent',
                      borderLeft: isSelected && !viewingFullFile ? '3px solid #0969da' : '3px solid transparent',
                      transition: 'background 0.1s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      <FileCode size={14} style={{ color: '#0969da', flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, color: '#1f2328', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {file.path}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '4px', fontSize: '0.74rem', fontWeight: 700, flexShrink: 0 }}>
                      {file.additions > 0 && <span style={{ color: '#1a7f37' }}>+{file.additions}</span>}
                      {file.deletions > 0 && <span style={{ color: '#cf222e' }}>-{file.deletions}</span>}
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ padding: '12px 14px', fontSize: '0.78rem', color: '#656d76' }}>
                No code changes in this specific version or root commit.
              </div>
            )}
          </div>

          {/* All Workspace Repo Files */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #d0d7de', background: '#f6f8fa' }}>
            <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#656d76', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              All Workspace Files ({allFiles.length})
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {allFiles.map(file => {
              const isViewing = viewingFullFile === file.path;
              return (
                <div
                  key={file.path}
                  onClick={() => handleInspectFullFile(file.path)}
                  style={{
                    padding: '8px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    background: isViewing ? '#e7f3ff' : 'transparent',
                    borderLeft: isViewing ? '3px solid #0969da' : '3px solid transparent'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={14} style={{ color: '#656d76' }} />
                    <span style={{ color: isViewing ? '#0969da' : '#1f2328', fontWeight: isViewing ? 700 : 500 }}>
                      {file.path}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#8c959f' }}>
                    {(file.size / 1024).toFixed(1)} KB
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Code Area: GitHub Diff Viewer OR Full File Viewer */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 24px',
          background: '#f6f8fa'
        }}>
          {loadingDiff || loadingFileContent ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#656d76' }}>
              Loading git code diff...
            </div>
          ) : viewingFullFile ? (
            /* Full File Code View */
            <div style={{
              background: '#ffffff',
              border: '1px solid #d0d7de',
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}>
              <div style={{
                background: '#f6f8fa',
                borderBottom: '1px solid #d0d7de',
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileCode size={16} style={{ color: '#0969da' }} />
                  <strong style={{ fontSize: '0.88rem', color: '#1f2328' }}>
                    {viewingFullFile}
                  </strong>
                  <span style={{ fontSize: '0.75rem', color: '#656d76' }}>
                    (Full File at {compareMode === 'single' ? currentCommitObj?.shortHash : targetCommitObj?.shortHash})
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setViewingFullFile(null)}
                    style={{
                      border: '1px solid #d0d7de',
                      background: '#ffffff',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Back to Diff
                  </button>
                  <button
                    onClick={() => handleCopy(fullFileContent, viewingFullFile)}
                    style={{
                      border: '1px solid #d0d7de',
                      background: '#ffffff',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {copiedPath === viewingFullFile ? <Check size={12} /> : <Copy size={12} />}
                    {copiedPath === viewingFullFile ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Line numbered full file */}
              <div style={{
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                fontSize: '0.82rem',
                lineHeight: 1.5,
                overflowX: 'auto',
                background: '#ffffff'
              }}>
                {fullFileContent.split('\n').map((lineText, idx) => (
                  <div key={idx} style={{ display: 'flex', minWidth: 'fit-content' }}>
                    <div style={{
                      width: '48px',
                      padding: '0 8px',
                      textAlign: 'right',
                      userSelect: 'none',
                      color: '#8c959f',
                      background: '#f6f8fa',
                      borderRight: '1px solid #e1e4e8',
                      fontSize: '0.75rem',
                      flexShrink: 0
                    }}>
                      {idx + 1}
                    </div>
                    <div style={{ padding: '0 12px', whiteSpace: 'pre', color: '#1f2328' }}>
                      {lineText}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : diffData?.files && diffData.files.length > 0 ? (
            /* GitHub-Style Code Diff View */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {diffData.files.map(file => (
                <div
                  key={file.path}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #d0d7de',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
                  }}
                >
                  {/* GitHub File Header Bar */}
                  <div style={{
                    background: '#f6f8fa',
                    borderBottom: '1px solid #d0d7de',
                    padding: '8px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <FileCode size={16} style={{ color: '#0969da' }} />
                      <strong style={{ fontSize: '0.88rem', color: '#1f2328' }}>
                        {file.path}
                      </strong>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          background: '#dafbe1',
                          color: '#1a7f37',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '4px'
                        }}>
                          +{file.additions}
                        </span>
                        <span style={{
                          background: '#ffebe9',
                          color: '#cf222e',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '4px'
                        }}>
                          -{file.deletions}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleInspectFullFile(file.path)}
                        style={{
                          border: '1px solid #d0d7de',
                          background: '#ffffff',
                          borderRadius: '6px',
                          padding: '4px 10px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Eye size={12} />
                        View Full File
                      </button>
                    </div>
                  </div>

                  {/* Diff Lines Table (GitHub + / - formatting) */}
                  <div style={{
                    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                    fontSize: '0.82rem',
                    lineHeight: 1.5,
                    overflowX: 'auto'
                  }}>
                    {file.chunks.map((chunk, cIdx) => (
                      <div key={cIdx}>
                        {/* Chunk range header (@@ -1,7 +1,7 @@) */}
                        <div style={{
                          background: '#ddf4ff',
                          color: '#0969da',
                          padding: '4px 12px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          borderTop: cIdx > 0 ? '1px solid #d0d7de' : 'none',
                          borderBottom: '1px solid #b6e3ff',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <span>{chunk.header}</span>
                          {chunk.extra && <span style={{ color: '#57606a', fontWeight: 400 }}>{chunk.extra}</span>}
                        </div>

                        {/* Chunk lines */}
                        {chunk.lines.map((l, lIdx) => {
                          const isAdd = l.type === 'add';
                          const isDel = l.type === 'del';

                          const lineBg = isAdd
                            ? '#e6ffec'
                            : isDel
                            ? '#ffebe9'
                            : '#ffffff';

                          const numBg = isAdd
                            ? '#ccffd8'
                            : isDel
                            ? '#ffd7d5'
                            : '#f6f8fa';

                          const textColor = isAdd
                            ? '#1a7f37'
                            : isDel
                            ? '#cf222e'
                            : '#1f2328';

                          const signChar = isAdd ? '+' : isDel ? '-' : ' ';

                          return (
                            <div
                              key={lIdx}
                              style={{
                                display: 'flex',
                                background: lineBg,
                                minWidth: 'fit-content',
                                borderBottom: '1px solid rgba(0,0,0,0.02)'
                              }}
                            >
                              {/* Old Line Number */}
                              <div style={{
                                width: '42px',
                                padding: '0 6px',
                                textAlign: 'right',
                                userSelect: 'none',
                                color: '#8c959f',
                                background: numBg,
                                borderRight: '1px solid rgba(0,0,0,0.06)',
                                fontSize: '0.74rem',
                                flexShrink: 0
                              }}>
                                {l.oldLine || ''}
                              </div>

                              {/* New Line Number */}
                              <div style={{
                                width: '42px',
                                padding: '0 6px',
                                textAlign: 'right',
                                userSelect: 'none',
                                color: '#8c959f',
                                background: numBg,
                                borderRight: '1px solid rgba(0,0,0,0.06)',
                                fontSize: '0.74rem',
                                flexShrink: 0
                              }}>
                                {l.newLine || ''}
                              </div>

                              {/* + / - Marker Indicator */}
                              <div style={{
                                width: '20px',
                                textAlign: 'center',
                                userSelect: 'none',
                                fontWeight: 700,
                                color: textColor,
                                flexShrink: 0
                              }}>
                                {signChar}
                              </div>

                              {/* Code Text */}
                              <div style={{
                                padding: '0 8px',
                                whiteSpace: 'pre',
                                color: textColor,
                                flex: 1
                              }}>
                                {l.text}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              background: '#ffffff',
              border: '1px solid #d0d7de',
              borderRadius: '8px',
              padding: '40px',
              textAlign: 'center',
              color: '#656d76'
            }}>
              <Check size={28} style={{ color: '#1a7f37', marginBottom: '8px' }} />
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1f2328' }}>
                No differences detected between selected versions.
              </div>
              <p style={{ fontSize: '0.82rem', marginTop: '4px' }}>
                Select a different commit or version from the dropdown above to inspect code updates.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
