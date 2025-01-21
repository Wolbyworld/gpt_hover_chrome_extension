# GPT Definition Helper Chrome Extension

A Chrome extension that provides instant definitions and translations for selected text using OpenAI's GPT-4. Get clear, concise definitions in multiple languages with just a highlight.

## Features

- 🔍 Instant definitions for highlighted text
- 🌍 Multi-language support (English, Spanish, Portuguese)
- 📚 Definition history with up to 50 entries
- 🎨 Customizable appearance settings
- 🔄 Auto-retry mechanism for API calls
- 📱 Responsive popup interface

## Installation

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory

## Configuration

1. Click the extension icon in Chrome
2. Enter your OpenAI API key in the settings
3. Customize the system prompt (optional)
4. Select your preferred language
5. Adjust appearance settings as needed

## Usage

1. Highlight any text on a webpage
2. A small popup will appear with the definition
3. Click the language icons to get translations
4. Access your definition history through the extension popup

## Technical Details

- Uses OpenAI's GPT-4 API for definitions and translations
- Built with vanilla JavaScript
- Implements Chrome Extension Manifest V3
- Features a retry mechanism for API rate limits
- Stores settings and history in Chrome's sync storage

## Requirements

- Chrome browser
- OpenAI API key
- Internet connection

## Privacy

- No data is collected or stored outside of your browser
- History is stored locally in Chrome's sync storage
- API calls are made directly to OpenAI

## License

MIT License 