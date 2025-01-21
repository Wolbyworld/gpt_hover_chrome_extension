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
    // Don't close if moving to a child element
    if (!e.relatedTarget || !div.contains(e.relatedTarget)) {
      startCloseTimer();
    }
  });
  
  // Prevent closing when clicking inside popover
  div.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });

  // Prevent mouseup from triggering new selection
  div.addEventListener('mouseup', (e) => {
    e.stopPropagation();
  });
  
  // Add toolbar
  const toolbar = document.createElement('div');
  toolbar.className = 'gpt-definition-toolbar';
  
  // Add copy button
  const copyButton = document.createElement('button');
  copyButton.className = 'gpt-definition-tool-btn';
  copyButton.innerHTML = '📋';
  copyButton.title = 'Copy definition';
  copyButton.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const content = div.querySelector('.gpt-definition-content').textContent;
    navigator.clipboard.writeText(content);
    copyButton.innerHTML = '✓';
    setTimeout(() => copyButton.innerHTML = '📋', 2000);
  };
  
  // Add language flags
  const languageFlags = document.createElement('div');
  languageFlags.className = 'gpt-definition-languages';
  
  const languages = {
    en: 'EN',
    es: 'ES',
    pt: 'PT'
  };
  
  Object.entries(languages).forEach(([lang, label]) => {
    const button = document.createElement('button');
    button.className = 'gpt-definition-lang-btn';
    button.textContent = label;
    button.title = `Translate to ${lang.toUpperCase()}`;
    button.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const content = div.querySelector('.gpt-definition-content').textContent;
      showLoading(div);
      
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'GET_TRANSLATION',
          text: content,
          targetLang: lang
        });
        
        const contentDiv = div.querySelector('.gpt-definition-content');
        contentDiv.textContent = response.translation;
      } catch (error) {
        const contentDiv = div.querySelector('.gpt-definition-content');
        contentDiv.textContent = 'Error translating definition';
      }
    };
    languageFlags.appendChild(button);
  });
  
  toolbar.appendChild(copyButton);
  toolbar.appendChild(languageFlags);
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'gpt-definition-content';
  
  div.appendChild(toolbar);
  div.appendChild(contentDiv);
  document.body.appendChild(div);
  return div;
}

// Get surrounding context
function getContext(selection) {
  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer;
  
  // Get surrounding text (up to 100 characters on each side)
  const fullText = container.textContent || '';
  const selectionStart = range.startOffset;
  const selectionEnd = range.endOffset;
  
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
  content.innerHTML = '<div class="gpt-definition-loading"><div></div><div></div><div></div></div>';
}

// Handle text selection
async function handleSelection(e) {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  
  if (selectedText) {
    currentSelection = {
      text: selectedText,
      context: getContext(selection),
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
        
        showLoading(popover);
        popover.style.display = 'block';
        positionPopover(popover, currentSelection.x, currentSelection.y);
        
        try {
          // Send message to background script to get definition
          const response = await chrome.runtime.sendMessage({
            type: 'GET_DEFINITION',
            text: currentSelection.text,
            context: currentSelection.context
          });
          
          const content = popover.querySelector('.gpt-definition-content');
          if (response.error) {
            content.textContent = response.error;
          } else if (response.definition) {
            content.textContent = response.definition;
          } else {
            content.textContent = 'Unexpected response format';
          }
        } catch (error) {
          console.error('Definition error:', error);
          const content = popover.querySelector('.gpt-definition-content');
          content.textContent = `Error: ${error.message || 'Failed to fetch definition. Please check your API key and connection.'}`;
        }
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
document.addEventListener('mousedown', () => {
  if (popover) {
    popover.style.display = 'none';
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