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

2. **Configure environment variables:**
   ```bash
   export TELEGRAM_BOT_TOKEN="your_telegram_bot_token"
   export LICHESS_API_KEY="your_lichess_api_key"
   export LICHESS_USERNAME="your_lichess_username"
   export OPPONENT_USERNAME="your_friend_lichess_username"  # Optional
   ```

3. **Run the bot:**
   ```bash
   npm start
   ```

## Usage

Once the bot is running, use these commands in any Telegram chat:

- `/start` - Show help and available commands
- `/challenge 3+0` - Create a 3+0 blitz challenge
- `/challenge 5+3` - Create a 5+3 blitz challenge
- `/quick 1+0` - Quick 1+0 bullet challenge
- `/3+0` - Direct command for 3+0 challenge
- `/list` - Show all available time controls

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
