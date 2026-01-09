#!/usr/bin/env node

// Load environment variables from .env file if it exists
require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const https = require('https');
const http = require('http');

// Configuration from environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const LICHESS_API_KEY = process.env.LICHESS_API_KEY;
const LICHESS_USERNAME = process.env.LICHESS_USERNAME; // Your Lichess username
const OPPONENT_USERNAME = process.env.OPPONENT_USERNAME; // Your friend's Lichess username (optional)

const LICHESS_API = 'https://lichess.org';

if (!TELEGRAM_BOT_TOKEN) {
  console.error('Error: TELEGRAM_BOT_TOKEN environment variable is required');
  console.error('Get your bot token from @BotFather on Telegram');
  process.exit(1);
}

if (!LICHESS_API_KEY) {
  console.error('Error: LICHESS_API_KEY environment variable is required');
  console.error('Get your API key from: https://lichess.org/account/oauth/token');
  process.exit(1);
}

if (!LICHESS_USERNAME) {
  console.error('Error: LICHESS_USERNAME environment variable is required');
  process.exit(1);
}

// Create a bot instance with inline mode support
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// Get bot info to handle mentions
let botUsername = null;
bot.getMe().then((me) => {
  botUsername = me.username;
  console.log(`Bot @${botUsername} is ready!`);
  // Enable inline mode
  bot.setMyCommands([
    { command: 'q', description: 'Quick 5+0 blitz challenge' },
    { command: 'start', description: 'Show help' },
    { command: 'list', description: 'Show time controls' }
  ]);
});

// Common time controls for blitz (you can customize these)
const TIME_CONTROLS = {
  '1+0': { time: 60, increment: 0, name: 'Bullet 1+0' },
  '2+1': { time: 120, increment: 1, name: 'Bullet 2+1' },
  '3+0': { time: 180, increment: 0, name: 'Blitz 3+0' },
  '3+2': { time: 180, increment: 2, name: 'Blitz 3+2' },
  '5+0': { time: 300, increment: 0, name: 'Blitz 5+0' },
  '5+3': { time: 300, increment: 3, name: 'Blitz 5+3' },
  '10+0': { time: 600, increment: 0, name: 'Rapid 10+0' },
  '10+5': { time: 600, increment: 5, name: 'Rapid 10+5' },
};

// Function to create a challenge on Lichess
function createLichessChallenge(timeControl, opponent = null) {
  return new Promise((resolve, reject) => {
    const timeControlConfig = TIME_CONTROLS[timeControl];
    if (!timeControlConfig) {
      reject(new Error(`Invalid time control: ${timeControl}`));
      return;
    }
    
    // Build form data for Lichess API (application/x-www-form-urlencoded)
    const formData = new URLSearchParams();
    formData.append('rated', 'false');
    formData.append('clock.limit', timeControlConfig.time.toString());
    formData.append('clock.increment', timeControlConfig.increment.toString());
    formData.append('color', 'random');
    formData.append('variant', 'standard');

    const postData = formData.toString();
    const options = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LICHESS_API_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    // Use /api/challenge/{username} for direct challenge or /api/challenge for open challenge
    const endpoint = opponent 
      ? `/api/challenge/${opponent}`
      : '/api/challenge';

    const req = https.request(`${LICHESS_API}${endpoint}`, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`Lichess API response: ${res.statusCode}`, data.substring(0, 200));
        if (res.statusCode === 200 || res.statusCode === 201) {
          try {
            const response = JSON.parse(data);
            console.log('Parsed response:', JSON.stringify(response).substring(0, 200));
            resolve(response);
          } catch (e) {
            console.log('Response is not JSON, treating as challenge ID:', data.trim());
            resolve({ challengeUrl: data.trim() });
          }
        } else if (res.statusCode === 401) {
          reject(new Error('Invalid Lichess API key'));
        } else if (res.statusCode === 400) {
          const errorData = data.length > 200 ? data.substring(0, 200) + '...' : data;
          reject(new Error(`Invalid request: ${errorData}`));
        } else {
          const errorData = data.length > 200 ? data.substring(0, 200) + '...' : data;
          reject(new Error(`Lichess API error ${res.statusCode}: ${errorData}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('Request error:', error);
      reject(error);
    });

    // Set timeout
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(postData);
    req.end();
  });
}

// Function to get challenge URL from challenge response
function getChallengeUrl(challengeResponse) {
  // Handle different response formats from Lichess API
  if (typeof challengeResponse === 'string') {
    // If response is a string (challenge ID), construct URL
    const challengeId = challengeResponse.trim();
    if (challengeId && challengeId.length > 0) {
      return `https://lichess.org/${challengeId}`;
    }
  }
  
  if (typeof challengeResponse === 'object') {
    // Try various possible response formats
    if (challengeResponse.challenge && challengeResponse.challenge.id) {
      return `https://lichess.org/${challengeResponse.challenge.id}`;
    }
    if (challengeResponse.url) {
      return challengeResponse.url;
    }
    if (challengeResponse.challengeUrl) {
      return challengeResponse.challengeUrl;
    }
    if (challengeResponse.id) {
      return `https://lichess.org/${challengeResponse.id}`;
    }
    // Sometimes the response might have the ID directly
    if (challengeResponse.challengeId) {
      return `https://lichess.org/${challengeResponse.challengeId}`;
    }
  }
  
  return null;
}

// Handle /start command (works with or without @mention)
bot.onText(/\/start(@\w+)?/, (msg) => {
  const chatId = msg.chat.id;
  const opponentInfo = OPPONENT_USERNAME ? `\n*Opponent:* ${OPPONENT_USERNAME}` : '';
  const welcomeMessage = `🎮 *Chess Challenge Bot*

*Commands:*
/q - Quick 5+0 blitz
/challenge <time> - Create challenge (e.g., /challenge 3+0)
/list - Show time controls
/help - Help

*Examples:*
\`/q\` - 5+0 blitz
\`/challenge 3+0\` - 3+0 blitz${opponentInfo}`;
  
  bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
});

// Handle /help command (works with or without @mention)
bot.onText(/\/help(@\w+)?/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Use /start to see available commands and examples.');
});

// Handle /list command - show available time controls (works with or without @mention)
bot.onText(/\/list(@\w+)?/, (msg) => {
  const chatId = msg.chat.id;
  let message = '*Time Controls:*\n';
  Object.entries(TIME_CONTROLS).forEach(([key, value]) => {
    message += `\`${key}\` ${value.name}\n`;
  });
  // Split message if too long (Telegram limit is 4096 chars)
  if (message.length > 4000) {
    const lines = message.split('\n');
    const firstPart = lines.slice(0, Math.floor(lines.length / 2)).join('\n');
    const secondPart = lines.slice(Math.floor(lines.length / 2)).join('\n');
    bot.sendMessage(chatId, firstPart, { parse_mode: 'Markdown' });
    bot.sendMessage(chatId, secondPart, { parse_mode: 'Markdown' });
  } else {
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  }
});

// Handle inline queries (when user types @botname in any chat)
bot.on('inline_query', async (query) => {
  const queryLower = query.query.toLowerCase().trim();
  
  // Create challenges immediately for common queries
  const results = [];
  
  // Quick 5+0 challenge
  if (!queryLower || queryLower === 'q' || queryLower === '5+0' || queryLower === '5') {
    try {
      const challengeResponse = await createLichessChallenge('5+0', OPPONENT_USERNAME || null);
      const challengeUrl = getChallengeUrl(challengeResponse);
      
      if (challengeUrl) {
        results.push({
          type: 'article',
          id: 'quick_5_0',
          title: '🎯 Quick 5+0 Blitz Challenge',
          description: 'Click to send challenge link',
          input_message_content: {
            message_text: `✅ *5+0 Blitz Challenge Created!*\n\n[🎯 Click here to join the game](${challengeUrl})`,
            parse_mode: 'Markdown',
            disable_web_page_preview: false
          }
        });
      }
    } catch (error) {
      console.error('Error creating challenge in inline query:', error);
      results.push({
        type: 'article',
        id: 'quick_5_0',
        title: '🎯 Quick 5+0 Blitz Challenge',
        description: 'Error creating challenge',
        input_message_content: {
          message_text: `❌ Error creating challenge: ${error.message.substring(0, 100)}`
        }
      });
    }
  }
  
  // 3+0 challenge
  if (!queryLower || queryLower === '3+0' || queryLower === '3') {
    try {
      const challengeResponse = await createLichessChallenge('3+0', OPPONENT_USERNAME || null);
      const challengeUrl = getChallengeUrl(challengeResponse);
      
      if (challengeUrl) {
        results.push({
          type: 'article',
          id: 'challenge_3_0',
          title: '⚡ 3+0 Blitz Challenge',
          description: 'Click to send challenge link',
          input_message_content: {
            message_text: `✅ *3+0 Blitz Challenge Created!*\n\n[🎯 Click here to join the game](${challengeUrl})`,
            parse_mode: 'Markdown',
            disable_web_page_preview: false
          }
        });
      }
    } catch (error) {
      console.error('Error creating 3+0 challenge:', error);
    }
  }
  
  // 5+3 challenge
  if (!queryLower || queryLower === '5+3' || queryLower === '53') {
    try {
      const challengeResponse = await createLichessChallenge('5+3', OPPONENT_USERNAME || null);
      const challengeUrl = getChallengeUrl(challengeResponse);
      
      if (challengeUrl) {
        results.push({
          type: 'article',
          id: 'challenge_5_3',
          title: '🔥 5+3 Blitz Challenge',
          description: 'Click to send challenge link',
          input_message_content: {
            message_text: `✅ *5+3 Blitz Challenge Created!*\n\n[🎯 Click here to join the game](${challengeUrl})`,
            parse_mode: 'Markdown',
            disable_web_page_preview: false
          }
        });
      }
    } catch (error) {
      console.error('Error creating 5+3 challenge:', error);
    }
  }
  
  // If no results (or for other queries), show default options
  if (results.length === 0) {
    results.push({
      type: 'article',
      id: 'help',
      title: '💡 How to use',
      description: 'Type: q, 5+0, 3+0, or 5+3',
      input_message_content: {
        message_text: 'Type `@botname q` for quick 5+0 challenge, or `@botname 3+0` for other time controls.',
        parse_mode: 'Markdown'
      }
    });
  }

  await bot.answerInlineQuery(query.id, results, {
    cache_time: 1 // Cache for 1 second to avoid creating duplicates
  });
});

// Handle /q command - quick 5+0 blitz challenge (works with or without @mention)
bot.onText(/^\/q(@\w+)?$/, async (msg) => {
  const chatId = msg.chat.id;
  const statusMsg = await bot.sendMessage(chatId, '⏳ Creating 5+0 blitz challenge...');

  try {
    const challengeResponse = await createLichessChallenge(
      '5+0',
      OPPONENT_USERNAME || null
    );

    const challengeUrl = getChallengeUrl(challengeResponse);

    if (challengeUrl) {
      const message = `✅ *5+0 Blitz Challenge Created!*\n\n` +
        `*Type:* ${OPPONENT_USERNAME ? 'Direct Challenge' : 'Open Challenge'}\n\n` +
        `[🎯 Click here to join the game](${challengeUrl})`;

      bot.editMessageText(message, {
        chat_id: chatId,
        message_id: statusMsg.message_id,
        parse_mode: 'Markdown',
        disable_web_page_preview: false
      });
    } else {
      bot.editMessageText(
        `✅ Challenge created, but couldn't get the URL.\n\nResponse: ${JSON.stringify(challengeResponse).substring(0, 500)}`,
        {
          chat_id: chatId,
          message_id: statusMsg.message_id
        }
      );
    }
  } catch (error) {
    console.error('Error creating challenge:', error);
    const errorMsg = error.message.length > 200 ? error.message.substring(0, 200) + '...' : error.message;
    try {
      bot.editMessageText(
        `❌ *Error creating challenge:*\n\`${errorMsg}\`\n\nCheck your Lichess API key and permissions.`,
        {
          chat_id: chatId,
          message_id: statusMsg.message_id,
          parse_mode: 'Markdown'
        }
      );
    } catch (editError) {
      // If edit fails, send a new message
      bot.sendMessage(chatId, `❌ Error: ${errorMsg}`, { parse_mode: 'Markdown' });
    }
  }
});

// Handle /challenge and /quick commands (works with or without @mention)
bot.onText(/\/(challenge|quick)(@\w+)?\s+(.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const timeControl = match[3].trim().toUpperCase();

  // Validate time control format
  if (!TIME_CONTROLS[timeControl]) {
    bot.sendMessage(
      chatId,
      `❌ Invalid time control: ${timeControl}\n\nUse /list to see available time controls.\nFormat: minutes+increment (e.g., 3+0, 5+3)`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // Send "Creating challenge..." message
  const statusMsg = await bot.sendMessage(chatId, '⏳ Creating challenge...');

  try {
    // Create challenge on Lichess
    const challengeResponse = await createLichessChallenge(
      timeControl,
      OPPONENT_USERNAME || null
    );

    const challengeUrl = getChallengeUrl(challengeResponse);
    const timeControlName = TIME_CONTROLS[timeControl].name;

    if (challengeUrl) {
      const message = `✅ *Challenge Created!*\n\n` +
        `*Time Control:* ${timeControlName} (${timeControl})\n` +
        `*Type:* ${OPPONENT_USERNAME ? 'Direct Challenge' : 'Open Challenge'}\n\n` +
        `[Click here to join the game](${challengeUrl})`;

      bot.editMessageText(message, {
        chat_id: chatId,
        message_id: statusMsg.message_id,
        parse_mode: 'Markdown',
        disable_web_page_preview: false
      });
    } else {
      bot.editMessageText(
        `✅ Challenge created, but couldn't get the URL.\n\nResponse: ${JSON.stringify(challengeResponse).substring(0, 500)}`,
        {
          chat_id: chatId,
          message_id: statusMsg.message_id
        }
      );
    }
  } catch (error) {
    console.error('Error creating challenge:', error);
    const errorMsg = error.message.length > 200 ? error.message.substring(0, 200) + '...' : error.message;
    try {
      bot.editMessageText(
        `❌ *Error creating challenge:*\n\`${errorMsg}\`\n\nCheck your Lichess API key and permissions.`,
        {
          chat_id: chatId,
          message_id: statusMsg.message_id,
          parse_mode: 'Markdown'
        }
      );
    } catch (editError) {
      // If edit fails, send a new message
      bot.sendMessage(chatId, `❌ Error: ${errorMsg}`, { parse_mode: 'Markdown' });
    }
  }
});

// Handle direct time control commands (e.g., /3+0, /5+3) (works with or without @mention)
Object.keys(TIME_CONTROLS).forEach((timeControl) => {
  bot.onText(new RegExp(`^\\/${timeControl.replace('+', '\\+')}(@\\w+)?$`), async (msg) => {
    const chatId = msg.chat.id;
    const statusMsg = await bot.sendMessage(chatId, '⏳ Creating challenge...');

    try {
      const challengeResponse = await createLichessChallenge(
        timeControl,
        OPPONENT_USERNAME || null
      );

      const challengeUrl = getChallengeUrl(challengeResponse);
      const timeControlName = TIME_CONTROLS[timeControl].name;

      if (challengeUrl) {
        const message = `✅ *Challenge Created!*\n\n` +
          `*Time Control:* ${timeControlName} (${timeControl})\n` +
          `*Type:* ${OPPONENT_USERNAME ? 'Direct Challenge' : 'Open Challenge'}\n\n` +
          `[Click here to join the game](${challengeUrl})`;

        bot.editMessageText(message, {
          chat_id: chatId,
          message_id: statusMsg.message_id,
          parse_mode: 'Markdown',
          disable_web_page_preview: false
        });
      } else {
        bot.editMessageText(
          `✅ Challenge created, but couldn't get the URL.\n\nResponse: ${JSON.stringify(challengeResponse).substring(0, 500)}`,
          {
            chat_id: chatId,
            message_id: statusMsg.message_id
          }
        );
      }
    } catch (error) {
      console.error('Error creating challenge:', error);
      bot.editMessageText(
        `❌ *Error creating challenge:*\n\`${error.message}\``,
        {
          chat_id: chatId,
          message_id: statusMsg.message_id,
          parse_mode: 'Markdown'
        }
      );
    }
  });
});

// Handle errors
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

console.log('🤖 Chess Challenge Bot is running!');
console.log(`📋 Lichess username: ${LICHESS_USERNAME}`);
if (OPPONENT_USERNAME) {
  console.log(`👤 Opponent: ${OPPONENT_USERNAME}`);
} else {
  console.log('ℹ️  No opponent configured - challenges will be open');
}

// Start HTTP server for health checks
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      bot: 'running',
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`🌐 Health check server running on port ${PORT}`);
  console.log(`   Visit http://localhost:${PORT}/health to check status`);
});
