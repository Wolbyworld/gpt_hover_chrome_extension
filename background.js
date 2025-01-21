// Default system prompt
const DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant that provides clear, concise definitions. For any text provided, focus on defining the specific highlighted term/phrase. Any additional text provided is context to help you understand the term better, but is not the target of the definition. Keep responses under 100 words.";

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second
const SUPPORTED_LANGUAGES = {
  en: '🇺🇸 English',
  es: '🇪🇸 Spanish',
  pt: '🇵🇹 Portuguese'
};

// Store API key and system prompt in chrome.storage
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({
    openaiApiKey: '',
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    defaultLanguage: 'en',
    history: [],
    appearanceSettings: {
      fontSize: '14px',
      maxWidth: '300px',
      hoverDelay: 3000,
      theme: 'auto'
    }
  });
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_DEFINITION') {
    getDefinitionWithRetry(request.text, request.context, request.targetLang)
      .then(definition => {
        // Add to history after successful lookup
        addToHistory(request.text, definition);
        sendResponse({ definition });
      })
      .catch(error => {
        const errorMessage = getErrorMessage(error);
        sendResponse({ definition: errorMessage });
      });
    return true;
  }

  if (request.type === 'GET_TRANSLATION') {
    translateDefinition(request.text, request.targetLang)
      .then(translation => sendResponse({ translation }))
      .catch(error => {
        const errorMessage = getErrorMessage(error);
        sendResponse({ translation: errorMessage });
      });
    return true;
  }

  if (request.type === 'GET_HISTORY') {
    chrome.storage.sync.get(['history'], (result) => {
      sendResponse({ history: result.history || [] });
    });
    return true;
  }
});

function getErrorMessage(error) {
  if (error.status === 429) {
    return 'Error: Rate limit exceeded. Please try again in a moment.';
  } else if (error.status === 401) {
    return 'Error: Invalid API key. Please check your settings.';
  } else if (error.message.includes('Failed to fetch')) {
    return 'Error: Network connection issue. Please check your internet connection.';
  }
  return `Error: ${error.message}`;
}

async function addToHistory(text, definition) {
  const { history = [] } = await chrome.storage.sync.get(['history']);
  const newEntry = {
    text,
    definition,
    timestamp: Date.now(),
    favorite: false
  };
  
  // Keep only last 50 entries
  const updatedHistory = [newEntry, ...history].slice(0, 50);
  await chrome.storage.sync.set({ history: updatedHistory });
}

async function getDefinitionWithRetry(text, context, targetLang = null, retryCount = 0) {
  try {
    return await getDefinition(text, context, targetLang);
  } catch (error) {
    if (retryCount < MAX_RETRIES && (error.status === 429 || error.message.includes('Failed to fetch'))) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
      return getDefinitionWithRetry(text, context, targetLang, retryCount + 1);
    }
    throw error;
  }
}

async function getDefinition(text, context, targetLang = null) {
  const { openaiApiKey, systemPrompt, defaultLanguage } = await chrome.storage.sync.get([
    'openaiApiKey',
    'systemPrompt',
    'defaultLanguage'
  ]);

  if (!openaiApiKey) {
    throw new Error('Please set your OpenAI API key in the extension settings');
  }

  const languagePrompt = targetLang || defaultLanguage;
  const languageInstruction = languagePrompt !== 'en' 
    ? `Provide the definition in ${SUPPORTED_LANGUAGES[languagePrompt].split(' ')[1]}.` 
    : '';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `${systemPrompt} ${languageInstruction}`
        },
        {
          role: 'user',
          content: `Define this term: "${text}"\nContext: "${context || 'No context provided'}"`
        }
      ],
      max_tokens: 150,
      temperature: 0.3
    })
  });

  if (!response.ok) {
    const error = new Error('Failed to fetch definition');
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

async function translateDefinition(text, targetLang) {
  const { openaiApiKey } = await chrome.storage.sync.get(['openaiApiKey']);

  if (!openaiApiKey) {
    throw new Error('Please set your OpenAI API key in the extension settings');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Translate the following text to ${SUPPORTED_LANGUAGES[targetLang].split(' ')[1]}. Maintain the same tone and style.`
        },
        {
          role: 'user',
          content: text
        }
      ],
      max_tokens: 150,
      temperature: 0.3
    })
  });

  if (!response.ok) {
    const error = new Error('Failed to translate');
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}
