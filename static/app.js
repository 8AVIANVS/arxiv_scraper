/**
 * arXiv Paper Explorer - Frontend Application
 * Handles all client-side interactivity for the paper explorer interface.
 */

// ===== State Management =====
const state = {
    currentView: 'papers',
    papers: [],
    currentPage: 1,
    totalPages: 1,
    perPage: 20,
    filters: {
        search: '',
        category: '',
        minScore: null,
        maxScore: null,
        sortBy: 'created',
        sortOrder: 'desc'
    },
    stats: null,
    categories: [],
    taskPollingInterval: null
};

// ===== DOM Elements =====
const elements = {
    // Navigation
    navItems: document.querySelectorAll('.nav-item'),
    views: document.querySelectorAll('.view'),

    // Papers View
    papersGrid: document.getElementById('papersGrid'),
    loadingIndicator: document.getElementById('loadingIndicator'),
    emptyState: document.getElementById('emptyState'),
    pagination: document.getElementById('pagination'),
    prevPage: document.getElementById('prevPage'),
    nextPage: document.getElementById('nextPage'),
    currentPage: document.getElementById('currentPage'),
    totalPages: document.getElementById('totalPages'),

    // Filters
    searchInput: document.getElementById('searchInput'),
    categoryFilter: document.getElementById('categoryFilter'),
    sortFilter: document.getElementById('sortFilter'),
    minScore: document.getElementById('minScore'),
    maxScore: document.getElementById('maxScore'),

    // Dashboard
    totalPapers: document.getElementById('totalPapers'),
    evaluatedPapers: document.getElementById('evaluatedPapers'),
    avgScore: document.getElementById('avgScore'),
    lastScrape: document.getElementById('lastScrape'),
    scoreBarChart: document.getElementById('scoreBarChart'),
    categoryList: document.getElementById('categoryList'),
    topPapers: document.getElementById('topPapers'),

    // Actions
    runScraper: document.getElementById('runScraper'),
    runEvaluator: document.getElementById('runEvaluator'),
    evalRows: document.getElementById('evalRows'),
    scraperStatus: document.getElementById('scraperStatus'),
    evaluatorStatus: document.getElementById('evaluatorStatus'),

    // Modal
    modal: document.getElementById('paperModal'),
    modalBody: document.getElementById('modalBody'),
    closeModal: document.getElementById('closeModal'),

    // Status
    statusDot: document.getElementById('statusDot'),
    statusText: document.getElementById('statusText')
};

// ===== API Functions =====
async function fetchPapers() {
    const params = new URLSearchParams({
        page: state.currentPage,
        per_page: state.perPage,
        sort_by: state.filters.sortBy,
        sort_order: state.filters.sortOrder
    });

    if (state.filters.search) params.append('search', state.filters.search);
    if (state.filters.category) params.append('category', state.filters.category);
    if (state.filters.minScore !== null) params.append('min_score', state.filters.minScore);
    if (state.filters.maxScore !== null) params.append('max_score', state.filters.maxScore);

    try {
        const response = await fetch(`/api/papers?${params}`);
        if (!response.ok) throw new Error('Failed to fetch papers');
        return await response.json();
    } catch (error) {
        console.error('Error fetching papers:', error);
        return { papers: [], total: 0, page: 1, per_page: 20, total_pages: 0 };
    }
}

async function fetchStats() {
    try {
        const response = await fetch('/api/stats');
        if (!response.ok) throw new Error('Failed to fetch stats');
        return await response.json();
    } catch (error) {
        console.error('Error fetching stats:', error);
        return null;
    }
}

async function fetchCategories() {
    try {
        const response = await fetch('/api/categories');
        if (!response.ok) throw new Error('Failed to fetch categories');
        const data = await response.json();
        return data.categories || [];
    } catch (error) {
        console.error('Error fetching categories:', error);
        return [];
    }
}

async function fetchTaskStatus() {
    try {
        const response = await fetch('/api/task-status');
        if (!response.ok) throw new Error('Failed to fetch task status');
        return await response.json();
    } catch (error) {
        console.error('Error fetching task status:', error);
        return { scraper: null, evaluator: null };
    }
}

async function triggerScraper() {
    try {
        const response = await fetch('/api/scrape', { method: 'POST' });
        if (!response.ok) throw new Error('Failed to trigger scraper');
        return await response.json();
    } catch (error) {
        console.error('Error triggering scraper:', error);
        return { status: 'error', message: error.message };
    }
}

async function triggerEvaluator(numRows) {
    try {
        const response = await fetch(`/api/evaluate?num_rows=${numRows}`, { method: 'POST' });
        if (!response.ok) throw new Error('Failed to trigger evaluator');
        return await response.json();
    } catch (error) {
        console.error('Error triggering evaluator:', error);
        return { status: 'error', message: error.message };
    }
}

// ===== Render Functions =====
function renderPapers(papers) {
    if (!papers || papers.length === 0) {
        elements.papersGrid.innerHTML = '';
        elements.emptyState.classList.remove('hidden');
        elements.pagination.classList.add('hidden');
        return;
    }

    elements.emptyState.classList.add('hidden');
    elements.pagination.classList.remove('hidden');

    elements.papersGrid.innerHTML = papers.map(paper => {
        const scoreClass = getScoreClass(paper.score);
        const scoreDisplay = paper.score ? paper.score.toFixed(1) : 'N/A';
        const categories = paper.categories ? paper.categories.split(' ').slice(0, 3) : [];
        const dateDisplay = formatDate(paper.created);

        return `
            <div class="paper-card" data-paper-id="${paper.id}" onclick="showPaperDetail('${paper.id}')">
                <div class="paper-header">
                    <h3 class="paper-title">${escapeHtml(paper.title)}</h3>
                    <div class="paper-score ${scoreClass}">${scoreDisplay}</div>
                </div>
                <div class="paper-meta">
                    ${categories.map(cat => `<span class="paper-category">${escapeHtml(cat)}</span>`).join('')}
                </div>
                <p class="paper-abstract">${escapeHtml(paper.abstract || '')}</p>
                <div class="paper-footer">
                    <span class="paper-authors">${escapeHtml(truncateAuthors(paper.authors))}</span>
                    <span class="paper-date">${dateDisplay}</span>
                </div>
            </div>
        `;
    }).join('');
}

function renderPagination(page, totalPages) {
    state.currentPage = page;
    state.totalPages = totalPages;

    elements.currentPage.textContent = page;
    elements.totalPages.textContent = totalPages;

    elements.prevPage.disabled = page <= 1;
    elements.nextPage.disabled = page >= totalPages;
}

function renderCategories(categories) {
    elements.categoryFilter.innerHTML = '<option value="">All Categories</option>';

    // Get unique main categories
    const mainCategories = [...new Set(categories.map(cat => cat.split('.')[0]))].sort();

    mainCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat.toUpperCase();
        elements.categoryFilter.appendChild(option);
    });
}

function renderStats(stats) {
    if (!stats) return;

    elements.totalPapers.textContent = stats.total_papers.toLocaleString();
    elements.evaluatedPapers.textContent = stats.evaluated_papers.toLocaleString();
    elements.avgScore.textContent = stats.average_score ? stats.average_score.toFixed(1) : '-';
    elements.lastScrape.textContent = stats.last_scrape || '-';

    renderScoreChart(stats.score_distribution);
    renderCategoryList(stats.categories);
}

function renderScoreChart(distribution) {
    if (!distribution || Object.keys(distribution).length === 0) {
        elements.scoreBarChart.innerHTML = '<p style="color: var(--text-muted); text-align: center;">No evaluation data available</p>';
        return;
    }

    const maxCount = Math.max(...Object.values(distribution), 1);

    elements.scoreBarChart.innerHTML = Object.entries(distribution)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([score, count]) => {
            const height = (count / maxCount) * 150;
            return `
                <div class="bar-item">
                    <span class="bar-value">${count}</span>
                    <div class="bar" style="height: ${height}px"></div>
                    <span class="bar-label">${score}</span>
                </div>
            `;
        }).join('');
}

function renderCategoryList(categories) {
    if (!categories || Object.keys(categories).length === 0) {
        elements.categoryList.innerHTML = '<p style="color: var(--text-muted);">No category data available</p>';
        return;
    }

    const sortedCategories = Object.entries(categories)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);

    elements.categoryList.innerHTML = sortedCategories
        .map(([name, count]) => `
            <div class="category-item">
                <span class="category-name">${escapeHtml(name.toUpperCase())}</span>
                <span class="category-count">${count.toLocaleString()}</span>
            </div>
        `).join('');
}

async function renderTopPapers() {
    const params = new URLSearchParams({
        page: 1,
        per_page: 5,
        sort_by: 'score',
        sort_order: 'desc',
        min_score: 1
    });

    try {
        const response = await fetch(`/api/papers?${params}`);
        if (!response.ok) throw new Error('Failed to fetch top papers');
        const data = await response.json();

        if (!data.papers || data.papers.length === 0) {
            elements.topPapers.innerHTML = '<p style="color: var(--text-muted);">No evaluated papers available</p>';
            return;
        }

        elements.topPapers.innerHTML = data.papers.map((paper, index) => `
            <div class="top-paper-item" onclick="showPaperDetail('${paper.id}')">
                <div class="top-paper-rank">${index + 1}</div>
                <div class="top-paper-info">
                    <div class="top-paper-title">${escapeHtml(paper.title)}</div>
                    <div class="top-paper-meta">${paper.categories ? paper.categories.split(' ')[0] : ''}</div>
                </div>
                <div class="top-paper-score">${paper.score ? paper.score.toFixed(1) : '-'}</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error fetching top papers:', error);
        elements.topPapers.innerHTML = '<p style="color: var(--text-muted);">Failed to load top papers</p>';
    }
}

function renderPaperModal(paper) {
    const scoreClass = getScoreClass(paper.score);
    const categories = paper.categories ? paper.categories.split(' ') : [];

    elements.modalBody.innerHTML = `
        <div class="modal-header">
            <h2 class="modal-title">${escapeHtml(paper.title)}</h2>
            <div class="modal-meta">
                ${categories.map(cat => `<span class="paper-category">${escapeHtml(cat)}</span>`).join('')}
            </div>
        </div>

        ${paper.score ? `
            <div class="modal-score-section">
                <div class="modal-score-header">
                    <div class="paper-score ${scoreClass}" style="width: 60px; height: 60px; font-size: 1.5rem;">
                        ${paper.score.toFixed(1)}
                    </div>
                    <div>
                        <div class="modal-score-label">Startup Viability Score</div>
                    </div>
                </div>
                ${paper.reasoning ? `<p class="modal-reasoning">"${escapeHtml(paper.reasoning)}"</p>` : ''}
            </div>
        ` : ''}

        <div class="modal-section">
            <h4>Abstract</h4>
            <p class="modal-abstract">${escapeHtml(paper.abstract || 'No abstract available')}</p>
        </div>

        <div class="modal-section">
            <h4>Authors</h4>
            <p class="modal-authors">${escapeHtml(paper.authors || 'Unknown')}</p>
        </div>

        <div class="modal-section">
            <h4>Details</h4>
            <p class="modal-authors">
                <strong>arXiv ID:</strong> ${escapeHtml(paper.id)}<br>
                <strong>Created:</strong> ${formatDate(paper.created)}<br>
                ${paper.updated ? `<strong>Updated:</strong> ${formatDate(paper.updated)}<br>` : ''}
                ${paper.doi ? `<strong>DOI:</strong> ${escapeHtml(paper.doi)}` : ''}
            </p>
        </div>

        <div class="modal-section">
            <h4>Links</h4>
            <div class="modal-links">
                <a href="https://arxiv.org/abs/${paper.id}" target="_blank" rel="noopener" class="modal-link">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                        <polyline points="15 3 21 3 21 9"/>
                        <line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                    View on arXiv
                </a>
                <a href="https://arxiv.org/pdf/${paper.id}.pdf" target="_blank" rel="noopener" class="modal-link">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                    Download PDF
                </a>
            </div>
        </div>
    `;
}

// ===== Helper Functions =====
function getScoreClass(score) {
    if (!score || score === 0) return 'none';
    if (score >= 7) return 'high';
    if (score >= 4) return 'medium';
    return 'low';
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function truncateAuthors(authors) {
    if (!authors) return 'Unknown';
    const authorList = authors.split(',');
    if (authorList.length <= 3) return authors;
    return authorList.slice(0, 3).join(', ') + ` +${authorList.length - 3} more`;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch {
        return dateStr;
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ===== View Management =====
function switchView(viewName) {
    state.currentView = viewName;

    elements.navItems.forEach(item => {
        item.classList.toggle('active', item.dataset.view === viewName);
    });

    elements.views.forEach(view => {
        view.classList.toggle('active', view.id === `${viewName}View`);
    });

    // Load view-specific data
    if (viewName === 'papers') {
        loadPapers();
    } else if (viewName === 'dashboard') {
        loadDashboard();
    } else if (viewName === 'actions') {
        updateTaskStatus();
    }
}

// ===== Data Loading =====
async function loadPapers() {
    elements.loadingIndicator.classList.remove('hidden');
    elements.papersGrid.innerHTML = '';

    const data = await fetchPapers();

    elements.loadingIndicator.classList.add('hidden');

    state.papers = data.papers;
    renderPapers(data.papers);
    renderPagination(data.page, data.total_pages);
}

async function loadDashboard() {
    const stats = await fetchStats();
    state.stats = stats;
    renderStats(stats);
    await renderTopPapers();
}

async function loadCategories() {
    const categories = await fetchCategories();
    state.categories = categories;
    renderCategories(categories);
}

// ===== Paper Detail =====
async function showPaperDetail(paperId) {
    try {
        const response = await fetch(`/api/paper/${paperId}`);
        if (!response.ok) throw new Error('Failed to fetch paper');
        const paper = await response.json();

        renderPaperModal(paper);
        elements.modal.classList.add('active');
    } catch (error) {
        console.error('Error fetching paper detail:', error);
    }
}

// Make showPaperDetail available globally
window.showPaperDetail = showPaperDetail;

function closeModal() {
    elements.modal.classList.remove('active');
}

// ===== Task Management =====
async function updateTaskStatus() {
    const status = await fetchTaskStatus();

    // Update scraper status
    if (status.scraper) {
        elements.scraperStatus.textContent = status.scraper;
        elements.scraperStatus.className = 'action-status ' + getStatusClass(status.scraper);
        elements.runScraper.disabled = status.scraper === 'running';
    } else {
        elements.scraperStatus.textContent = '';
        elements.runScraper.disabled = false;
    }

    // Update evaluator status
    if (status.evaluator) {
        elements.evaluatorStatus.textContent = status.evaluator;
        elements.evaluatorStatus.className = 'action-status ' + getStatusClass(status.evaluator);
        elements.runEvaluator.disabled = status.evaluator === 'running';
    } else {
        elements.evaluatorStatus.textContent = '';
        elements.runEvaluator.disabled = false;
    }

    // Update global status indicator
    const isRunning = status.scraper === 'running' || status.evaluator === 'running';
    elements.statusDot.className = 'status-dot' + (isRunning ? ' warning' : '');
    elements.statusText.textContent = isRunning ? 'Running...' : 'Ready';

    return status;
}

function getStatusClass(status) {
    if (status === 'running') return 'running';
    if (status === 'completed') return 'completed';
    if (status && status.startsWith('failed')) return 'error';
    if (status && status.startsWith('error')) return 'error';
    return '';
}

function startTaskPolling() {
    if (state.taskPollingInterval) return;

    state.taskPollingInterval = setInterval(async () => {
        const status = await updateTaskStatus();

        // Stop polling if no tasks are running
        if (status.scraper !== 'running' && status.evaluator !== 'running') {
            stopTaskPolling();

            // Reload data if tasks completed
            if (state.currentView === 'papers') {
                loadPapers();
            } else if (state.currentView === 'dashboard') {
                loadDashboard();
            }
        }
    }, 2000);
}

function stopTaskPolling() {
    if (state.taskPollingInterval) {
        clearInterval(state.taskPollingInterval);
        state.taskPollingInterval = null;
    }
}

// ===== Event Listeners =====
function initEventListeners() {
    // Navigation
    elements.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            switchView(item.dataset.view);
        });
    });

    // Search with debounce
    const debouncedSearch = debounce(() => {
        state.filters.search = elements.searchInput.value;
        state.currentPage = 1;
        loadPapers();
    }, 300);

    elements.searchInput.addEventListener('input', debouncedSearch);

    // Category filter
    elements.categoryFilter.addEventListener('change', () => {
        state.filters.category = elements.categoryFilter.value;
        state.currentPage = 1;
        loadPapers();
    });

    // Sort filter
    elements.sortFilter.addEventListener('change', () => {
        const [sortBy, sortOrder] = elements.sortFilter.value.split('-');
        state.filters.sortBy = sortBy;
        state.filters.sortOrder = sortOrder;
        state.currentPage = 1;
        loadPapers();
    });

    // Score filters with debounce
    const debouncedScoreFilter = debounce(() => {
        state.filters.minScore = elements.minScore.value ? parseFloat(elements.minScore.value) : null;
        state.filters.maxScore = elements.maxScore.value ? parseFloat(elements.maxScore.value) : null;
        state.currentPage = 1;
        loadPapers();
    }, 500);

    elements.minScore.addEventListener('input', debouncedScoreFilter);
    elements.maxScore.addEventListener('input', debouncedScoreFilter);

    // Pagination
    elements.prevPage.addEventListener('click', () => {
        if (state.currentPage > 1) {
            state.currentPage--;
            loadPapers();
        }
    });

    elements.nextPage.addEventListener('click', () => {
        if (state.currentPage < state.totalPages) {
            state.currentPage++;
            loadPapers();
        }
    });

    // Modal
    elements.closeModal.addEventListener('click', closeModal);
    elements.modal.addEventListener('click', (e) => {
        if (e.target === elements.modal) closeModal();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && elements.modal.classList.contains('active')) {
            closeModal();
        }
    });

    // Actions
    elements.runScraper.addEventListener('click', async () => {
        const result = await triggerScraper();
        elements.scraperStatus.textContent = result.message;
        elements.scraperStatus.className = 'action-status ' + (result.status === 'started' ? 'running' : 'error');

        if (result.status === 'started') {
            elements.runScraper.disabled = true;
            startTaskPolling();
        }
    });

    elements.runEvaluator.addEventListener('click', async () => {
        const numRows = parseInt(elements.evalRows.value) || 10;
        const result = await triggerEvaluator(numRows);
        elements.evaluatorStatus.textContent = result.message;
        elements.evaluatorStatus.className = 'action-status ' + (result.status === 'started' ? 'running' : 'error');

        if (result.status === 'started') {
            elements.runEvaluator.disabled = true;
            startTaskPolling();
        }
    });
}

// ===== Initialization =====
async function init() {
    initEventListeners();
    await loadCategories();
    await loadPapers();

    // Initial status check
    const status = await fetchTaskStatus();
    if (status.scraper === 'running' || status.evaluator === 'running') {
        startTaskPolling();
    }
}

// Start the application
document.addEventListener('DOMContentLoaded', init);
