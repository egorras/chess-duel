#!/usr/bin/env node

const TelegramBot = require('node-telegram-bot-api');
const https = require('https');
const http = require('http');

// Configuration from environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const LICHESS_API_KEY = process.env.LICHESS_API_KEY;
const LICHESS_USERNAME = process.env.LICHESS_USERNAME; // Your Lichess username
const OPPONENT_USERNAME = process.env.OPPONENT_USERNAME; // Your friend's Lichess username (optional)

const LICHESS_API = 'https://lichess.org/api';

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

// Create a bot instance
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

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
    
    const challengeData = {
      rated: false, // Unrated games (you can change to true for rated)
      clock: {
        limit: timeControlConfig.time, // Time in seconds
        increment: timeControlConfig.increment // Increment in seconds
      },
      color: 'random', // 'white', 'black', or 'random'
      variant: 'standard' // 'standard', 'chess960', etc.
    };

    // If opponent is specified, create a direct challenge
    if (opponent) {
      challengeData.users = [opponent];
    }

    const postData = JSON.stringify(challengeData);
    const options = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LICHESS_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    // Use /api/challenge/open for open challenge or /api/challenge/{username} for direct challenge
    const endpoint = opponent 
      ? `/api/challenge/${opponent}`
      : '/api/challenge/open';

    const req = https.request(`${LICHESS_API}${endpoint}`, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          try {
            const response = JSON.parse(data);
            resolve(response);
          } catch (e) {
            resolve({ challengeUrl: data.trim() });
          }
        } else if (res.statusCode === 401) {
          reject(new Error('Invalid Lichess API key'));
        } else if (res.statusCode === 400) {
          reject(new Error(`Invalid request: ${data}`));
        } else {
          reject(new Error(`Lichess API error: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
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

// Handle /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const welcomeMessage = `
🎮 *Chess Challenge Bot*

I can help you create Lichess challenges quickly!

*Available commands:*
/challenge <time> - Create a challenge (e.g., /challenge 3+0)
/quick <time> - Quick challenge (e.g., /quick 5+3)
/list - Show available time controls
/help - Show this help message

*Examples:*
\`/challenge 3+0\` - Create a 3+0 blitz challenge
\`/challenge 5+3\` - Create a 5+3 blitz challenge
\`/quick 1+0\` - Quick 1+0 bullet challenge

${OPPONENT_USERNAME ? `*Opponent:* ${OPPONENT_USERNAME} (configured)` : '*Note:* Add OPPONENT_USERNAME env var to create direct challenges'}
  `;
  
  bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
});

// Handle /help command
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Use /start to see available commands and examples.');
});

// Handle /list command - show available time controls
bot.onText(/\/list/, (msg) => {
  const chatId = msg.chat.id;
  let message = '*Available Time Controls:*\n\n';
  Object.entries(TIME_CONTROLS).forEach(([key, value]) => {
    message += `\`${key}\` - ${value.name}\n`;
  });
  bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
});

// Handle /challenge and /quick commands
bot.onText(/\/(challenge|quick)\s+(.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const timeControl = match[2].trim().toUpperCase();

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
        `✅ Challenge created, but couldn't get the URL.\n\nResponse: ${JSON.stringify(challengeResponse)}`,
        {
          chat_id: chatId,
          message_id: statusMsg.message_id
        }
      );
    }
  } catch (error) {
    console.error('Error creating challenge:', error);
    bot.editMessageText(
      `❌ *Error creating challenge:*\n\`${error.message}\`\n\nMake sure your Lichess API key is valid and has challenge creation permissions.`,
      {
        chat_id: chatId,
        message_id: statusMsg.message_id,
        parse_mode: 'Markdown'
      }
    );
  }
});

// Handle direct time control commands (e.g., /3+0, /5+3)
Object.keys(TIME_CONTROLS).forEach((timeControl) => {
  bot.onText(new RegExp(`^\\/${timeControl.replace('+', '\\+')}$`), async (msg) => {
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
          `✅ Challenge created, but couldn't get the URL.\n\nResponse: ${JSON.stringify(challengeResponse)}`,
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
