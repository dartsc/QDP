# FastRTC v2.5 — The Serverless P2P Suite

FastRTC is a comprehensive **P2P Communication Suite** built on WebRTC data channel bonding. It is fully serverless, using public WebTorrent trackers for peer matchmaking.

## Core Features

- **Serverless Matchmaking**: Connects across networks using public WebTorrent trackers.
- **Bonded Channels**: Stripes data across parallel WebRTC data channels for maximum throughput.
- **File Transfer**: P2P file transfers with no size limits.
- **Messaging**: Text and binary P2P messaging.
- **HTTP Proxying**: Tunnel HTTP `fetch()` requests through the P2P connection to bypass firewalls or region blocks.
- **Audio / Video Calls**: Camera and screen-sharing via the P2P connection.
- **Data Streaming**: Continuous binary feeds with backpressure handling.

---

## 1. Getting Started

Include the bundled library from `dist/fastrtc.umd.js` or import it via ESM:

```html
<script type="module">
  import { FastRTC } from './dist/fastrtc.es.js';

  // Initialize the library
  const rtc = new FastRTC({
    dataChannels: 32, // The number of parallel bonded channels (default 32)
    isHost: false,    // Set to true if this peer provides proxy/server services like Ultraviolet or Scramjet
    requireRoomCode: false // By default, FastRTC connects globally without a code
  });

  // Listen for connection events
  rtc.on('connected', (info) => {
    // info.remoteIsHost tells you if the peer you connected to is a Host!
    console.log(`P2P connected! Remote peer isHost: ${info.remoteIsHost}`);
  });

  // Get library version
  console.log(`Initialized FastRTC v${rtc.getVersion()}`);
</script>
```

### Joining a Room

By default, FastRTC matchmakes **without a secure code**. This creates a single global P2P pool where any host can accept any client automatically.

```javascript
// Peer 1 (Host/Server): Wait for someone to join the global swarm
await rtc.joinRoom();

// Peer 2 (Client): Connect to the global swarm
await rtc.createRoom(); 
```

### Using Secure Private Room Codes
If you want to isolate your connection, you can optionally enable secure private room codes.

```javascript
const secureRtc = new FastRTC({ requireRoomCode: true });

// Peer 1 generates a secure 6-digit code
const roomCode = await secureRtc.createRoom();
console.log(`Share this code: ${roomCode}`);

// Peer 2 joins using that exact code
await secureRtc.joinRoom(roomCode);
```

*(You can also explicitly pass a manual code: `rtc.createRoom('MY-CUSTOM-SWARM')`)*

### Using Custom Tracker URLs

By default, FastRTC connects through 20 built-in public WebTorrent trackers. If you want to use your own private trackers (or a specific subset), pass the `trackerUrls` option:

```javascript
const rtc = new FastRTC({
  trackerUrls: [
    'wss://my-private-tracker.example.com/announce',
    'wss://another-tracker.example.com:8080'
  ]
});
```

When `trackerUrls` is provided, the built-in public trackers are **replaced entirely**. Both peers must use the same tracker URLs to find each other.

---

## 2. File Transfers

Send any file type directly peer-to-peer. The data is chunked and striped across all 32 channels.

```javascript
// Send a file (e.g., from an <input type="file"> event)
rtc.sendFile(fileObject);

// Track outgoing progress
rtc.on('send-start', ({ name, totalChunks }) => console.log(`Sending ${name}`));
rtc.on('progress', ({ percent }) => console.log(`${percent}% sent`));
rtc.on('send-complete', ({ name }) => console.log('Upload finished!'));

// Receive a file
rtc.on('file-incoming', ({ name, size }) => console.log(`Incoming: ${name}`));
rtc.on('file', ({ name, data }) => {
  // data is an ArrayBuffer containing the full file
  const blob = new Blob([data]);
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
});
```

---

## 3. P2P Chat / Messaging module

Send pure JSON strings or raw binary array buffers.

```javascript
// Send text
rtc.message.send("Hello from Peer 1!");

// Receive text
rtc.message.on('text', (msg) => {
  console.log(`Received message: ${msg}`);
});

// Binary messaging is also supported:
rtc.message.sendBinary(new Uint8Array([1, 2, 3]));
rtc.message.on('binary', (buffer) => { ... });
```

---

## 4. HTTP Proxy Tunnel (Bypassing Firewalls)

One of the most powerful features of FastRTC. You can set one peer as an "Exit Node" (Server), and the other peer can tunnel HTTP requests through them natively.

**Peer 1 (The Exit Node / Server)**
```javascript
// Starts listening for proxy requests from Peer 2
rtc.proxy.serve({
  allowList: [], // Optional: array of allowed domains
  blockList: []  // Optional: array of blocked domains 
});

// Stop serving
// rtc.proxy.stop();
```

**Peer 2 (The Client)**
```javascript
// The client uses rtc.proxy.fetch() exactly like the standard fetch() API!
const response = await rtc.proxy.fetch('https://httpbin.org/get', {
  method: 'GET',
  headers: {
    'Accept': 'application/json'
  }
});

const data = await response.json();
console.log(data);
```

### Proxy Options

`proxy.serve()` accepts several options to tune behavior for your transport:

```javascript
rtc.proxy.serve({
  allowList: [],        // glob patterns for allowed domains (empty = allow all)
  blockList: [],        // glob patterns for blocked domains
  chunkSize: 16384,     // body chunk size in bytes (default 16KB)
  compress: false       // gzip-compress response bodies before sending
});
```

#### Chunk Size

Response bodies are split into chunks before being sent over WebRTC data channels. The default chunk size is **16KB**, which is safe for all WebRTC implementations including `node-datachannel` ↔ browser SCTP.

If you're running browser-to-browser (both using native WebRTC), you can increase this for better throughput:

```javascript
rtc.proxy.serve({ chunkSize: 64 * 1024 });

rtc.proxy.serve();

rtc.proxy.serve({ chunkSize: 8192 });
```

#### Compression

Enable gzip compression to dramatically reduce bytes transferred over SCTP. This is especially effective for HTML/CSS/JS-heavy sites:

```javascript
rtc.proxy.serve({ compress: true });
```

Compression uses the browser/Node.js `CompressionStream` API on the server side and `DecompressionStream` on the client side. Both are available in all modern browsers and Node.js 18+. If `DecompressionStream` is unavailable on the client, the raw compressed bytes are returned as-is.

#### Ordered Chunk Reassembly

Every body chunk carries a sequence number. The client sorts chunks by sequence number before reassembly, so responses are always correct even when chunks arrive out-of-order across multiple data channels.

#### Header Stripping

The proxy server automatically strips hop-by-hop and encoding headers from responses:

- `content-encoding` — Node's fetch() auto-decompresses gzip/br/deflate but preserves the original header; forwarding it would cause double-decompression
- `transfer-encoding` — chunked encoding is handled by the proxy framing layer
- `content-length` — the compressed content-length doesn't match the decompressed body size
- `connection`, `keep-alive`, `upgrade`, `proxy-authenticate`, `proxy-authorization`, `te`, `trailer` — standard hop-by-hop headers per RFC 2616


### Running a Dedicated Proxy Host (Node.js)

Because browser-to-browser proxying is strictly bound by standard CORS limitations, to create a **true unrestricted VPN/Proxy**, you can run FastRTC in a headless Node.js environment.

By deploying a simple Node.js script to a cheap VPS (using a library like `node-datachannel` or `wrtc`), you can host a permanent 24/7 "Exit Node".

1. Start FastRTC on your Node.js server with `new FastRTC({ isHost: true })`
2. The Node.js Host calls `rtc.proxy.serve()`.
3. Your browser connects to the swarm. The `connected` event fires with `info.remoteIsHost === true`.
4. Your browser tunnels all `rtc.proxy.fetch()` traffic through the Node.js server.
5. Because the exit node is running Node.js, it fully bypasses browser CORS restrictions and can fetch any domain or API, streaming the raw response back to the browser.

### Server Mode (Optimized Proxy Connections)

When connecting to a **dedicated server** (e.g. a VPS exit node), enable `serverMode` to unlock a fully optimized proxy pipeline. This mode tunes every layer of FastRTC for maximum client↔server throughput and minimum latency.

```javascript
// Client connecting to a known dedicated server
const rtc = new FastRTC({
  serverMode: true,
  isHost: false
});

// Server-side
const server = new FastRTC({
  serverMode: true,
  isHost: true
});
server.proxy.serve();
```

**What `serverMode` changes:**

| Layer | Default | Server Mode |
|---|---|---|
| Data channels | Unordered (for P2P) | **Ordered** (eliminates reordering overhead on stable links) |
| Proxy send path | Routes through bonding engine | **Direct pool send** — bypasses bonding entirely, uses synchronous fast-path |
| Buffer high watermark | 1 MB | **512 KB** (tighter backpressure = faster push-through) |
| Buffer low watermark | 256 KB | **128 KB** (resume sooner) |
| Probe interval | 3 seconds | **8 seconds** (stable connections don't need frequent probes) |
| Body chunk size | 16 KB (configurable) | **16 KB** (safe for node-datachannel SCTP) |
| Response body sends | Sequential with sequence numbers | **Sequential** (ensures correct ordering) |
| Chunk reassembly | Sorted by sequence number | **Sorted by sequence number** |
| Bonding `sendSingle()` | Recalculates weights every call | **Round-robin fast-path**, skips weight calculation for single-destination |
| Buffer wait timeout | 5 seconds | **1.5 seconds** (fail fast on congestion) |
| Proxy request timeout | 30 seconds | **30 seconds** |

These optimizations apply automatically when `serverMode: true` is set. You can combine it with all other options:

```javascript
const rtc = new FastRTC({
  serverMode: true,
  trackerUrls: ['wss://my-tracker.example.com/announce'],
  requireRoomCode: true,
  dataChannels: 64  // Even more channels for higher aggregate throughput
});
```

---

## 5. Video / Audio Streaming

Start native WebRTC media streaming for camera, microphones, or screen shares.

```javascript
// Start the camera and get your local stream
const myStream = await rtc.media.startCamera({ video: true, audio: true });
document.getElementById('myVideo').srcObject = myStream;

// Or start a screen share
const myScreen = await rtc.media.startScreenShare();

// Receive the remote peer's stream
rtc.media.on('remoteStream', (remoteStream) => {
  document.getElementById('peerVideo').srcObject = remoteStream;
});

// Stop sending media
rtc.media.stop();
```

---

## 6. Continuous Data Streaming

If you need to push a live binary feed (e.g. game state, remote desktop pixels, live rendering), you can open a continuous named stream.

```javascript
// Peer 1: Create a stream
const stream = rtc.stream.create('live-feed');

// Write data as fast as you want (it handles backpressure automatically)
setInterval(() => {
  stream.write(new Uint8Array([ 0x01, 0x02, 0x03 ]));
}, 16); // 60 FPS tick feed

// Peer 2: Listen for chunks on the stream
rtc.stream.on('stream-feed', (chunk) => {
  console.log('Received frame:', chunk);
});
```

---

## Monitoring Link Quality

You can monitor the aggregate throughput and health of the 32 bonded channels in real-time:

```javascript
setInterval(() => {
  const stats = rtc.getStats();
  console.log(`Bonded Channels open: ${stats.openChannels}`);
  
  let totalSpeed = 0;
  for (const [id, data] of Object.entries(stats.links)) {
    totalSpeed += data.throughput; // bytes per second
  }
  
  console.log(`Aggregate Throughput: ${(totalSpeed / 1024 / 1024).toFixed(2)} MB/s`);
}, 1000);
```

## Clean Up

When you are done, cleanly disconnect the P2P mesh and the tracker arrays:
```javascript
rtc.disconnect();
```

---

## 7. Drive Traversal Signaling (Alpha)

FastRTC can use a **Google Spreadsheet** as the signaling channel instead of WebTorrent trackers. Each peer gets a unique 9-character alphanumeric column header (e.g. `439ARWI38`), and signaling messages (SDP offers, answers, ICE candidates) are written as rows under that column. The remote peer polls the sheet to read them.

This lets you integrate your own Google Drive credentials and use a shared spreadsheet as the signaling relay — no WebSocket servers or public trackers needed.

> **Alpha**: Client-side reads and writes via Google Sheets API v4.
> **Beta** (planned): Server-sent writes — the server POSTs signaling data to the sheet; clients only need read access.

### Spreadsheet Layout

| 439ARWI38 | 7BX2KM91P |
|---|---|
| `{"type":"offer","sdp":{…}}` | `{"type":"answer","sdp":{…}}` |
| `{"type":"ice-candidate","candidate":{…}}` | `{"type":"ice-candidate","candidate":{…}}` |

Row 1 = peer ID headers. Row 2+ = JSON signaling messages from that peer.

### Setup

1. Create a Google Spreadsheet and note its **Spreadsheet ID** (the long string in the URL between `/d/` and `/edit`).
2. Pick an auth mode (see below) and pass it alongside the spreadsheet ID.

#### Auth Mode 1: Raw Request (Zero Auth — client only, works from plain HTML)

Uses the browser's existing Google login cookies to write directly to the spreadsheet via Google's internal save endpoint, and reads via the public JSONP endpoint.

**Requirements:**
- You must be logged into Google in the same browser
- The spreadsheet must be shared as **"Anyone with the link can view"** (for reads)
- Extract the `token` from any save request in DevTools (one time)

**How to get the token:**
1. Open your spreadsheet in Chrome
2. Open DevTools → Network tab
3. Type something in any cell and press Enter
4. In the Network tab, find the `save?id=...` request
5. Copy the `token` query parameter value

```html
<script type="module">
  import { FastRTC } from './dist/fastrtc.es.js';

  const rtc = new FastRTC({
    driveSignal: {
      spreadsheetId: '1g0AAUVcJi5q7dwO4Tpyaqo7sx6PPBVoYAJqXjQNBzxo',
      raw: {
        token: 'AC4w5Vhz9QV0K9Z2_jRcPIAZrX3CI4X-wA:1775606624663',
        // Optional: ouid, gid, rev
      }
    }
  });

  const code = await rtc.createRoom('MY-ROOM');
</script>
```

- **Writes**: Fire-and-forget POST to the internal `docs.google.com` save endpoint with `credentials: 'include'` — the browser attaches your Google cookies automatically.
- **Reads**: JSONP script‑tag injection to the public gviz endpoint — no auth needed since the sheet is shared.

#### Auth Mode 2: Client-Only (Alpha — OAuth popup, works from plain HTML)

Provide a Google OAuth2 Client ID. DriveSignal loads Google Identity Services in the browser and presents a one-time consent dialog. Tokens auto-renew silently afterward. Works from a plain HTML file opened via `file://` or any static host.

**GCP setup** (one-time):
1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Create an **OAuth 2.0 Client ID** of type **Web application**
3. Under "Authorized JavaScript origins", add your origin (or leave blank for `file://`)
4. Copy the Client ID

```html
<script type="module">
  import { FastRTC } from './dist/fastrtc.es.js';

  const rtc = new FastRTC({
    driveSignal: {
      spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms',
      clientId: '123456789.apps.googleusercontent.com',
    }
  });

  const code = await rtc.createRoom('MY-ROOM');
</script>
```

#### Auth Mode 3: Service Account (Recommended for automation — never expires)

Create a GCP service account, download the JSON key, and share the spreadsheet with its email.

```javascript
const rtc = new FastRTC({
  driveSignal: {
    spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms',
    serviceAccount: {
      client_email: 'fastrtc@my-project.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvg...\n-----END PRIVATE KEY-----\n',
    },
  }
});

const code = await rtc.createRoom('MY-ROOM');
```

#### Auth Mode 4: Refresh Token (Never expires, user-scoped)

Provide your OAuth2 `client_id`, `client_secret`, and a long-lived `refresh_token`. DriveSignal auto-exchanges it for new access tokens every ~55 minutes:

```javascript
const rtc = new FastRTC({
  driveSignal: {
    spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms',
    clientId: '123456789.apps.googleusercontent.com',
    clientSecret: 'GOCSPX-abc123...',
    refreshToken: '1//0abc..._long_lived_refresh_token',
    pollInterval: 1500,
  }
});
```

#### Auth Mode 5: Direct Access Token (Temporary — ~60 min)

If you already have a short-lived OAuth2 access token:

```javascript
const rtc = new FastRTC({
  driveSignal: {
    spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms',
    accessToken: 'ya29.a0AfH6SM...your_oauth2_token',
  }
});
```

#### Auth Mode 6: API Key (Read-only)

If you only have a Google API key (no OAuth), a peer can read the spreadsheet but not write:

```javascript
const rtc = new FastRTC({
  driveSignal: {
    spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms',
    apiKey: 'AIzaSy...your_api_key',
  }
});
```

By default, FastRTC signals over WebTorrent trackers. Setting the `driveSignal` option switches the signaling channel to the configured Google Spreadsheet. Room creation, peer connection, file transfers, messaging, proxying works identically.

```javascript
import { DriveSignal } from 'fastrtc';

const signal = new DriveSignal('MY-ROOM', true, {
  spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms',
  clientId: '123456789.apps.googleusercontent.com',
  clientSecret: 'GOCSPX-abc123...',
  refreshToken: '1//0abc..._long_lived_refresh_token',
});

signal.onOpen = () => console.log('Sheet signaling ready');
signal.onMessage = (msg) => console.log('Received:', msg);

await signal.connect();
signal.send({ type: 'offer', sdp: localDescription });

// Clean up message rows when done
await signal.cleanup();
signal.close();
```

### Configuration Options

| Option | Type | Default | Description |
|---|---|---|---|
| `spreadsheetId` | string | *required* | Google Spreadsheet ID |
| `raw` | object | — | `{ token, ouid?, gid?, rev? }` — Zero-auth raw request mode. Uses browser cookies. |
| `clientId` | string | — | OAuth2 client ID. **Alone** = client-only browser popup auth (no server). With `clientSecret` + `refreshToken` = refresh flow. |
| `serviceAccount` | object | — | `{ client_email, private_key }` from a GCP service account JSON key |
| `clientSecret` | string | — | OAuth2 client secret (only needed for refresh token flow) |
| `refreshToken` | string | — | Long-lived refresh token (requires clientId + clientSecret) |
| `accessToken` | string | — | Direct OAuth2 access token (temporary, ~60 min) |
| `apiKey` | string | — | API key (read-only fallback) |
| `pollInterval` | number | `1500` | Polling frequency in milliseconds |
| `sheetName` | string | room code | Sheet tab name (one tab per room) |
