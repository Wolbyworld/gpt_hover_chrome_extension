// Default system prompt
const DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant that provides clear, concise definitions. For any text provided, focus on defining the specific highlighted term/phrase. Any additional text provided is context to help you understand the term better, but is not the target of the definition. Keep responses under 100 words.";

document.addEventListener('DOMContentLoaded', () => {
  // Load saved settings
  chrome.storage.sync.get([
    'openaiApiKey',
    'defaultLanguage',
    'appearanceSettings',
    'excludedDomains'
  ], (result) => {
    document.getElementById('apiKey').value = result.openaiApiKey || '';
    document.getElementById('defaultLanguage').value = result.defaultLanguage || 'en';
    
    const appearanceSettings = result.appearanceSettings || {
      fontSize: '14px',
      maxWidth: '300px',
      hoverDelay: 3000,
      theme: 'auto'
    };
    
    document.getElementById('fontSize').value = appearanceSettings.fontSize;
    document.getElementById('maxWidth').value = appearanceSettings.maxWidth;
    document.getElementById('hoverDelay').value = appearanceSettings.hoverDelay;
    document.getElementById('theme').value = appearanceSettings.theme;
    
    // Load excluded domains
    loadExcludedDomains();
  });
  
  // Save settings
  document.getElementById('saveSettings').addEventListener('click', () => {
    const apiKey = document.getElementById('apiKey').value;
    const defaultLanguage = document.getElementById('defaultLanguage').value;
    
    chrome.storage.sync.set({
      openaiApiKey: apiKey,
      defaultLanguage: defaultLanguage
    }, () => {
      const status = document.getElementById('settingsStatus');
      status.textContent = 'Settings saved!';
      setTimeout(() => {
        status.textContent = '';
      }, 2000);
    });
  });
  
  // Save appearance settings
  document.getElementById('saveAppearance').addEventListener('click', () => {
    const appearanceSettings = {
      fontSize: document.getElementById('fontSize').value,
      maxWidth: document.getElementById('maxWidth').value,
      hoverDelay: document.getElementById('hoverDelay').value,
      theme: document.getElementById('theme').value
    };
    
    chrome.storage.sync.set({ appearanceSettings }, () => {
      const status = document.getElementById('appearanceStatus');
      status.textContent = 'Appearance settings saved!';
      setTimeout(() => {
        status.textContent = '';
      }, 2000);
    });
  });
  
  // Domain exclusion functionality
  document.getElementById('addDomain').addEventListener('click', async () => {
    const domainInput = document.getElementById('domainInput');
    const domain = domainInput.value.trim().toLowerCase();
    
    if (domain) {
      await addExcludedDomain(domain);
      domainInput.value = '';
    }
  });

  document.getElementById('addCurrentDomain').addEventListener('click', async () => {
    // Get current tab's domain
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      const domain = new URL(tab.url).hostname;
      await addExcludedDomain(domain);
      document.getElementById('domainInput').value = '';
    }
  });
  
  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      // Update active tab
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Show corresponding content
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      document.getElementById(tab.dataset.tab).classList.add('active');
    });
  });
});

// Format timestamp
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

// Load and display history
async function loadHistory() {
  const { history = [] } = await chrome.storage.sync.get(['history']);
  const historyList = document.getElementById('historyList');
  
  if (history.length === 0) {
    historyList.innerHTML = '<p>No history yet</p>';
    return;
  }
  
  historyList.innerHTML = history
    .map((item, index) => `
      <div class="history-item">
        <div class="history-term">${item.text}</div>
        <div class="history-definition">${item.definition}</div>
        <div class="history-meta">
          <span>${formatTimestamp(item.timestamp)}</span>
          <button class="favorite-btn ${item.favorite ? 'active' : ''}" data-index="${index}">
            ${item.favorite ? '★' : '☆'}
          </button>
        </div>
      </div>
    `)
    .join('');
    
  // Add favorite button handlers
  document.querySelectorAll('.favorite-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const index = parseInt(btn.dataset.index);
      const { history = [] } = await chrome.storage.sync.get(['history']);
      
      history[index].favorite = !history[index].favorite;
      await chrome.storage.sync.set({ history });
      
      // Update button appearance
      btn.classList.toggle('active');
      btn.textContent = history[index].favorite ? '★' : '☆';
    });
  });
}

// Function to load excluded domains
async function loadExcludedDomains() {
  const { excludedDomains = [] } = await chrome.storage.sync.get(['excludedDomains']);
  const domainList = document.getElementById('domainList');
  
  if (excludedDomains.length === 0) {
    domainList.innerHTML = '<p>No excluded domains</p>';
    return;
  }
  
  domainList.innerHTML = excludedDomains
    .map(domain => `
      <div class="domain-item">
        <span>${domain}</span>
        <button class="remove-domain" data-domain="${domain}">×</button>
      </div>
    `)
    .join('');
    
  // Add remove button handlers
  document.querySelectorAll('.remove-domain').forEach(btn => {
    btn.addEventListener('click', async () => {
      const domain = btn.dataset.domain;
      await removeExcludedDomain(domain);
    });
  });
}

// Function to add excluded domain
async function addExcludedDomain(domain) {
  const { excludedDomains = [] } = await chrome.storage.sync.get(['excludedDomains']);
  
  if (!excludedDomains.includes(domain)) {
    excludedDomains.push(domain);
    await chrome.storage.sync.set({ excludedDomains });
    
    const status = document.getElementById('domainsStatus');
    status.textContent = 'Domain added!';
    setTimeout(() => {
      status.textContent = '';
    }, 2000);
    
    loadExcludedDomains();
  }
}

// Function to remove excluded domain
async function removeExcludedDomain(domain) {
  const { excludedDomains = [] } = await chrome.storage.sync.get(['excludedDomains']);
  
  const updatedDomains = excludedDomains.filter(d => d !== domain);
  await chrome.storage.sync.set({ excludedDomains: updatedDomains });
  
  const status = document.getElementById('domainsStatus');
  status.textContent = 'Domain removed!';
  setTimeout(() => {
    status.textContent = '';
  }, 2000);
  
  loadExcludedDomains();
} 