import React, { useState } from 'react';
import { BookOpen, Search, Plus, ExternalLink, Calendar, User, Tag, Sparkles } from 'lucide-react';

export default function KnowledgeBaseView({
  docs = [],
  issues = [],
  onSelectIssue,
  onCreateDoc
}) {
  const [selectedDocId, setSelectedDocId] = useState(docs[0]?.id || null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');

  const filteredDocs = docs.filter(doc => {
    const matchesSearch = 
      doc.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.key?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.summary?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.content?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'ALL' || doc.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const activeDoc = docs.find(d => d.id === selectedDocId) || filteredDocs[0];

  const categories = ['ALL', ...new Set(docs.map(d => d.category).filter(Boolean))];

  return (
    <div className="kb-container" style={{
      display: 'flex',
      height: 'calc(100vh - 60px)',
      background: '#f8fafc',
      overflow: 'hidden'
    }}>
      {/* Left Article Navigation List */}
      <div style={{
        width: '360px',
        borderRight: '1px solid #e2e8f0',
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        height: '100%'
      }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ background: '#ede9fe', padding: '6px', borderRadius: '8px', color: '#7c3aed' }}>
                <BookOpen size={18} />
              </div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>Knowledge Base</h2>
            </div>
            <span style={{ fontSize: '0.75rem', background: '#f1f5f9', padding: '2px 8px', borderRadius: '12px', color: '#64748b', fontWeight: 600 }}>
              {docs.length} Docs
            </span>
          </div>

          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search knowledge base..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px 8px 32px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', marginTop: '10px', paddingBottom: '2px' }}>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                style={{
                  border: 'none',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: filterCategory === cat ? '#0052cc' : '#f1f5f9',
                  color: filterCategory === cat ? '#ffffff' : '#64748b'
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Document list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {filteredDocs.map(doc => {
            const isSelected = activeDoc?.id === doc.id;
            return (
              <div
                key={doc.id}
                onClick={() => setSelectedDocId(doc.id)}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  marginBottom: '6px',
                  cursor: 'pointer',
                  background: isSelected ? '#eff6ff' : 'transparent',
                  border: `1px solid ${isSelected ? '#bfdbfe' : 'transparent'}`,
                  transition: 'background 0.15s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: '#7c3aed',
                    background: '#ede9fe',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}>
                    {doc.key}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                    {doc.category}
                  </span>
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#1e293b', marginBottom: '4px' }}>
                  {doc.title}
                </div>
                <div style={{
                  fontSize: '0.78rem',
                  color: '#64748b',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical'
                }}>
                  {doc.summary}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Article Viewer */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 48px', background: '#ffffff' }}>
        {activeDoc ? (
          <div style={{ maxWidth: '820px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{
                background: '#ede9fe',
                color: '#7c3aed',
                fontSize: '0.8rem',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '4px'
              }}>
                {activeDoc.key}
              </span>
              <span style={{
                background: '#e0f2fe',
                color: '#0369a1',
                fontSize: '0.8rem',
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: '4px'
              }}>
                {activeDoc.category}
              </span>
              <span style={{
                background: '#ecfdf5',
                color: '#047857',
                fontSize: '0.8rem',
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Sparkles size={13} />
                Synced to Neo4j Graph
              </span>
            </div>

            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', marginBottom: '12px', lineHeight: 1.3 }}>
              {activeDoc.title}
            </h1>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              fontSize: '0.82rem',
              color: '#64748b',
              paddingBottom: '16px',
              borderBottom: '1px solid #e2e8f0',
              marginBottom: '24px'
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <User size={14} /> {activeDoc.author || 'Auto-Jira Agent'}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Calendar size={14} /> Updated {new Date(activeDoc.updatedAt || Date.now()).toLocaleDateString()}
              </span>
            </div>

            {/* Linked Jira Issues Box */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '14px 18px',
              marginBottom: '24px'
            }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>
                LINKED JIRA TICKETS IN NEO4J GRAPH:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {issues.filter(i => {
                  if (activeDoc.key === 'KB-FB-01') return ['FB-101', 'FB-103'].includes(i.key);
                  if (activeDoc.key === 'KB-FB-02') return ['FB-101'].includes(i.key);
                  if (activeDoc.key === 'KB-FB-03') return ['FB-102'].includes(i.key);
                  if (activeDoc.key === 'KB-FB-04') return ['FB-103', 'FB-104'].includes(i.key);
                  return false;
                }).map(linked => (
                  <button
                    key={linked.id}
                    onClick={() => onSelectIssue(linked)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: '#0052cc',
                      cursor: 'pointer'
                    }}
                  >
                    <span>{linked.key}: {linked.title}</span>
                    <ExternalLink size={12} />
                  </button>
                ))}
              </div>
            </div>

            {/* Document Content */}
            <div style={{
              fontSize: '0.95rem',
              lineHeight: 1.7,
              color: '#334155',
              whiteSpace: 'pre-wrap',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
              {activeDoc.content}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
            Select an article from the left navigation.
          </div>
        )}
      </div>
    </div>
  );
}
