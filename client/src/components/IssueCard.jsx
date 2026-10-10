import React from 'react';
import { 
  Bookmark, 
  CheckSquare, 
  AlertCircle, 
  Zap, 
  ArrowUp, 
  ArrowDown, 
  Minus, 
  Link2,
  Trash2,
  MoreHorizontal
} from 'lucide-react';

const TYPE_ICONS = {
  Story: <Bookmark size={14} className="type-icon story" />,
  Task: <CheckSquare size={14} className="type-icon task" />,
  Bug: <AlertCircle size={14} className="type-icon bug" />,
  Epic: <Zap size={14} className="type-icon epic" />
};

const PRIORITY_ICONS = {
  HIGHEST: <ArrowUp size={13} style={{ color: 'var(--prio-highest)' }} />,
  HIGH: <ArrowUp size={13} style={{ color: 'var(--prio-high)' }} />,
  MEDIUM: <Minus size={13} style={{ color: 'var(--prio-medium)' }} />,
  LOW: <ArrowDown size={13} style={{ color: 'var(--prio-low)' }} />,
  LOWEST: <ArrowDown size={13} style={{ color: 'var(--prio-lowest)' }} />
};

export default function IssueCard({
  issue,
  connections = [],
  onSelectIssue,
  onDeleteIssue,
  onOpenQuickConnect,
  onDragStart
}) {
  // Connections related to this issue (both outgoing and incoming)
  const outgoingRels = connections.filter(c => c.sourceId === issue.id);
  const incomingRels = connections.filter(c => c.targetId === issue.id);

  const getInitials = (name) => {
    if (!name) return 'UN';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <div
      className="issue-card"
      id={`card-${issue.id}`}
      draggable
      onDragStart={(e) => onDragStart(e, issue.id)}
    >
      <div className="card-top">
        <div className="card-key-group">
          {TYPE_ICONS[issue.type] || TYPE_ICONS.Task}
          <span className="issue-key">{issue.key}</span>
        </div>

        <div className="card-actions-mini">
          <button
            className="btn-icon-subtle"
            style={{ padding: '3px' }}
            title="Connect / Link this node"
            onClick={(e) => {
              e.stopPropagation();
              onOpenQuickConnect(issue.id);
            }}
            id={`btn-link-${issue.id}`}
          >
            <Link2 size={13} />
          </button>
          <button
            className="btn-icon-subtle"
            style={{ padding: '3px', color: '#94a3b8' }}
            title="Delete issue node"
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm(`Delete ${issue.key} from Neo4j graph?`)) {
                onDeleteIssue(issue.id);
              }
            }}
            id={`btn-del-${issue.id}`}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div 
        className="card-title" 
        onClick={() => onSelectIssue(issue)}
        id={`title-${issue.id}`}
      >
        {issue.title}
      </div>

      {issue.description && (
        <div className="card-description-preview">
          {issue.description}
        </div>
      )}

      {/* Graph Connections Badges */}
      {(outgoingRels.length > 0 || incomingRels.length > 0) && (
        <div className="card-connections">
          {outgoingRels.map((rel, idx) => {
            const typeClass = rel.type.toLowerCase();
            return (
              <span
                key={`out-${idx}`}
                className={`rel-badge ${typeClass}`}
                title={`[Out] ${issue.key} ${rel.type} ${rel.targetKey || rel.targetId}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectIssue(issue, 'connections');
                }}
              >
                <span>&rarr; {rel.type}</span>
                <strong>{rel.targetKey || rel.targetId}</strong>
              </span>
            );
          })}
          {incomingRels.map((rel, idx) => {
            const typeClass = rel.type.toLowerCase();
            return (
              <span
                key={`in-${idx}`}
                className={`rel-badge ${typeClass}`}
                style={{ opacity: 0.85 }}
                title={`[In] ${rel.sourceKey || rel.sourceId} ${rel.type} ${issue.key}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectIssue(issue, 'connections');
                }}
              >
                <span>&larr;</span>
                <span>{rel.sourceKey || rel.sourceId}</span>
              </span>
            );
          })}
        </div>
      )}

      <div className="card-footer">
        <div className="footer-left">
          <div className="priority-pill" title={`Priority: ${issue.priority}`}>
            {PRIORITY_ICONS[issue.priority] || PRIORITY_ICONS.MEDIUM}
          </div>
          {issue.storyPoints > 0 && (
            <span className="points-pill">{issue.storyPoints} pts</span>
          )}
        </div>

        <div
          className="avatar-chip"
          title={`Assignee: ${issue.assignee}`}
          data-assignee={issue.assignee}
        >
          {getInitials(issue.assignee)}
        </div>
      </div>
    </div>
  );
}
