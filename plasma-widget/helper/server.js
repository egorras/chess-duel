#!/usr/bin/env node
'use strict';

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { monthBounds, calculateSummary, recentOpponents } = require('./core');

const PORT = 47831;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const CLIENT_ID = 'org.egorras.chessduel.plasma';
const WALLET = process.env.CHESS_DUEL_WALLET || 'kdewallet';
const WALLET_FOLDER = 'Chess Duel';
const WALLET_ENTRY = 'lichess-oauth-token';
const CONFIG_DIR = path.join(os.homedir(), '.config', 'chess-duel-widget');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const DEFAULT_STATS_URL = 'https://egorras.github.io/chess-duel/';

let oauth = null;
let token = null;
let config = loadConfig();
let account = config.account || null;
let state = { error: null };
let accountRetryTimer = null;

function loadConfig() {
  try { return { statsUrl: DEFAULT_STATS_URL, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) }; }
  catch { return { opponent: '', statsUrl: DEFAULT_STATS_URL }; }
}

function saveConfig() {
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(CONFIG_FILE, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}

function walletRead() {
  const result = spawnSync('kwallet-query', ['-f', WALLET_FOLDER, '-r', WALLET_ENTRY, WALLET], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '';
}

function walletWrite(value) {
  const result = spawnSync('kwallet-query', ['-f', WALLET_FOLDER, '-w', WALLET_ENTRY, WALLET], {
    input: value, encoding: 'utf8'
  });
  if (result.status !== 0) throw new Error((result.stderr || 'Could not write KDE Wallet').trim());
}

function request(method, url, bearer, body, accept = 'application/json') {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const payload = body instanceof URLSearchParams ? body.toString() : body || '';
    const headers = { Accept: accept, 'User-Agent': `${CLIENT_ID}/0.1` };
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
    if (payload) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = https.request(parsed, { method, headers }, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 429) return reject(Object.assign(new Error('Lichess rate limit; retry in one minute'), { status: 429 }));
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(Object.assign(new Error(data || `Lichess returned ${res.statusCode}`), { status: res.statusCode }));
        resolve(data);
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('Lichess request timed out')));
    if (payload) req.write(payload);
    req.end();
  });
}

async function api(method, endpoint, body, accept) {
  if (!token) throw Object.assign(new Error('Not signed in'), { status: 401 });
  return request(method, `https://lichess.org${endpoint}`, token, body, accept);
}

async function loadAccount() {
  account = JSON.parse(await api('GET', '/api/account')).username;
  config.account = account;
  saveConfig();
  state.error = null;
}

function loadAccountWithRetry() {
  clearTimeout(accountRetryTimer);
  loadAccount().catch(error => {
    state.error = error.message;
    const delay = error.status === 429 ? 60000 : 10000;
    accountRetryTimer = setTimeout(loadAccountWithRetry, delay);
  });
}

function base64url(buffer) { return buffer.toString('base64url'); }

function beginOAuth() {
  const verifier = base64url(crypto.randomBytes(48));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  const csrf = base64url(crypto.randomBytes(24));
  oauth = { verifier, csrf, created: Date.now() };
  const params = new URLSearchParams({
    response_type: 'code', client_id: CLIENT_ID,
    redirect_uri: `${ORIGIN}/oauth/callback`,
    code_challenge_method: 'S256', code_challenge: challenge,
    scope: 'challenge:read challenge:write', state: csrf
  });
  return `https://lichess.org/oauth?${params}`;
}

async function finishOAuth(url) {
  if (!oauth || Date.now() - oauth.created > 10 * 60 * 1000 || url.searchParams.get('state') !== oauth.csrf) {
    throw new Error('OAuth session expired or state did not match');
  }
  const code = url.searchParams.get('code');
  if (!code) throw new Error(url.searchParams.get('error') || 'Lichess did not return an authorization code');
  const form = new URLSearchParams({
    grant_type: 'authorization_code', code, code_verifier: oauth.verifier,
    redirect_uri: `${ORIGIN}/oauth/callback`, client_id: CLIENT_ID
  });
  const response = JSON.parse(await request('POST', 'https://lichess.org/api/token', null, form));
  walletWrite(response.access_token);
  token = response.access_token;
  oauth = null;
  loadAccountWithRetry();
}

function isConfiguredDuel(challenge) {
  if (!config.opponent || !challenge || !challenge.challenger) return false;
  return challenge.challenger.name.toLowerCase() === config.opponent.toLowerCase()
    && isConfiguredTimeStandard(challenge);
}

function configuredClock() {
  const match = String(config.timeControl || '5+0').match(/^(\d+)\+(\d+)$/);
  return { limit: Number(match[1]) * 60, increment: Number(match[2]) };
}

function isConfiguredTimeStandard(challenge) {
  const clock = challenge.timeControl || {};
  const variant = challenge.variant || {};
  const configured = configuredClock();
  return variant.key === 'standard'
    && clock.type === 'clock'
    && clock.limit === configured.limit
    && clock.increment === configured.increment;
}

async function fetchGames(since, until, max = 300) {
  const params = new URLSearchParams({ since: String(since), until: String(until), max: String(max),
    moves: 'false', clocks: 'true', evals: 'false', opening: 'false', sort: 'dateDesc' });
  const text = await api('GET', `/api/games/user/${encodeURIComponent(account)}?${params}`, null, 'application/x-ndjson');
  return text.split('\n').filter(Boolean).map(line => JSON.parse(line));
}

async function summary() {
  if (!config.opponent) throw new Error('Choose an opponent first');
  const bounds = monthBounds();
  const params = new URLSearchParams({ ...Object.fromEntries(Object.entries(bounds).map(([k, v]) => [k, String(v)])),
    vs: config.opponent, moves: 'false', clocks: 'false', evals: 'false', opening: 'false', sort: 'dateAsc' });
  const text = await api('GET', `/api/games/user/${encodeURIComponent(account)}?${params}`, null, 'application/x-ndjson');
  const games = text.split('\n').filter(Boolean).map(line => JSON.parse(line));
  return calculateSummary(games, account, config.opponent);
}

async function opponents() {
  // A short, bounded sample is enough for a recurring-opponent picker and is
  // much faster than walking months of history. Frequent opponents rank first.
  const games = await fetchGames(Date.now() - 90 * 86400000, Date.now(), 20);
  return recentOpponents(games, account, { minimumGames: 2, limit: 10 });
}

async function createChallenge() {
  if (!config.opponent) throw new Error('Choose an opponent first');
  const clock = configuredClock();
  const form = new URLSearchParams({ rated: 'false', 'clock.limit': String(clock.limit), 'clock.increment': String(clock.increment), color: 'random', variant: 'standard' });
  const response = JSON.parse(await api('POST', `/api/challenge/${encodeURIComponent(config.opponent)}`, form));
  return response.challenge || response;
}

function challengeUrl(challenge) {
  const id = challenge && (challenge.id || (challenge.challenge && challenge.challenge.id));
  if (!id) throw new Error('Lichess did not return a challenge ID');
  return `https://lichess.org/${id}`;
}

async function findOrCreateChallenge() {
  if (!config.opponent) throw new Error('Choose an opponent first');
  const listed = JSON.parse(await api('GET', '/api/challenge'));
  const incoming = (listed.in || []).find(isConfiguredDuel);
  if (incoming) {
    await api('POST', `/api/challenge/${encodeURIComponent(incoming.id)}/accept`);
    return { action: 'accepted', url: challengeUrl(incoming) };
  }

  const outgoing = (listed.out || []).find(challenge => {
    const destination = challenge.destUser || challenge.dest || {};
    return destination.name && destination.name.toLowerCase() === config.opponent.toLowerCase()
      && isConfiguredTimeStandard(challenge);
  });
  if (outgoing) return { action: 'existing', url: challengeUrl(outgoing) };

  const created = await createChallenge();
  return { action: 'created', url: challengeUrl(created) };
}

function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(value));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 65536) req.destroy(); });
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, ORIGIN);
  try {
    if (url.pathname === '/oauth/callback') {
      await finishOAuth(url);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<!doctype html><title>Chess Duel</title><h1>Signed in</h1><p>You can close this tab and return to the Plasma widget.</p>');
    }
    // A custom header cannot be submitted by a cross-origin HTML form. Combined
    // with the lack of CORS headers, this keeps arbitrary web pages from using
    // the localhost service to act on the user's Lichess account.
    if (req.headers['x-chess-duel-client'] !== 'plasma-widget') {
      return json(res, 403, { error: 'Forbidden' });
    }
    if (req.method === 'GET' && url.pathname === '/auth/start') return json(res, 200, { url: beginOAuth() });
    if (req.method === 'GET' && url.pathname === '/status') return json(res, 200, { authenticated: !!token, ready: !!account, account, opponent: config.opponent, statsUrl: config.statsUrl, ...state });
    if (req.method === 'GET' && url.pathname === '/opponents') return json(res, 200, { opponents: await opponents() });
    if (req.method === 'POST' && url.pathname === '/opponent') {
      const body = await readBody(req);
      config.opponent = String(body.opponent || '').trim();
      if (!/^[\w-]{2,30}$/.test(config.opponent)) throw Object.assign(new Error('Invalid Lichess username'), { status: 400 });
      saveConfig();
      return json(res, 200, { opponent: config.opponent });
    }
    if (req.method === 'POST' && url.pathname === '/settings') {
      const body = await readBody(req);
      const opponent = String(body.opponent || '').trim();
      const statsUrl = String(body.statsUrl || DEFAULT_STATS_URL).trim();
      const timeControl = String(body.timeControl || '5+0').trim();
      if (opponent && !/^[\w-]{2,30}$/.test(opponent)) throw Object.assign(new Error('Invalid Lichess username'), { status: 400 });
      if (!/^https?:\/\//.test(statsUrl)) throw Object.assign(new Error('Statistics URL must start with http:// or https://'), { status: 400 });
      if (!/^(1\+0|2\+1|3\+0|3\+2|5\+0|5\+3|10\+0|10\+5)$/.test(timeControl)) throw Object.assign(new Error('Unsupported time control'), { status: 400 });
      config.opponent = opponent;
      config.statsUrl = statsUrl;
      config.timeControl = timeControl;
      saveConfig();
      return json(res, 200, { opponent, statsUrl, timeControl });
    }
    if (req.method === 'GET' && url.pathname === '/summary') return json(res, 200, await summary());
    if (req.method === 'POST' && url.pathname === '/play') return json(res, 200, await findOrCreateChallenge());
    json(res, 404, { error: 'Not found' });
  } catch (error) {
    console.error(error);
    json(res, error.status || 500, { error: error.message || 'Unexpected error' });
  }
});

token = walletRead();
server.listen(PORT, '127.0.0.1', async () => {
  console.log(`Chess Duel helper listening on ${ORIGIN}`);
  if (token && !account) loadAccountWithRetry();
});
