// Default system prompt
const DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant that provides clear, concise definitions. For any text provided, focus on defining the specific highlighted term/phrase. Any additional text provided is context to help you understand the term better, but is not the target of the definition. Keep responses under 100 words.";

// Tab handling
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab).classList.add('active');
    
    if (tab.dataset.tab === 'history') {
      loadHistory();
    }
  });
});

// Load saved settings when popup opens
document.addEventListener('DOMContentLoaded', async () => {
  const {
    openaiApiKey,
    systemPrompt,
    defaultLanguage,
    appearanceSettings,
    history
  } = await chrome.storage.sync.get([
    'openaiApiKey',
    'systemPrompt',
    'defaultLanguage',
    'appearanceSettings',
    'history'
  ]);
  
  // Load settings
  document.getElementById('apiKey').value = openaiApiKey || '';
  document.getElementById('systemPrompt').value = systemPrompt || DEFAULT_SYSTEM_PROMPT;
  document.getElementById('defaultLanguage').value = defaultLanguage || 'en';
  
  // Load appearance settings
  const settings = appearanceSettings || {
    fontSize: '14px',
    maxWidth: '300px',
    hoverDelay: 3000,
    theme: 'auto'
  };
  
  document.getElementById('fontSize').value = settings.fontSize;
  document.getElementById('maxWidth').value = settings.maxWidth;
  document.getElementById('hoverDelay').value = settings.hoverDelay.toString();
  document.getElementById('theme').value = settings.theme;
  
  // Load initial history
  loadHistory();
});

// Save settings
document.getElementById('saveSettings').addEventListener('click', () => {
  const apiKey = document.getElementById('apiKey').value;
  const systemPrompt = document.getElementById('systemPrompt').value;
  const defaultLanguage = document.getElementById('defaultLanguage').value;
  
  chrome.storage.sync.set({
    openaiApiKey: apiKey,
    systemPrompt: systemPrompt,
    defaultLanguage: defaultLanguage
  }, () => {
    const status = document.getElementById('settingsStatus');
    status.textContent = 'Settings saved!';
    setTimeout(() => {
      status.textContent = '';
    }, 2000);
  });
});

// Restore default prompt
document.getElementById('restorePrompt').addEventListener('click', () => {
  document.getElementById('systemPrompt').value = DEFAULT_SYSTEM_PROMPT;
  const status = document.getElementById('settingsStatus');
  status.textContent = 'Default prompt restored! Click Save Settings to apply.';
  setTimeout(() => {
    status.textContent = '';
  }, 3000);
});

// Save appearance settings
document.getElementById('saveAppearance').addEventListener('click', () => {
  const settings = {
    fontSize: document.getElementById('fontSize').value,
    maxWidth: document.getElementById('maxWidth').value,
    hoverDelay: parseInt(document.getElementById('hoverDelay').value),
    theme: document.getElementById('theme').value
  };
  
  chrome.storage.sync.set({
    appearanceSettings: settings
  }, () => {
    const status = document.getElementById('appearanceStatus');
    status.textContent = 'Appearance settings saved!';
    setTimeout(() => {
      status.textContent = '';
    }, 2000);
    
    // Update CSS variables
    document.documentElement.style.setProperty('--gpt-font-size', settings.fontSize);
    document.documentElement.style.setProperty('--gpt-max-width', settings.maxWidth);
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