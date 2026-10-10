/**
 * Facebook Clone - Client Interactive Engine
 * Auto-Jira Integrated Workspace (FB-NEW)
 */

// Utility Helpers
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Normalizes raw ticket status payloads into canonical system status codes
 * @param {string} status 
 * @returns {string}
 */
function normalizeTicketStatus(status) {
  if (!status || typeof status !== 'string') return 'UNKNOWN';
  const cleaned = status.trim().toUpperCase().replace(/[-\s]+/g, '_');
  if (
    cleaned === 'REJECTED_NEEDS_INFO' ||
    cleaned === 'REJECTED_INSUFFICIENT_INFO' ||
    cleaned === 'REJECTED_NEED_INFO' ||
    cleaned === 'NEEDS_INFO'
  ) {
    return 'REJECTED_NEEDS_INFO';
  }
  return cleaned;
}

/**
 * Gets UI badge configuration for a ticket status
 * @param {string} status 
 * @returns {{ label: string, bg: string, color: string, badgeClass: string }}
 */
function getStatusBadgeConfig(status) {
  const canonical = normalizeTicketStatus(status);
  switch (canonical) {
    case 'REJECTED_NEEDS_INFO':
    case 'NEEDS_INFO':
      return { label: 'Needs Info', bg: 'var(--status-needs-info-bg)', color: 'var(--status-needs-info-text)', badgeClass: 'badge-needs-info' };
    case 'REJECTED':
      return { label: 'Rejected', bg: 'var(--status-rejected-bg)', color: 'var(--status-rejected-text)', badgeClass: 'badge-rejected' };
    case 'IN_PROGRESS':
      return { label: 'In Progress', bg: 'var(--status-in-progress-bg)', color: 'var(--status-in-progress-text)', badgeClass: 'badge-in-progress' };
    case 'IN_REVIEW':
      return { label: 'In Review', bg: 'var(--status-in-review-bg)', color: 'var(--status-in-review-text)', badgeClass: 'badge-in-review' };
    case 'DONE':
      return { label: 'Done', bg: 'var(--status-done-bg)', color: 'var(--status-done-text)', badgeClass: 'badge-done' };
    case 'TODO':
    default:
      return { label: status || 'To Do', bg: 'var(--status-todo-bg)', color: 'var(--status-todo-text)', badgeClass: 'badge-todo' };
  }
}

// Initial Mock Data
const mockTickets = [
  { id: 'FB-101', title: 'Fix Header Alignment', status: 'IN_PROGRESS', description: 'Ensure nav bar items are vertically centered across screen widths.' },
  { id: 'FB-102', title: 'Implement Dark Theme', status: 'DONE', description: 'Add CSS variables and dark mode switcher toggle in header.' },
  { id: 'FB-103', title: 'Audit DOM Structure', status: 'REJECTED_NEEDS_INFO', description: 'Validate semantic tags and defer script execution.' }
];

const mockPosts = [
  { id: 1, author: 'Auto-Jira Bot', time: '2 hrs ago', content: 'Baseline audit completed successfully. Workspace initialized.' }
];

document.addEventListener('DOMContentLoaded', () => {
  // Theme Switching Logic
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', newTheme);
    });
  }

  // Navigation Tab Switching
  const navTabs = document.querySelectorAll('.nav-tab');
  const tabViews = document.querySelectorAll('.tab-view');
  const sidebarLinks = document.querySelectorAll('.menu-item');

  function setActiveTab(tabName) {
    navTabs.forEach(tab => {
      if (tab.dataset.tab === tabName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    sidebarLinks.forEach(item => {
      if (item.dataset.tabLink === tabName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    tabViews.forEach(view => {
      if (view.id === `tab-${tabName}`) {
        view.classList.add('active');
      } else {
        view.classList.remove('active');
      }
    });
  }

  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      if (tab.dataset.tab) {
        setActiveTab(tab.dataset.tab);
      }
    });
  });

  sidebarLinks.forEach(item => {
    item.addEventListener('click', () => {
      if (item.dataset.tabLink) {
        setActiveTab(item.dataset.tabLink);
      }
    });
  });

  // Render Functions
  function renderPosts() {
    const postsFeed = document.getElementById('posts-feed');
    if (!postsFeed) return;

    postsFeed.innerHTML = mockPosts.map(post => `
      <div class="post-card">
        <div class="create-post-top">
          <div class="user-avatar">${escapeHTML(post.author.charAt(0))}</div>
          <div>
            <strong>${escapeHTML(post.author)}</strong>
            <div style="font-size: 12px; color: var(--fb-text-muted);">${escapeHTML(post.time)}</div>
          </div>
        </div>
        <p style="margin-top: 12px;">${escapeHTML(post.content)}</p>
      </div>
    `).join('');
  }

  function renderTickets(filterStatus = 'ALL') {
    const ticketsFeed = document.getElementById('tickets-feed');
    if (!ticketsFeed) return;

    const filtered = mockTickets.filter(t => {
      if (filterStatus === 'ALL') return true;
      return normalizeTicketStatus(t.status) === normalizeTicketStatus(filterStatus);
    });

    ticketsFeed.innerHTML = filtered.map(ticket => {
      const badgeConfig = getStatusBadgeConfig(ticket.status);
      return `
        <div class="ticket-card">
          <div class="ticket-header-row">
            <span class="ticket-id">${escapeHTML(ticket.id)}</span>
            <span class="status-badge ${escapeHTML(badgeConfig.badgeClass)}" style="background-color: ${badgeConfig.bg}; color: ${badgeConfig.color};">
              ${escapeHTML(badgeConfig.label)}
            </span>
          </div>
          <h3 class="ticket-title">${escapeHTML(ticket.title)}</h3>
          <p class="ticket-desc">${escapeHTML(ticket.description)}</p>
        </div>
      `;
    }).join('');
  }

  // Create Post
  const submitPostBtn = document.getElementById('submit-post-btn');
  const postInput = document.getElementById('post-input');
  if (submitPostBtn && postInput) {
    submitPostBtn.addEventListener('click', () => {
      const val = postInput.value.trim();
      if (val) {
        mockPosts.unshift({
          id: Date.now(),
          author: 'Developer',
          time: 'Just now',
          content: val
        });
        postInput.value = '';
        renderPosts();
      }
    });
  }

  // Ticket Status Filter
  const statusFilter = document.getElementById('status-filter');
  if (statusFilter) {
    statusFilter.addEventListener('change', (e) => {
      renderTickets(e.target.value);
    });
  }

  // Search Filter
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      const ticketCards = document.querySelectorAll('.ticket-card');
      ticketCards.forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(q) ? 'block' : 'none';
      });
    });
  }

  // Initial Rendering
  renderPosts();
  renderTickets();
});
