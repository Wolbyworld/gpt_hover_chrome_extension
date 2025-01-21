let hoverTimer;
let selectionTimer;
let popover = null;
let currentSelection = null;
let closeTimer = null;
const CLOSE_DELAY = 1000; // Increased to 1 second
const HOVER_BUFFER = 100; // Increased buffer zone

// Create hover indicator
function createHoverIndicator() {
  const div = document.createElement('div');
  div.className = 'gpt-hover-indicator';
  document.body.appendChild(div);
  return div;
}

// Create popover element
function createPopover() {
  const div = document.createElement('div');
  div.className = 'gpt-definition-popover';
  div.style.display = 'none';
  
  // Make popover stay open when interacting with it
  div.addEventListener('mouseenter', () => {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
  });
  
  div.addEventListener('mouseleave', (e) => {
    if (!e.relatedTarget || !div.contains(e.relatedTarget)) {
      startCloseTimer();
    }
  });
  
  div.addEventListener('mousedown', (e) => e.stopPropagation());
  div.addEventListener('mouseup', (e) => e.stopPropagation());
  
  // Create input container
  const inputContainer = document.createElement('div');
  inputContainer.className = 'gpt-input-container';
  
  // Create input field
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'gpt-prompt-input';
  input.placeholder = 'Ask anything about the selected text...';
  input.style.color = '#000000'; // Force black text color
  
  // Prevent selection clear on focus
  input.addEventListener('focus', (e) => {
    e.preventDefault();
    // Restore selection if it was cleared
    if (currentSelection && currentSelection.range) {
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(currentSelection.range);
    }
  });
  
  // Prevent mousedown from clearing selection
  input.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });
  
  // Quick actions container
  const quickActions = document.createElement('div');
  quickActions.className = 'gpt-quick-actions';
  
  // Define button
  const defineBtn = document.createElement('button');
  defineBtn.className = 'gpt-quick-action-btn';
  defineBtn.innerHTML = '📚';
  defineBtn.title = 'Define';
  defineBtn.onclick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentSelection) return;
    
    showLoading(div);
    const context = getContext(currentSelection);
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_DEFINITION',
        text: currentSelection.text,
        context: context
      });
      
      const contentDiv = div.querySelector('.gpt-definition-content');
      contentDiv.textContent = response.definition;
    } catch (error) {
      const contentDiv = div.querySelector('.gpt-definition-content');
      contentDiv.textContent = 'Error getting definition';
    }
  };
  
  // Translate button
  const translateBtn = document.createElement('button');
  translateBtn.className = 'gpt-quick-action-btn';
  translateBtn.innerHTML = '🌐';
  translateBtn.title = 'Translate';
  translateBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    input.value = `Translate this to English: `;
    input.focus();
  };
  
  // Send button
  const sendBtn = document.createElement('button');
  sendBtn.className = 'gpt-send-prompt-btn';
  sendBtn.innerHTML = '↵';
  sendBtn.title = 'Send';
  
  const handleSend = async () => {
    const prompt = input.value.trim();
    if (!prompt || !currentSelection) return;
    
    showLoading(div);
    const context = getContext(currentSelection);
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CUSTOM_PROMPT',
        prompt: prompt,
        text: currentSelection.text,
        context: context
      });
      
      const contentDiv = div.querySelector('.gpt-definition-content');
      contentDiv.textContent = response.result;
      input.value = ''; // Clear input after sending
    } catch (error) {
      const contentDiv = div.querySelector('.gpt-definition-content');
      contentDiv.textContent = 'Error processing prompt';
    }
  };
  
  sendBtn.onclick = handleSend;
  input.onkeydown = (e) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };
  
  // Add content div
  const contentDiv = document.createElement('div');
  contentDiv.className = 'gpt-definition-content';
  
  // Assemble quick actions
  quickActions.appendChild(defineBtn);
  quickActions.appendChild(translateBtn);
  
  // Assemble input container
  inputContainer.appendChild(input);
  inputContainer.appendChild(quickActions);
  inputContainer.appendChild(sendBtn);
  
  // Assemble popover
  div.appendChild(inputContainer);
  div.appendChild(contentDiv);
  
  document.body.appendChild(div);
  return div;
}

// Get surrounding context
function getContext(selection) {
  if (!selection || !selection.range) return '';
  
  const container = selection.range.commonAncestorContainer;
  
  // Get surrounding text (up to 100 characters on each side)
  const fullText = container.textContent || '';
  const selectionStart = selection.range.startOffset;
  const selectionEnd = selection.range.endOffset;
  
  const contextBefore = fullText.substring(Math.max(0, selectionStart - 100), selectionStart);
  const contextAfter = fullText.substring(selectionEnd, Math.min(fullText.length, selectionEnd + 100));
  
  return `${contextBefore}[SELECTION]${contextAfter}`;
}

// Smart position the popover
function positionPopover(popover, x, y) {
  const rect = popover.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // Default position
  let left = x;
  let top = y + 20;
  
  // Adjust if too close to right edge
  if (left + rect.width > viewportWidth - 10) {
    left = viewportWidth - rect.width - 10;
  }
  
  // Adjust if too close to bottom edge
  if (top + rect.height > viewportHeight - 10) {
    top = y - rect.height - 10;
  }
  
  // Ensure not off-screen left
  left = Math.max(10, left);
  
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
}

// Show loading animation
function showLoading(popover) {
  const content = popover.querySelector('.gpt-definition-content');
  content.textContent = ''; // Clear previous content
  content.innerHTML = '<div class="gpt-definition-loading"><div></div><div></div><div></div></div>';
}

// Check if domain is excluded
async function isDomainExcluded() {
  const { excludedDomains = [] } = await chrome.storage.sync.get(['excludedDomains']);
  const currentDomain = window.location.hostname;
  return excludedDomains.includes(currentDomain);
}

// Handle text selection
async function handleSelection(e) {
  // Check if domain is excluded
  if (await isDomainExcluded()) {
    return;
  }

  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  
  if (selectedText) {
    currentSelection = {
      text: selectedText,
      range: selection.getRangeAt(0),
      x: e.pageX,
      y: e.pageY
    };
    
    // Clear any existing timers
    clearTimeout(hoverTimer);
    clearTimeout(selectionTimer);
    
    // Create or show hover indicator
    const indicator = document.querySelector('.gpt-hover-indicator') || createHoverIndicator();
    indicator.style.display = 'block';
    indicator.style.left = `${e.pageX - 10}px`;
    indicator.style.top = `${e.pageY - 10}px`;
    
    // Start selection timer
    selectionTimer = setTimeout(() => {
      // Start hover timer
      hoverTimer = setTimeout(async () => {
        // Hide indicator
        indicator.style.display = 'none';
        
        if (!popover) {
          popover = createPopover();
        }
        
        // Clear and focus input
        const input = popover.querySelector('.gpt-prompt-input');
        input.value = '';
        popover.style.display = 'block';
        positionPopover(popover, currentSelection.x, currentSelection.y);
        input.focus();
      }, 2000); // 2 seconds hover delay
    }, 1000); // 1 second selection delay
  }
}

// Helper function to start close timer
function startCloseTimer() {
  if (!closeTimer) {
    closeTimer = setTimeout(() => {
      if (popover) {
        popover.style.display = 'none';
        // Clear content and input when closing
        const contentDiv = popover.querySelector('.gpt-definition-content');
        const input = popover.querySelector('.gpt-prompt-input');
        if (contentDiv) contentDiv.textContent = '';
        if (input) input.value = '';
      }
      closeTimer = null;
      
      // Hide hover indicator
      const indicator = document.querySelector('.gpt-hover-indicator');
      if (indicator) {
        indicator.style.display = 'none';
      }
    }, CLOSE_DELAY);
  }
}

// Track mouse movement
document.addEventListener('mousemove', (e) => {
  if (popover && popover.style.display === 'block') {
    const popoverRect = popover.getBoundingClientRect();
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    
    // Create a larger hit area around the popover
    const isOverPopover = mouseX >= popoverRect.left - HOVER_BUFFER && 
                         mouseX <= popoverRect.right + HOVER_BUFFER &&
                         mouseY >= popoverRect.top - HOVER_BUFFER && 
                         mouseY <= popoverRect.bottom + HOVER_BUFFER;
    
    // If mouse is over popover or its buffer zone, clear the close timer
    if (isOverPopover) {
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
      return;
    }
    
    // If we have a current selection, check distance from it
    if (currentSelection) {
      const distanceFromSelection = Math.sqrt(
        Math.pow(mouseX - currentSelection.x, 2) +
        Math.pow(mouseY - currentSelection.y, 2)
      );
      
      // If close to selection, keep popover open
      if (distanceFromSelection < 200) {
        if (closeTimer) {
          clearTimeout(closeTimer);
          closeTimer = null;
        }
        return;
      }
    }
    
    // If we get here, mouse is far from both popover and selection
    startCloseTimer();
  }
});

// Handle keyboard shortcut (Alt+D)
document.addEventListener('keydown', (e) => {
  if (e.altKey && e.key === 'd' && currentSelection) {
    clearTimeout(hoverTimer);
    clearTimeout(selectionTimer);
    handleSelection({
      pageX: currentSelection.x,
      pageY: currentSelection.y
    });
  }
});

document.addEventListener('mouseup', handleSelection);

// Hide popover when selection changes
document.addEventListener('mousedown', (e) => {
  // Don't clear selection if clicking inside popover
  if (popover && popover.contains(e.target)) {
    e.stopPropagation();
    return;
  }

  if (popover) {
    popover.style.display = 'none';
    // Clear content and input
    const contentDiv = popover.querySelector('.gpt-definition-content');
    const input = popover.querySelector('.gpt-prompt-input');
    if (contentDiv) contentDiv.textContent = '';
    if (input) input.value = '';
  }
  clearTimeout(hoverTimer);
  clearTimeout(selectionTimer);
  currentSelection = null;
  
  // Hide hover indicator
  const indicator = document.querySelector('.gpt-hover-indicator');
  if (indicator) {
    indicator.style.display = 'none';
  }
});

// Check if dark mode is enabled
function isDarkMode() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
} 