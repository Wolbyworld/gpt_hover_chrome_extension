// Default system prompt (now hardcoded)
const SYSTEM_PROMPT = "You are a helpful assistant that provides clear, concise responses. For any text provided, focus on the specific highlighted term/phrase. Any additional text provided is context to help you understand better. Keep responses under 100 words.";

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second
const SUPPORTED_LANGUAGES = {
  en: '🇺🇸 English',
  es: '🇪🇸 Spanish',
  pt: '🇵🇹 Portuguese'
};

// Store API key in chrome.storage
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({
    openaiApiKey: '',
    defaultLanguage: 'en',
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
        sendResponse({ definition });
      })
      .catch(error => {
        const errorMessage = getErrorMessage(error);
        sendResponse({ definition: errorMessage });
      });
    return true;
  }

  if (request.type === 'CUSTOM_PROMPT') {
    handleCustomPrompt(request.prompt, request.text, request.context)
      .then(result => {
        sendResponse({ result });
      })
      .catch(error => {
        const errorMessage = getErrorMessage(error);
        sendResponse({ result: errorMessage });
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
  const { openaiApiKey, defaultLanguage } = await chrome.storage.sync.get([
    'openaiApiKey',
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
          content: `${SYSTEM_PROMPT} ${languageInstruction}`
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

async function handleCustomPrompt(prompt, text, context) {
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
          content: SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: `${prompt}\n\nText: "${text}"\nContext: "${context || 'No context provided'}"`
        }
      ],
      max_tokens: 150,
      temperature: 0.3
    })
  });

  if (!response.ok) {
    const error = new Error('Failed to process prompt');
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
