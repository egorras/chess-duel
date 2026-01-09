# Lichellange Bot

A Telegram bot for creating Lichess chess challenges directly from Telegram chat.

## Features

- Create Lichess challenges with simple commands
- Multiple time controls (1+0, 3+0, 5+3, etc.)
- Direct challenges to a specific opponent or open challenges
- Clickable links to join games instantly
- Docker support for easy deployment
- Automated deployment via GitHub Actions

## Quick Start

### Prerequisites

1. **Telegram Bot Token:**
   - Open Telegram and search for [@BotFather](https://t.me/BotFather)
   - Send `/newbot` and follow the instructions
   - Save the bot token

2. **Lichess API Key:**
   - Go to https://lichess.org/account/oauth/token
   - Create a new token with challenge creation permissions
   - Save the API key

### Local Setup

1. **Install dependencies:**
   ```bash
   cd lichellange-bot
   npm install
   ```

2. **Create `.env` file:**
   ```bash
   # Copy the example file
   cp env.example .env
   
   # Edit .env and add your credentials
   # On Windows, you can use: notepad .env
   # On Mac/Linux, you can use: nano .env
   ```

3. **Edit `.env` file with your credentials:**
   ```env
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
   LICHESS_API_KEY=your_lichess_api_key_here
   LICHESS_USERNAME=your_lichess_username
   OPPONENT_USERNAME=your_friend_lichess_username  # Optional
   PORT=3000  # Optional, defaults to 3000
   ```

4. **Run the bot:**
   ```bash
   npm start
   ```

**Alternative: Set environment variables directly**

If you prefer not to use a `.env` file, you can set environment variables directly:

**Windows (PowerShell):**
```powershell
$env:TELEGRAM_BOT_TOKEN="your_token"
$env:LICHESS_API_KEY="your_key"
$env:LICHESS_USERNAME="your_username"
$env:OPPONENT_USERNAME="friend_username"  # Optional
npm start
```

**Windows (Command Prompt):**
```cmd
set TELEGRAM_BOT_TOKEN=your_token
set LICHESS_API_KEY=your_key
set LICHESS_USERNAME=your_username
set OPPONENT_USERNAME=friend_username
npm start
```

**Mac/Linux:**
```bash
export TELEGRAM_BOT_TOKEN="your_token"
export LICHESS_API_KEY="your_key"
export LICHESS_USERNAME="your_username"
export OPPONENT_USERNAME="friend_username"  # Optional
npm start
```

## Usage

Once the bot is running, use these commands in any Telegram chat (works in both private chats and group chats):

- `/q` - **Quick 5+0 blitz challenge** (fastest way!)
- `/start` - Show help and available commands
- `/challenge 3+0` - Create a 3+0 blitz challenge
- `/challenge 5+3` - Create a 5+3 blitz challenge
- `/quick 1+0` - Quick 1+0 bullet challenge
- `/3+0` - Direct command for 3+0 challenge
- `/list` - Show all available time controls

The bot will respond with a clickable link to join the challenge on Lichess.

**Using in a private chat:**
1. Start a conversation with the bot (search for your bot's username in Telegram)
2. Type `/start` to begin, or just type `/q` for a quick challenge
3. The bot will create a challenge and send you a link
4. **Copy and share the link with your friend** - they won't see the message automatically
5. Alternatively, your friend can also message the bot separately to get their own link

**Note:** If you set `OPPONENT_USERNAME` in your `.env` file, the bot will create a direct challenge and your friend will get a notification on Lichess (but they still won't see the Telegram message).

**Using in a group chat with a friend:**
1. Add the bot to your Telegram group chat
2. Type `/q` in the chat
3. The bot will create a 5+0 blitz challenge and post a link
4. Both you and your friend can click the link to join the game on Lichess

## Docker Deployment

### Build and Run

```bash
# Build the image
docker build -t lichellange-bot .

# Run with environment variables
docker run -d \
  --name lichellange-bot \
  --restart unless-stopped \
  -e TELEGRAM_BOT_TOKEN="your_token" \
  -e LICHESS_API_KEY="your_key" \
  -e LICHESS_USERNAME="your_username" \
  -e OPPONENT_USERNAME="friend_username" \
  lichellange-bot
```

### Using Docker Compose

1. Create `.env` file:
   ```bash
   cp env.example .env
   nano .env  # Add your credentials
   ```

2. Run:
   ```bash
   docker-compose up -d
   ```

## Deployment on Oracle Cloud VM

### Manual Deployment

1. **SSH into your VM:**
   ```bash
   ssh username@your-vm-ip
   ```

2. **Install Docker:**
   ```bash
   sudo apt-get update
   sudo apt-get install -y docker.io docker-compose
   sudo systemctl start docker
   sudo systemctl enable docker
   ```

3. **Clone the repository:**
   ```bash
   git clone your-repo-url
   cd chess-duel/lichellange-bot
   ```

4. **Create `.env` file:**
   ```bash
   cp env.example .env
   nano .env  # Add your credentials
   ```

5. **Deploy:**
   ```bash
   docker-compose up -d
   ```

### Automated Deployment via GitHub Actions

The repository includes a GitHub Action that automatically deploys the bot to your VM when you push changes to the `lichellange-bot` folder.

**Setup:**

1. **Generate SSH key pair** (if you don't have one):
   ```bash
   ssh-keygen -t rsa -b 4096 -C "github-actions" -f ~/.ssh/github_actions_key
   ```
   - Copy the public key to your VM: `ssh-copy-id -i ~/.ssh/github_actions_key.pub user@your-vm-ip`
   - Or manually add `~/.ssh/github_actions_key.pub` content to `~/.ssh/authorized_keys` on the VM

2. **Add GitHub Secrets** (Settings > Secrets and variables > Actions):
   - `VM_HOST` - Your VM IP address or hostname
   - `VM_USER` - SSH username (e.g., `ubuntu`, `opc`, etc.)
   - `VM_SSH_KEY` - Private SSH key content (the private key from step 1)
   - `VM_DEPLOY_PATH` - (Optional) Deployment path on VM (default: `/home/USERNAME/lichellange-bot`)

3. **Create `.env` file on the VM:**
   ```bash
   ssh user@your-vm-ip
   mkdir -p /home/user/lichellange-bot
   cd /home/user/lichellange-bot
   # Create .env file with your credentials
   nano .env
   ```

4. **Push to main branch:**
   ```bash
   git push origin main
   ```

The GitHub Action will:
- Trigger automatically when files in `lichellange-bot/` change
- Copy files to the VM via SSH
- Deploy using Docker Compose
- Restart the bot container
- Show deployment logs

## Configuration

All configuration is done via environment variables. See `.env.example` for all available options.

### Required Variables

- `TELEGRAM_BOT_TOKEN` - Your Telegram bot token
- `LICHESS_API_KEY` - Your Lichess API key
- `LICHESS_USERNAME` - Your Lichess username

### Optional Variables

- `OPPONENT_USERNAME` - Friend's Lichess username (for direct challenges)
- `PORT` - Port for health check endpoint (default: 3000)

## Time Controls

Available time controls:
- `1+0` - Bullet 1+0
- `2+1` - Bullet 2+1
- `3+0` - Blitz 3+0
- `3+2` - Blitz 3+2
- `5+0` - Blitz 5+0
- `5+3` - Blitz 5+3
- `10+0` - Rapid 10+0
- `10+5` - Rapid 10+5

You can customize these in `index.js`.

## Health Check

The bot includes a health check endpoint on port 3000 (or `$PORT` if set):

```bash
curl http://localhost:3000/health
```

Response:
```json
{"status":"ok","bot":"running","timestamp":"2024-01-01T00:00:00.000Z"}
```

## Troubleshooting

### Bot not responding

1. **Check logs:**
   ```bash
   docker logs lichellange-bot
   ```

2. **Verify environment variables:**
   ```bash
   docker exec lichellange-bot env | grep -E "TELEGRAM|LICHESS"
   ```

3. **Test Telegram connection:**
   - Make sure your bot token is correct
   - Check if the bot is started in Telegram

### Container keeps restarting

1. **Check logs for errors:**
   ```bash
   docker logs lichellange-bot
   ```

2. **Verify all required environment variables are set**

## Security Notes

- Never commit `.env` file or environment variables to Git
- Use Docker secrets or environment files for production
- Keep your API keys secure
- Regularly rotate API keys
