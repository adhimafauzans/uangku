import './style.css';

// --- CONFIGURATION & CONSTANTS ---
const CATEGORIES = {
  expense: [
    { id: 'makanan', name: 'Makanan', emoji: '🍔', color: '#ff5a5f' },
    { id: 'transportasi', name: 'Transportasi', emoji: '🚗', color: '#3b82f6' },
    { id: 'tagihan', name: 'Tagihan', emoji: '🔌', color: '#fbbf24' },
    { id: 'belanja', name: 'Belanja', emoji: '🛍️', color: '#a855f7' },
    { id: 'hiburan', name: 'Hiburan', emoji: '🍿', color: '#ec4899' },
    { id: 'lainnya', name: 'Lainnya', emoji: '📦', color: '#14b8a6' }
  ],
  income: [
    { id: 'gaji', name: 'Gaji', emoji: '💵', color: '#10b981' },
    { id: 'investasi', name: 'Investasi', emoji: '📈', color: '#06b6d4' },
    { id: 'bonus', name: 'Bonus', emoji: '🎁', color: '#f59e0b' },
    { id: 'lainnya', name: 'Lainnya', emoji: '💰', color: '#8b5cf6' }
  ]
};

const DEFAULT_BUDGETS = {
  makanan: 2000000,
  transportasi: 1000000,
  tagihan: 3000000,
  belanja: 1500000,
  hiburan: 1000000,
  lainnya: 1000000
};

const DEFAULT_SETTINGS = {
  defaultIncome: 10000000,
  theme: 'light',
  currency: 'Rp'
};

// --- APPLICATION STATE ---
let state = {
  transactions: [],
  budgets: { ...DEFAULT_BUDGETS },
  settings: { ...DEFAULT_SETTINGS }
};

let auth = {
  token: localStorage.getItem('uangku_auth_token') || '',
  username: localStorage.getItem('uangku_auth_username') || ''
};

// Track month and active view
let currentActiveDate = new Date();
let currentActiveView = 'dashboard';
let currentTransactionType = 'expense';
let selectedCategory = '';
let authMode = 'login'; // 'login' or 'register'

// --- HELPER FUNCTIONS ---

// Format number to Rupiah string
function formatRupiah(value) {
  const num = parseInt(value, 10);
  if (isNaN(num)) return 'Rp 0';
  return 'Rp ' + num.toLocaleString('id-ID');
}

// Convert input text to raw integer
function parseRawNumber(str) {
  const clean = str.replace(/[^0-9]/g, '');
  return clean ? parseInt(clean, 10) : 0;
}

// Format input element value as user types
function handleNumericInputFormat(inputEl) {
  let val = inputEl.value.replace(/[^0-9]/g, '');
  if (val) {
    inputEl.value = parseInt(val, 10).toLocaleString('id-ID');
  } else {
    inputEl.value = '';
  }
}

// Get Month Name in Indonesian
function getIndonesianMonthYear(date) {
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

// Toast Notifications
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = type === 'success' 
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

  toast.innerHTML = `${icon} <span>${message}</span>`;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Loading overlay control
function showLoading(show = true) {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    if (show) overlay.classList.remove('hidden');
    else overlay.classList.add('hidden');
  }
}

// Custom Dialog Confirm Modal
function showConfirmDialog(title, message, onConfirm) {
  const overlay = document.getElementById('confirm-dialog');
  const titleEl = document.getElementById('confirm-title');
  const msgEl = document.getElementById('confirm-message');
  const okBtn = document.getElementById('confirm-ok-btn');
  const cancelBtn = document.getElementById('confirm-cancel-btn');
  
  titleEl.textContent = title;
  msgEl.textContent = message;
  overlay.classList.add('open');
  
  const cleanUp = () => {
    overlay.classList.remove('open');
    okBtn.replaceWith(okBtn.cloneNode(true));
    cancelBtn.replaceWith(cancelBtn.cloneNode(true));
  };
  
  document.getElementById('confirm-cancel-btn').addEventListener('click', cleanUp);
  document.getElementById('confirm-ok-btn').addEventListener('click', () => {
    onConfirm();
    cleanUp();
  });
}

// --- API COMMUNICATIONS ---

async function apiRequest(endpoint, options = {}) {
  // Determine API base URL dynamically for Capacitor native platform
  const isNative = !!(
    (window.Capacitor && window.Capacitor.platform) ||
    window.location.origin.startsWith('capacitor://') ||
    (window.location.origin.startsWith('http://localhost') && !window.location.port) ||
    window.location.origin.startsWith('file://')
  );
  
  const baseUrl = isNative ? 'https://sisa-uangku.vercel.app' : '';
  const targetUrl = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;

  // Set auth headers
  options.headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (auth.token) {
    options.headers['Authorization'] = `Bearer ${auth.token}`;
  }

  showLoading(true);
  try {
    const res = await fetch(targetUrl, options);
    
    // Auth failures handling (except for login/register endpoints)
    if ((res.status === 401 || res.status === 403) && !endpoint.includes('/api/auth/')) {
      handleSessionTimeout();
      throw new Error('Sesi masuk kedaluwarsa');
    }
    
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Terjadi kesalahan sistem');
    }
    return data;
  } catch (error) {
    showToast(error.message, 'error');
    throw error;
  } finally {
    showLoading(false);
  }
}

function handleSessionTimeout() {
  localStorage.removeItem('uangku_auth_token');
  localStorage.removeItem('uangku_auth_username');
  auth.token = '';
  auth.username = '';
  
  const authScreen = document.getElementById('auth-screen');
  authScreen.classList.remove('hidden');
  showToast('Sesi Anda berakhir. Silakan masuk kembali.', 'error');
}

// --- STATE MANAGEMENT ---

// Load data from Backend API
async function loadStateFromServer() {
  if (!auth.token) return;
  
  try {
    const [transactions, budgets, settings] = await Promise.all([
      apiRequest('/api/transactions'),
      apiRequest('/api/budgets'),
      apiRequest('/api/settings')
    ]);
    
    state.transactions = transactions || [];
    state.budgets = { ...DEFAULT_BUDGETS, ...budgets };
    state.settings = { ...DEFAULT_SETTINGS, ...settings };
    

    
    applyTheme(state.settings.theme || 'dark');
    document.getElementById('current-user-display').textContent = auth.username;
    
  } catch (e) {
    console.error('Failed loading data from server', e);
  }
}



// Theme applier
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  state.settings.theme = theme;
}

// --- RENDER LOGIC ---

// Render Dashboard View
function renderDashboard() {
  const currentMonthTransactions = getTransactionsForCurrentMonth();
  
  let totalIncome = 0;
  let totalExpense = 0;
  
  currentMonthTransactions.forEach(t => {
    if (t.type === 'income') totalIncome += t.amount;
    else if (t.type === 'expense') totalExpense += t.amount;
  });
  
  const balanceNet = totalIncome - totalExpense;
  
  // Set labels
  document.getElementById('total-income-display').textContent = formatRupiah(totalIncome);
  document.getElementById('total-expense-display').textContent = formatRupiah(totalExpense);
  
  const netEl = document.getElementById('total-net-display');
  netEl.textContent = formatRupiah(balanceNet);
  netEl.className = 'balance-amount ' + (balanceNet >= 0 ? 'income-text' : 'expense-text');
  
  // Progress status
  const fillBar = document.getElementById('balance-progress-fill');
  const fillPctText = document.getElementById('balance-progress-pct');
  const fillStatusText = document.getElementById('balance-progress-status');
  
  if (totalIncome > 0) {
    const usagePct = Math.min(Math.round((totalExpense / totalIncome) * 100), 100);
    fillBar.style.width = `${usagePct}%`;
    fillPctText.textContent = `${usagePct}% terpakai`;
    
    if (usagePct < 70) {
      fillStatusText.textContent = 'Aman';
      fillStatusText.style.color = '#ffffff';
    } else if (usagePct < 90) {
      fillStatusText.textContent = 'Mulai Hemat';
      fillStatusText.style.color = '#fbbf24';
    } else {
      fillStatusText.textContent = 'Kritis!';
      fillStatusText.style.color = '#f87171';
    }
  } else {
    fillBar.style.width = totalExpense > 0 ? '100%' : '0%';
    fillPctText.textContent = totalExpense > 0 ? '100% terpakai' : '0% terpakai';
    fillStatusText.textContent = totalExpense > 0 ? 'Pengeluaran Tanpa Gaji' : 'Kosong';
  }
  
  renderDonutChart(currentMonthTransactions);
  renderCategoryBudgets(currentMonthTransactions);
  renderRecentTransactions(currentMonthTransactions);
}

// Render SVG Donut Chart
function renderDonutChart(monthlyTransactions) {
  const donutSvg = document.getElementById('donut-svg');
  const legendContainer = document.getElementById('chart-legend');
  
  const oldSlices = donutSvg.querySelectorAll('.donut-slice');
  oldSlices.forEach(s => s.remove());
  
  const expenses = monthlyTransactions.filter(t => t.type === 'expense');
  const totalExpense = expenses.reduce((sum, t) => sum + t.amount, 0);
  
  document.getElementById('donut-center-amount').textContent = formatRupiah(totalExpense);
  
  if (totalExpense === 0) {
    legendContainer.innerHTML = '<div class="empty-state-text">Belum ada pengeluaran bulan ini</div>';
    return;
  }
  
  const categoryTotals = {};
  expenses.forEach(t => {
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
  });
  
  const sortedCategories = Object.keys(categoryTotals).map(catId => {
    const config = CATEGORIES.expense.find(c => c.id === catId) || { name: catId, emoji: '❓', color: '#94a3b8' };
    return {
      id: catId,
      name: config.name,
      emoji: config.emoji,
      color: config.color,
      amount: categoryTotals[catId],
      percentage: (categoryTotals[catId] / totalExpense) * 100
    };
  }).sort((a, b) => b.amount - a.amount);
  
  let cumulativePercentage = 0;
  sortedCategories.forEach(cat => {
    const slice = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    slice.setAttribute('class', 'donut-slice');
    slice.setAttribute('cx', '18');
    slice.setAttribute('cy', '18');
    slice.setAttribute('r', '15.91549430918954');
    slice.setAttribute('fill', 'transparent');
    slice.setAttribute('stroke', cat.color);
    slice.setAttribute('stroke-width', '4');
    
    const strokeDashArray = `${cat.percentage} ${100 - cat.percentage}`;
    const strokeDashOffset = 100 - cumulativePercentage;
    
    slice.setAttribute('stroke-dasharray', strokeDashArray);
    slice.setAttribute('stroke-dashoffset', strokeDashOffset.toString());
    
    donutSvg.appendChild(slice);
    cumulativePercentage += cat.percentage;
  });
  
  legendContainer.innerHTML = sortedCategories.map(cat => `
    <div class="legend-item">
      <div class="legend-left">
        <span class="legend-color-dot" style="background-color: ${cat.color};"></span>
        <span class="legend-label">${cat.emoji} ${cat.name}</span>
      </div>
      <span class="legend-value">${Math.round(cat.percentage)}%</span>
    </div>
  `).join('');
}

// Render Category Budget Items
function renderCategoryBudgets(monthlyTransactions) {
  const container = document.getElementById('budget-list-container');
  container.innerHTML = '';
  
  const expenses = monthlyTransactions.filter(t => t.type === 'expense');
  
  const categoryTotals = {};
  expenses.forEach(t => {
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
  });
  
  CATEGORIES.expense.forEach(cat => {
    const limit = state.budgets[cat.id] || 0;
    if (limit === 0) return;
    
    const spent = categoryTotals[cat.id] || 0;
    const ratio = Math.min((spent / limit) * 100, 100);
    const ratioRounded = Math.round((spent / limit) * 100);
    
    let colorClass = 'progress-safe';
    if (ratioRounded >= 100) colorClass = 'progress-danger';
    else if (ratioRounded >= 80) colorClass = 'progress-warning';
    
    const itemCard = document.createElement('div');
    itemCard.className = 'budget-item-card';
    itemCard.innerHTML = `
      <div class="budget-info-row">
        <div class="budget-category-label">
          <span class="budget-category-icon">${cat.emoji}</span>
          <span>${cat.name}</span>
        </div>
        <div class="budget-spent-ratio">
          <span>${formatRupiah(spent)}</span> / ${formatRupiah(limit)} (${ratioRounded}%)
        </div>
      </div>
      <div class="budget-progress-bar">
        <div class="budget-progress-fill ${colorClass}" style="width: ${ratio}%;"></div>
      </div>
    `;
    container.appendChild(itemCard);
  });
}

// Render Recent transactions inside dashboard
function renderRecentTransactions(monthlyTransactions) {
  const container = document.getElementById('recent-transactions-list');
  container.innerHTML = '';
  
  const sorted = [...monthlyTransactions].sort((a, b) => new Date(b.date) - new Date(a.date));
  const recent = sorted.slice(0, 4);
  
  if (recent.length === 0) {
    container.innerHTML = '<div class="card" style="text-align: center; color: var(--text-muted); font-size: 0.8rem; font-style: italic; padding: 14px;">Belum ada transaksi bulan ini</div>';
    return;
  }
  
  recent.forEach(t => {
    const isExpense = t.type === 'expense';
    const catConfig = CATEGORIES[t.type].find(c => c.id === t.category) || { name: t.category, emoji: '❓', color: '#94a3b8' };
    
    const div = document.createElement('div');
    div.className = 'transaction-item';
    div.addEventListener('click', () => openEditTransactionSheet(t));
    
    div.innerHTML = `
      <div class="transaction-left">
        <div class="transaction-icon-circle" style="background-color: ${catConfig.color}20; color: ${catConfig.color};">
          ${catConfig.emoji}
        </div>
        <div class="transaction-info">
          <span class="transaction-category">${catConfig.name}</span>
          <span class="transaction-note">${t.note || 'Tanpa catatan'}</span>
        </div>
      </div>
      <div class="transaction-right ${isExpense ? 'expense-text' : 'income-text'}">
        ${isExpense ? '-' : '+'}${formatRupiah(t.amount)}
      </div>
    `;
    container.appendChild(div);
  });
}

// Render all transactions (Transactions Tab)
function renderAllTransactions() {
  const container = document.getElementById('all-transactions-list');
  container.innerHTML = '';
  
  const searchVal = document.getElementById('transaction-search').value.toLowerCase();
  const typeFilter = document.getElementById('transaction-type-filter').value;
  
  let filtered = getTransactionsForCurrentMonth().filter(t => {
    const noteMatch = (t.note || '').toLowerCase().includes(searchVal);
    const categoryConfig = CATEGORIES[t.type].find(c => c.id === t.category);
    const categoryMatch = categoryConfig ? categoryConfig.name.toLowerCase().includes(searchVal) : false;
    const amountMatch = t.amount.toString().includes(searchVal);
    
    const searchMatch = noteMatch || categoryMatch || amountMatch;
    const typeMatch = typeFilter === 'all' || t.type === typeFilter;
    
    return searchMatch && typeMatch;
  });
  
  if (filtered.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; font-style: italic; margin-top: 40px;">Tidak ditemukan transaksi</div>';
    return;
  }
  
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  let lastDateLabel = '';
  filtered.forEach(t => {
    const txDate = new Date(t.date);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    
    let dateLabel = '';
    if (txDate.toDateString() === today.toDateString()) {
      dateLabel = 'Hari Ini';
    } else if (txDate.toDateString() === yesterday.toDateString()) {
      dateLabel = 'Kemarin';
    } else {
      const options = { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' };
      dateLabel = txDate.toLocaleDateString('id-ID', options);
    }
    
    if (dateLabel !== lastDateLabel) {
      const header = document.createElement('div');
      header.className = 'transaction-group-header';
      header.textContent = dateLabel;
      container.appendChild(header);
      lastDateLabel = dateLabel;
    }
    
    const isExpense = t.type === 'expense';
    const catConfig = CATEGORIES[t.type].find(c => c.id === t.category) || { name: t.category, emoji: '❓', color: '#94a3b8' };
    
    const item = document.createElement('div');
    item.className = 'transaction-item';
    item.addEventListener('click', () => openEditTransactionSheet(t));
    item.innerHTML = `
      <div class="transaction-left">
        <div class="transaction-icon-circle" style="background-color: ${catConfig.color}20; color: ${catConfig.color};">
          ${catConfig.emoji}
        </div>
        <div class="transaction-info">
          <span class="transaction-category">${catConfig.name}</span>
          <span class="transaction-note">${t.note || 'Tanpa catatan'}</span>
        </div>
      </div>
      <div class="transaction-right ${isExpense ? 'expense-text' : 'income-text'}">
        ${isExpense ? '-' : '+'}${formatRupiah(t.amount)}
      </div>
    `;
    container.appendChild(item);
  });
}

// Render Analytics Tab
function renderAnalytics() {
  const monthly = getTransactionsForCurrentMonth();
  const expenses = monthly.filter(t => t.type === 'expense');
  const totalExpense = expenses.reduce((sum, t) => sum + t.amount, 0);
  
  const dailyAverageDisplay = document.getElementById('daily-average-display');
  const maxExpenseDisplay = document.getElementById('max-expense-display');
  
  if (expenses.length === 0) {
    dailyAverageDisplay.textContent = 'Rp 0';
    maxExpenseDisplay.textContent = 'Rp 0';
    document.getElementById('analytics-breakdown-container').innerHTML = '<div class="empty-state-text">Belum ada data pengeluaran bulan ini</div>';
    return;
  }
  
  const year = currentActiveDate.getFullYear();
  const month = currentActiveDate.getMonth();
  
  const today = new Date();
  let daysInPeriod = new Date(year, month + 1, 0).getDate();
  if (today.getFullYear() === year && today.getMonth() === month) {
    daysInPeriod = today.getDate();
  }
  
  const dailyAverage = Math.round(totalExpense / daysInPeriod);
  dailyAverageDisplay.textContent = formatRupiah(dailyAverage);
  
  const maxExpense = Math.max(...expenses.map(t => t.amount));
  maxExpenseDisplay.textContent = formatRupiah(maxExpense);
  
  const catSums = {};
  expenses.forEach(t => {
    catSums[t.category] = (catSums[t.category] || 0) + t.amount;
  });
  
  const sortedBreakdown = Object.keys(catSums).map(catId => {
    const config = CATEGORIES.expense.find(c => c.id === catId) || { name: catId, emoji: '❓', color: '#64748b' };
    return {
      id: catId,
      name: config.name,
      emoji: config.emoji,
      color: config.color,
      amount: catSums[catId],
      percentage: (catSums[catId] / totalExpense) * 100
    };
  }).sort((a, b) => b.amount - a.amount);
  
  const container = document.getElementById('analytics-breakdown-container');
  container.innerHTML = sortedBreakdown.map(cat => `
    <div class="breakdown-row">
      <div class="breakdown-info">
        <div class="breakdown-name-pct">
          <span>${cat.emoji} ${cat.name}</span>
          <span class="breakdown-pct-pill">${Math.round(cat.percentage)}%</span>
        </div>
        <span class="breakdown-amount">${formatRupiah(cat.amount)}</span>
      </div>
      <div class="breakdown-bar-bg">
        <div class="breakdown-bar-fill" style="background-color: ${cat.color}; width: ${cat.percentage}%;"></div>
      </div>
    </div>
  `).join('');
}

// Render Settings
function renderSettings() {
  document.getElementById('default-income-input').value = (state.settings.defaultIncome || 0).toLocaleString('id-ID');
  
  const container = document.getElementById('category-budgets-config-list');
  container.innerHTML = '';
  
  CATEGORIES.expense.forEach(cat => {
    const limit = state.budgets[cat.id] || 0;
    const formattedLimit = limit > 0 ? limit.toLocaleString('id-ID') : '';
    
    const row = document.createElement('div');
    row.className = 'config-budget-row';
    row.innerHTML = `
      <div class="config-budget-label">
        <span>${cat.emoji}</span>
        <span>${cat.name}</span>
      </div>
      <div class="currency-input-wrapper">
        <span class="currency-symbol">Rp</span>
        <input type="text" data-category="${cat.id}" class="settings-input budget-config-input" placeholder="Tanpa Anggaran" value="${formattedLimit}" />
      </div>
    `;
    container.appendChild(row);
  });
  
  const configInputs = container.querySelectorAll('.budget-config-input');
  configInputs.forEach(input => {
    input.addEventListener('input', () => handleNumericInputFormat(input));
  });
}

// Global active view switch
function renderCurrentView() {
  document.getElementById('current-month-display').textContent = getIndonesianMonthYear(currentActiveDate);
  
  const panels = document.querySelectorAll('.view-panel');
  panels.forEach(p => p.classList.remove('active'));
  
  const activePanel = document.getElementById(`${currentActiveView}-view`);
  if (activePanel) {
    activePanel.classList.add('active');
  }
  
  if (currentActiveView === 'dashboard') {
    renderDashboard();
  } else if (currentActiveView === 'transactions') {
    renderAllTransactions();
  } else if (currentActiveView === 'analytics') {
    renderAnalytics();
  } else if (currentActiveView === 'settings') {
    renderSettings();
  }
}

// --- STATE QUERIES ---

function getTransactionsForCurrentMonth() {
  const targetYear = currentActiveDate.getFullYear();
  const targetMonth = currentActiveDate.getMonth();
  
  return state.transactions.filter(t => {
    const txDate = new Date(t.date);
    return txDate.getFullYear() === targetYear && txDate.getMonth() === targetMonth;
  });
}

// --- SHEET CONTROLS ---

function openTransactionSheet() {
  const sheet = document.getElementById('transaction-sheet');
  const fab = document.getElementById('add-transaction-fab');
  
  document.getElementById('transaction-id').value = '';
  document.getElementById('sheet-title').textContent = 'Tambah Transaksi';
  document.getElementById('transaction-amount').value = '';
  document.getElementById('transaction-note').value = '';
  
  const today = new Date();
  let dateString = today.toISOString().split('T')[0];
  if (currentActiveDate.getFullYear() !== today.getFullYear() || currentActiveDate.getMonth() !== today.getMonth()) {
    const firstDay = new Date(currentActiveDate.getFullYear(), currentActiveDate.getMonth(), 2);
    dateString = firstDay.toISOString().split('T')[0];
  }
  document.getElementById('transaction-date').value = dateString;
  
  document.getElementById('delete-transaction-btn').classList.add('hidden');
  setTransactionTypeInSheet('expense');
  
  sheet.classList.add('open');
  fab.classList.add('active');
}

function closeTransactionSheet() {
  const sheet = document.getElementById('transaction-sheet');
  const fab = document.getElementById('add-transaction-fab');
  
  sheet.classList.remove('open');
  fab.classList.remove('active');
}

function setTransactionTypeInSheet(type) {
  currentTransactionType = type;
  
  const expenseBtn = document.getElementById('type-expense-btn');
  const incomeBtn = document.getElementById('type-income-btn');
  
  if (type === 'expense') {
    expenseBtn.classList.add('active');
    incomeBtn.classList.remove('active');
  } else {
    expenseBtn.classList.remove('active');
    incomeBtn.classList.add('active');
  }
  
  renderCategorySelectorGrid();
}

function renderCategorySelectorGrid() {
  const grid = document.getElementById('category-selector-grid');
  grid.innerHTML = '';
  
  const categoriesList = CATEGORIES[currentTransactionType];
  
  categoriesList.forEach((cat, index) => {
    const card = document.createElement('div');
    card.className = 'category-select-card';
    if (index === 0) {
      card.classList.add('selected');
      selectedCategory = cat.id;
      document.getElementById('transaction-category').value = cat.id;
    }
    
    card.addEventListener('click', () => {
      const allCards = grid.querySelectorAll('.category-select-card');
      allCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedCategory = cat.id;
      document.getElementById('transaction-category').value = cat.id;
    });
    
    card.innerHTML = `
      <span class="category-card-icon">${cat.emoji}</span>
      <span class="category-card-label">${cat.name}</span>
    `;
    grid.appendChild(card);
  });
}

function openEditTransactionSheet(transaction) {
  const sheet = document.getElementById('transaction-sheet');
  const fab = document.getElementById('add-transaction-fab');
  
  document.getElementById('transaction-id').value = transaction.id;
  document.getElementById('sheet-title').textContent = 'Edit Transaksi';
  
  document.getElementById('transaction-amount').value = transaction.amount.toLocaleString('id-ID');
  document.getElementById('transaction-date').value = transaction.date;
  document.getElementById('transaction-note').value = transaction.note || '';
  
  document.getElementById('delete-transaction-btn').classList.remove('hidden');
  
  setTransactionTypeInSheet(transaction.type);
  
  const grid = document.getElementById('category-selector-grid');
  const cards = grid.querySelectorAll('.category-select-card');
  const categoriesList = CATEGORIES[transaction.type];
  const catIndex = categoriesList.findIndex(c => c.id === transaction.category);
  
  cards.forEach(c => c.classList.remove('selected'));
  if (catIndex !== -1 && cards[catIndex]) {
    cards[catIndex].classList.add('selected');
    selectedCategory = transaction.category;
    document.getElementById('transaction-category').value = transaction.category;
  }
  
  sheet.classList.add('open');
  fab.classList.add('active');
}

// --- EVENT HANDLERS & LISTENERS ---

function initEventHandlers() {
  
  // 1. Navigation panel switching
  const navItems = document.querySelectorAll('.app-nav .nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
      currentActiveView = item.dataset.view;
      renderCurrentView();
    });
  });
  
  document.getElementById('quick-edit-budget-btn').addEventListener('click', () => {
    navItems.forEach(nav => nav.classList.remove('active'));
    document.getElementById('nav-settings').classList.add('active');
    currentActiveView = 'settings';
    renderCurrentView();
  });
  
  document.getElementById('view-all-transactions-btn').addEventListener('click', () => {
    navItems.forEach(nav => nav.classList.remove('active'));
    document.getElementById('nav-transactions').classList.add('active');
    currentActiveView = 'transactions';
    renderCurrentView();
  });

  // 2. Month Navigation selectors
  document.getElementById('prev-month-btn').addEventListener('click', () => {
    currentActiveDate.setMonth(currentActiveDate.getMonth() - 1);
    renderCurrentView();
  });
  
  document.getElementById('next-month-btn').addEventListener('click', () => {
    currentActiveDate.setMonth(currentActiveDate.getMonth() + 1);
    renderCurrentView();
  });

  // 3. Theme Toggle Button
  document.getElementById('theme-toggle-btn').addEventListener('click', async () => {
    const nextTheme = state.settings.theme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    
    // Save to server settings
    try {
      await apiRequest('/api/settings', {
        method: 'POST',
        body: JSON.stringify(state.settings)
      });
      showToast(`Mode ${nextTheme === 'dark' ? 'Gelap' : 'Terang'} aktif`, 'success');
    } catch (e) {
      console.error(e);
    }
  });

  // 4. FAB sheet toggles
  const fab = document.getElementById('add-transaction-fab');
  fab.addEventListener('click', () => {
    const sheet = document.getElementById('transaction-sheet');
    if (sheet.classList.contains('open')) {
      closeTransactionSheet();
    } else {
      openTransactionSheet();
    }
  });
  
  document.getElementById('close-sheet-btn').addEventListener('click', closeTransactionSheet);
  document.querySelector('.sheet-overlay').addEventListener('click', closeTransactionSheet);

  document.getElementById('type-expense-btn').addEventListener('click', () => setTransactionTypeInSheet('expense'));
  document.getElementById('type-income-btn').addEventListener('click', () => setTransactionTypeInSheet('income'));

  const amountInput = document.getElementById('transaction-amount');
  amountInput.addEventListener('input', () => handleNumericInputFormat(amountInput));
  
  const settingsIncomeInput = document.getElementById('default-income-input');
  settingsIncomeInput.addEventListener('input', () => handleNumericInputFormat(settingsIncomeInput));

  // 5. Submit Transaction Form
  const form = document.getElementById('transaction-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const txId = document.getElementById('transaction-id').value;
    const amountVal = parseRawNumber(document.getElementById('transaction-amount').value);
    const dateVal = document.getElementById('transaction-date').value;
    const noteVal = document.getElementById('transaction-note').value.trim();
    
    if (amountVal <= 0) {
      showToast('Nominal harus lebih dari Rp 0', 'error');
      return;
    }
    
    if (!selectedCategory) {
      showToast('Pilih kategori transaksi', 'error');
      return;
    }
    
    const txData = {
      type: currentTransactionType,
      amount: amountVal,
      category: selectedCategory,
      date: dateVal,
      note: noteVal
    };
    
    try {
      if (txId) {
        // PUT edit
        txData.id = txId;
        const updated = await apiRequest('/api/transactions', {
          method: 'PUT',
          body: JSON.stringify(txData)
        });
        
        const idx = state.transactions.findIndex(t => t.id === txId);
        if (idx !== -1) {
          state.transactions[idx] = updated;
        }
        showToast('Transaksi berhasil diperbarui', 'success');
      } else {
        // POST create
        const created = await apiRequest('/api/transactions', {
          method: 'POST',
          body: JSON.stringify(txData)
        });
        
        state.transactions.push(created);
        showToast('Transaksi berhasil ditambahkan', 'success');
      }
      
      closeTransactionSheet();
      
      const newTxDate = new Date(dateVal);
      currentActiveDate = new Date(newTxDate.getFullYear(), newTxDate.getMonth(), 1);
      renderCurrentView();
      
    } catch (err) {
      console.error(err);
    }
  });

  // 6. Delete Transaction Button
  document.getElementById('delete-transaction-btn').addEventListener('click', () => {
    const txId = document.getElementById('transaction-id').value;
    if (!txId) return;
    
    showConfirmDialog(
      'Hapus Transaksi',
      'Apakah Anda yakin ingin menghapus transaksi ini secara permanen?',
      async () => {
        try {
          await apiRequest(`/api/transactions?id=${txId}`, {
            method: 'DELETE'
          });
          
          state.transactions = state.transactions.filter(t => t.id !== txId);
          closeTransactionSheet();
          showToast('Transaksi berhasil dihapus', 'success');
          renderCurrentView();
        } catch (e) {
          console.error(e);
        }
      }
    );
  });

  document.getElementById('transaction-search').addEventListener('input', renderAllTransactions);
  document.getElementById('transaction-type-filter').addEventListener('change', renderAllTransactions);

  // 7. Save Settings & Budgets Configurations
  document.getElementById('save-budgets-btn').addEventListener('click', async () => {
    const incomeVal = parseRawNumber(document.getElementById('default-income-input').value);
    state.settings.defaultIncome = incomeVal;
    
    const budgetsObj = {};
    const budgetInputs = document.querySelectorAll('.budget-config-input');
    budgetInputs.forEach(input => {
      const catId = input.dataset.category;
      const limitVal = parseRawNumber(input.value);
      budgetsObj[catId] = limitVal;
    });
    
    try {
      // Parallel post settings & budgets to DB
      const [savedBudgets, savedSettings] = await Promise.all([
        apiRequest('/api/budgets', {
          method: 'POST',
          body: JSON.stringify(budgetsObj)
        }),
        apiRequest('/api/settings', {
          method: 'POST',
          body: JSON.stringify(state.settings)
        })
      ]);
      
      state.budgets = savedBudgets;
      state.settings = savedSettings;
      
      // Auto sync current month salary if user has absolute zero income logs
      const hasIncomeThisMonth = getTransactionsForCurrentMonth().some(t => t.type === 'income');
      if (!hasIncomeThisMonth && incomeVal > 0) {
        showConfirmDialog(
          'Sinkronisasi Pendapatan',
          `Apakah Anda ingin menambahkan pendapatan otomatis sebesar ${formatRupiah(incomeVal)} ke bulan ${getIndonesianMonthYear(currentActiveDate)}?`,
          async () => {
            const firstDay = new Date(currentActiveDate.getFullYear(), currentActiveDate.getMonth(), 1);
            const created = await apiRequest('/api/transactions', {
              method: 'POST',
              body: JSON.stringify({
                type: 'income',
                amount: incomeVal,
                category: 'gaji',
                date: firstDay.toISOString().split('T')[0],
                note: 'Pendapatan Bulanan Otomatis'
              })
            });
            state.transactions.push(created);
            showToast('Pendapatan bulan ini disinkronkan', 'success');
            renderCurrentView();
          }
        );
      }
      
      showToast('Anggaran berhasil disimpan', 'success');
      renderCurrentView();
      
    } catch (e) {
      console.error(e);
    }
  });

  // 8. Settings actions: Export Backup
  document.getElementById('export-data-btn').addEventListener('click', () => {
    try {
      const jsonString = JSON.stringify(state, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `uangku-cloud-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showToast('Cadangan berhasil diekspor', 'success');
    } catch (e) {
      console.error(e);
      showToast('Gagal mengekspor data', 'error');
    }
  });

  // 9. Settings actions: Import Backup
  const fileInput = document.getElementById('import-data-file');
  document.getElementById('import-trigger-btn').addEventListener('click', () => {
    fileInput.click();
  });
  
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async function(evt) {
      try {
        const parsed = JSON.parse(evt.target.result);
        
        if (parsed && Array.isArray(parsed.transactions) && typeof parsed.budgets === 'object') {
          // Put backups to API
          // 1. Post settings
          const importedSettings = await apiRequest('/api/settings', {
            method: 'POST',
            body: JSON.stringify(parsed.settings || DEFAULT_SETTINGS)
          });
          
          // 2. Post budgets
          const importedBudgets = await apiRequest('/api/budgets', {
            method: 'POST',
            body: JSON.stringify(parsed.budgets || DEFAULT_BUDGETS)
          });
          
          // 3. Clear existing transaction and load imported list
          // For safety, let's delete them sequentially or clear database
          // Wait, let's delete existing transaction logs first
          const deletePromises = state.transactions.map(t => 
            apiRequest(`/api/transactions?id=${t.id}`, { method: 'DELETE' })
          );
          await Promise.all(deletePromises);
          
          // Post imported list to DB
          const insertPromises = parsed.transactions.map(t => 
            apiRequest('/api/transactions', {
              method: 'POST',
              body: JSON.stringify({
                type: t.type,
                amount: t.amount,
                category: t.category,
                date: t.date,
                note: t.note
              })
            })
          );
          const importedTransactions = await Promise.all(insertPromises);
          
          state.transactions = importedTransactions;
          state.budgets = importedBudgets;
          state.settings = importedSettings;
          
          showToast('Data berhasil dipulihkan dari cadangan!', 'success');
          
          fileInput.value = '';
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } else {
          showToast('File JSON tidak valid', 'error');
        }
      } catch (err) {
        console.error(err);
        showToast('Gagal membaca file backup', 'error');
      }
    };
    reader.readAsText(file);
  });

  // 10. Clear Account Database Reset
  document.getElementById('reset-data-btn').addEventListener('click', () => {
    showConfirmDialog(
      'Reset Semua Data',
      'Tindakan ini akan menghapus seluruh riwayat transaksi dan anggaran Anda dari database secara PERMANEN. Anda tidak dapat membatalkannya.',
      async () => {
        try {
          // Reset budgets
          await apiRequest('/api/budgets', {
            method: 'POST',
            body: JSON.stringify(DEFAULT_BUDGETS)
          });
          // Reset settings
          await apiRequest('/api/settings', {
            method: 'POST',
            body: JSON.stringify(DEFAULT_SETTINGS)
          });
          // Delete all transactions
          const deletePromises = state.transactions.map(t => 
            apiRequest(`/api/transactions?id=${t.id}`, { method: 'DELETE' })
          );
          await Promise.all(deletePromises);
          
          showToast('Data akun berhasil dibersihkan', 'success');
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } catch (e) {
          console.error(e);
        }
      }
    );
  });

  // --- 11. REGISTER / LOGIN ACTION HANDLERS ---
  const authForm = document.getElementById('auth-form');
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const usernameVal = document.getElementById('auth-username').value.trim();
    const passwordVal = document.getElementById('auth-password').value;
    
    if (usernameVal.length < 3) {
      showToast('Username harus minimal 3 karakter', 'error');
      return;
    }
    if (passwordVal.length < 1) {
      showToast('Password tidak boleh kosong', 'error');
      return;
    }
    
    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    
    try {
      const res = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify({ username: usernameVal, password: passwordVal })
      });
      
      if (authMode === 'register') {
        showToast('Pendaftaran berhasil! Silakan masuk.', 'success');
        authMode = 'login';
        updateAuthFormUI();
        // Clear password
        document.getElementById('auth-password').value = '';
      } else {
        // Login success
        auth.token = res.token;
        auth.username = res.user.username;
        
        localStorage.setItem('uangku_auth_token', res.token);
        localStorage.setItem('uangku_auth_username', res.user.username);
        
        showToast('Berhasil masuk', 'success');
        
        // Load account data and render
        await loadStateFromServer();
        
        const authScreen = document.getElementById('auth-screen');
        authScreen.classList.add('hidden');
        
        renderCurrentView();
      }
    } catch (err) {
      console.error(err);
    }
  });

  // Auth screen toggle btn (Login <-> Register)
  const authToggleBtn = document.getElementById('auth-toggle-btn');
  authToggleBtn.addEventListener('click', () => {
    authMode = authMode === 'login' ? 'register' : 'login';
    updateAuthFormUI();
  });

  // Logout Button Settings
  document.getElementById('logout-btn').addEventListener('click', () => {
    showConfirmDialog(
      'Keluar Akun',
      'Apakah Anda yakin ingin keluar dari akun Anda?',
      () => {
        localStorage.removeItem('uangku_auth_token');
        localStorage.removeItem('uangku_auth_username');
        auth.token = '';
        auth.username = '';
        
        // Reset local states
        state = {
          transactions: [],
          budgets: { ...DEFAULT_BUDGETS },
          settings: { ...DEFAULT_SETTINGS }
        };
        
        // Show login panel
        const authScreen = document.getElementById('auth-screen');
        authScreen.classList.remove('hidden');
        
        // Reset active views
        navItems.forEach(nav => nav.classList.remove('active'));
        document.getElementById('nav-dashboard').classList.add('active');
        currentActiveView = 'dashboard';
        
        // Reset login form fields
        document.getElementById('auth-username').value = '';
        document.getElementById('auth-password').value = '';
        
        showToast('Berhasil keluar', 'success');
      }
    );
  });
}

function updateAuthFormUI() {
  const title = document.getElementById('auth-title');
  const subtitle = document.getElementById('auth-subtitle');
  const submitBtn = document.getElementById('auth-submit-btn');
  const toggleBtn = document.getElementById('auth-toggle-btn');
  
  if (authMode === 'login') {
    if (title) title.textContent = 'Masuk ke Akun';
    subtitle.textContent = 'Masuk untuk mengakses catatan keuangan Anda';
    submitBtn.textContent = 'Masuk';
    toggleBtn.textContent = 'Belum punya akun? Daftar Sekarang';
  } else {
    if (title) title.textContent = 'Daftar Akun Baru';
    subtitle.textContent = 'Daftar akun baru untuk mulai memantau gaji & pengeluaran';
    submitBtn.textContent = 'Daftar';
    toggleBtn.textContent = 'Sudah punya akun? Masuk Sekarang';
  }
}

// Check on startup if authentication details exist
async function checkAuthOnStartup() {
  const authScreen = document.getElementById('auth-screen');
  
  if (auth.token && auth.username) {
    authScreen.classList.add('hidden');
    await loadStateFromServer();
  } else {
    authScreen.classList.remove('hidden');
    applyTheme('light'); // Default theme light for login page
  }
}

// --- BOOTSTRAP INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
  initEventHandlers();
  await checkAuthOnStartup();
  renderCurrentView();
});
