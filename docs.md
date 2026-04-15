# QDP v3.0 — The Serverless P2P Suite

QDP (**Quick Datagram Protocol**) is a comprehensive **P2P Communication Suite** built on WebRTC data channel bonding with multi-transport signaling. It is fully serverless, supporting **WebTorrent trackers**, **MQTT brokers**, and **STUN servers** as interchangeable (and bondable) transport layers.

> Formerly known as SpeedRTC. The protocol has been renamed to **QDP** — **Q**uick **D**atagram **P**rotocol — to reflect its focus on speed-first P2P data transfer. Like TCP (Transmission Control Protocol) and UDP (User Datagram Protocol), each word describes it, its quick (multi-path striped bonding for maximum throughput), its data unit is a framed *datagram*, and it's a *protocol*.

## Core Features

- **Multi-Transport Signaling**: Connect via WebTorrent trackers, MQTT brokers, or STUN — or bond them all together.
- **Bonded Channels**: Stripes data across parallel WebRTC data channels for maximum throughput.
- **MQTT Transport** *(Beta)*: Use MQTT as a standalone signaling and data transport layer.
- **Transport Bonding** *(Alpha)*: Bond MQTT + STUN + WebTorrent trackers together for redundant, faster connections.
- **File Transfer**: P2P file transfers with no size limits.
- **Messaging**: Text and binary P2P messaging.
- **HTTP Proxying**: Tunnel HTTP `fetch()` requests through the P2P connection to bypass firewalls or region blocks.
- **Audio / Video Calls**: Camera and screen-sharing via WebRTC media tracks, with MQTT-assisted signaling.
- **Data Streaming**: Continuous binary feeds with backpressure handling.

---

## 1. Getting Started

Include the bundled library from `dist/QDP.umd.js` or import it via ESM:

```html
<script type="module">
  import { QDP } from './dist/QDP.es.js';

  const rtc = new QDP({
    dataChannels: 32,
    isHost: false,
    requireRoomCode: false
  });

  rtc.on('connected', (info) => {
    console.log(`P2P connected! Remote peer isHost: ${info.remoteIsHost}`);
  });

  console.log(`Initialized QDP v${rtc.getVersion()}`);
</script>
```

### Joining a Room

By default, QDP matchmakes **without a secure code**. This creates a single global P2P pool where any host can accept any client automatically.

```javascript
await rtc.joinRoom();

await rtc.createRoom(); 
```

### Using Secure Private Room Codes
If you want to isolate your connection, you can optionally enable secure private room codes.

```javascript
const secureRtc = new QDP({ requireRoomCode: true });

const roomCode = await secureRtc.createRoom();
console.log(`Share this code: ${roomCode}`);

await secureRtc.joinRoom(roomCode);
```

*(You can also explicitly pass a manual code: `rtc.createRoom('MY-CUSTOM-SWARM')`)*

### Using Custom Tracker URLs

By default, QDP connects through 20 built-in public WebTorrent trackers. If you want to use your own private trackers (or a specific subset), pass the `trackerUrls` option:

```javascript
const rtc = new QDP({
  trackerUrls: [
    'wss://my-private-tracker.example.com/announce',
    'wss://another-tracker.example.com:8080'
  ]
});
```

When `trackerUrls` is provided, the built-in public trackers are **replaced entirely**. Both peers must use the same tracker URLs to find each other.

### Using MQTT Transport (Beta)

QDP can use an **MQTT broker** as the signaling and data transport layer instead of (or alongside) WebTorrent trackers. MQTT provides lower-latency signaling via persistent pub/sub connections, reliable message delivery with QoS levels, and works in environments where WebSocket tracker connections are blocked.

```javascript
const rtc = new QDP({
  mqtt: {
    brokerUrl: 'wss://broker.hivemq.com:8884/mqtt',
    username: 'myuser',
    password: 'mypass',
  }
});

const code = await rtc.createRoom();
```

When `mqtt` is provided **without** `trackerUrls`, MQTT is used as the **sole transport**. Signaling messages (SDP, ICE candidates) are published/subscribed via MQTT topics. WebRTC data channels are still used for the actual P2P data transfer once the connection is established.

**MQTT as data-only transport (Beta):**

In environments where WebRTC is unavailable or blocked, MQTT can also serve as the **data transport** itself — all messages, file chunks, and proxy traffic flow through the MQTT broker:

```javascript
const rtc = new QDP({
  mqtt: {
    brokerUrl: 'wss://broker.hivemq.com:8884/mqtt',
    dataTransport: true,
    qos: 1,
  }
});
```

> **Note:** MQTT data transport has higher latency than WebRTC data channels since traffic routes through the broker. Use this as a fallback when NAT traversal fails or in restricted network environments.

**Public MQTT Brokers (for testing):**

| Broker | URL |
|---|---|
| HiveMQ | `wss://broker.hivemq.com:8884/mqtt` |
| EMQX | `wss://broker.emqx.io:8084/mqtt` |
| Mosquitto | `wss://test.mosquitto.org:8081` |

### Transport Bonding — MQTT + Trackers + STUN (Alpha)

QDP can **bond multiple transport layers together** for maximum connection reliability and speed. When multiple transports are configured, QDP races them in parallel during signaling and bonds them during data transfer:

```javascript
const rtc = new QDP({
  trackerUrls: [
    'wss://tracker.openwebtorrent.com',
    'wss://tracker.novage.com.ua',
  ],
  mqtt: {
    brokerUrl: 'wss://broker.hivemq.com:8884/mqtt',
    dataTransport: true,
  },
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'turn:my-turn.example.com:3478', username: 'user', credential: 'pass' },
  ],
  bondTransports: true,
});
```

**How transport bonding works:**

1. **Signaling race**: During `createRoom()` / `joinRoom()`, QDP sends signaling messages through ALL configured transports simultaneously. The first successful signaling path wins, but all paths remain active.
2. **Parallel ICE**: ICE candidates from STUN/TURN are combined with relay candidates from MQTT/trackers.
3. **Data bonding**: When `mqtt.dataTransport: true` and WebRTC data channels are both available, QDP stripes data across **both** transports using the bonding engine — the same weighted round-robin algorithm used for multi-channel WebRTC bonding. The monitor measures throughput per-transport and shifts weight toward the faster path.
4. **Failover**: If one transport dies (e.g., a tracker WebSocket drops), traffic automatically shifts to the remaining transports with zero interruption.

**Transport bonding modes:**

| Mode | Config | Behavior |
|---|---|---|
| Tracker only | `trackerUrls` only | Default — classic WebTorrent tracker signaling |
| MQTT only | `mqtt` only | MQTT signaling, WebRTC data channels |
| MQTT data | `mqtt.dataTransport: true` | MQTT for both signaling AND data |
| Bonded signaling | `trackerUrls` + `mqtt` | Race signaling across both, WebRTC data channels |
| Full bond | `trackerUrls` + `mqtt.dataTransport` + `bondTransports` | Bond all transports for signaling AND data |

> **Alpha warning:** Transport bonding is experimental. The bonding engine dynamically weights transports by throughput, but mixed-transport latency jitter may cause reordering. Chunk sequence numbers ensure correct reassembly regardless.

---

## 2. File Transfers

Send any file type directly peer-to-peer. The data is chunked and striped across all 32 channels.

```javascript
rtc.sendFile(fileObject);

rtc.on('send-start', ({ name, totalChunks }) => console.log(`Sending ${name}`));
rtc.on('progress', ({ percent }) => console.log(`${percent}% sent`));
rtc.on('send-complete', ({ name }) => console.log('Upload finished!'));

rtc.on('file-incoming', ({ name, size }) => console.log(`Incoming: ${name}`));
rtc.on('file', ({ name, data }) => {
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
rtc.message.send("Hello from Peer 1!");

rtc.message.on('text', (msg) => {
  console.log(`Received message: ${msg}`);
});

rtc.message.sendBinary(new Uint8Array([1, 2, 3]));
rtc.message.on('binary', (buffer) => { ... });
```

---

## 4. HTTP Proxy Tunnel (Bypassing Firewalls)

One of the most powerful features of QDP. You can set one peer as an "Exit Node" (Server), and the other peer can tunnel HTTP requests through them natively.

**Peer 1 (The Exit Node / Server)**
```javascript
rtc.proxy.serve({
  allowList: [],
  blockList: []
});
```

**Peer 2 (The Client)**
```javascript
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
  allowList: [],        
  blockList: [],
  chunkSize: 16384,
  compress: false
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

Because browser-to-browser proxying is strictly bound by standard CORS limitations, to create a **true unrestricted VPN/Proxy**, you can run QDP in a headless Node.js environment.

By deploying a simple Node.js script to a cheap VPS (using a library like `node-datachannel` or `wrtc`), you can host a permanent 24/7 "Exit Node".

1. Start QDP on your Node.js server with `new QDP({ isHost: true })`
2. The Node.js Host calls `rtc.proxy.serve()`.
3. Your browser connects to the swarm. The `connected` event fires with `info.remoteIsHost === true`.
4. Your browser tunnels all `rtc.proxy.fetch()` traffic through the Node.js server.
5. Because the exit node is running Node.js, it fully bypasses browser CORS restrictions and can fetch any domain or API, streaming the raw response back to the browser.

### Server Mode (Optimized Proxy Connections)

When connecting to a **dedicated server** (e.g. a VPS exit node), enable `serverMode` to unlock a fully optimized proxy pipeline. This mode tunes every layer of QDP for maximum client↔server throughput and minimum latency.

```javascript
const rtc = new QDP({
  serverMode: true,
  isHost: false
});

const server = new QDP({
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
const rtc = new QDP({
  serverMode: true,
  trackerUrls: ['wss://my-tracker.example.com/announce'],
  requireRoomCode: true,
  dataChannels: 64
});
```

---

## 5. Video / Audio Streaming

Start native WebRTC media streaming for camera, microphones, or screen shares.

```javascript
const myStream = await rtc.media.startCamera({ video: true, audio: true });
document.getElementById('myVideo').srcObject = myStream;

const myScreen = await rtc.media.startScreenShare();

rtc.media.on('remoteStream', (remoteStream) => {
  document.getElementById('peerVideo').srcObject = remoteStream;
});

rtc.media.stop();
```

---

## 6. Continuous Data Streaming

If you need to push a live binary feed (e.g. game state, remote desktop pixels, live rendering), you can open a continuous named stream.

```javascript
const stream = rtc.stream.create('live-feed');

setInterval(() => {
  stream.write(new Uint8Array([ 0x01, 0x02, 0x03 ]));
}, 16);

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
    totalSpeed += data.throughput;
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

## 8. MQTT Transport (Beta)

QDP supports MQTT as a first-class transport layer. MQTT brokers provide reliable pub/sub messaging over WebSockets, making them ideal for both signaling and data relay.

### MQTT Signaling

When configured, QDP publishes and subscribes to room-specific MQTT topics for peer discovery and WebRTC signaling:

| Topic | Purpose |
|---|---|
| `QDP/{roomCode}/announce` | Peer presence announcements |
| `QDP/{roomCode}/offer/{peerId}` | SDP offers targeted to a specific peer |
| `QDP/{roomCode}/answer/{peerId}` | SDP answers |
| `QDP/{roomCode}/ice/{peerId}` | ICE candidates |

Messages are published with configurable QoS (default: 1 — at least once delivery). Topics use `retain: false` to avoid stale signaling data.

### MQTT Data Transport

When `dataTransport: true`, QDP opens additional MQTT topics for chunked binary data transfer:

| Topic | Purpose |
|---|---|
| `QDP/{roomCode}/data/{peerId}` | Binary chunk stream |
| `QDP/{roomCode}/proxy/{peerId}` | Proxy protocol frames |
| `QDP/{roomCode}/msg/{peerId}` | Text/binary messages |

The same `ChunkProtocol` framing used for WebRTC data channels is applied to MQTT payloads, so file transfers, proxy tunneling, and messaging work identically over MQTT.

### MQTT for Video/Audio Signaling

WebRTC media tracks (camera, microphone, screen share) require a signaling path to exchange SDP offers/answers and ICE candidates. When MQTT is configured, QDP uses the MQTT broker for all media negotiation:

```javascript
const rtc = new QDP({
  mqtt: {
    brokerUrl: 'wss://broker.hivemq.com:8884/mqtt',
  }
});

await rtc.createRoom();
const myStream = await rtc.media.startCamera({ video: true, audio: true });
```

> **Note:** The actual audio/video data flows over WebRTC media tracks (RTP/SRTP), not MQTT. MQTT is used only for the signaling handshake (SDP + ICE) needed to establish the media connection. This is the standard WebRTC architecture — MQTT replaces the signaling server.

### MQTT Configuration Reference

| Option | Type | Default | Description |
|---|---|---|---|
| `mqtt.brokerUrl` | string | *required* | MQTT broker WebSocket URL (must be `wss://` or `ws://`) |
| `mqtt.username` | string | — | Broker authentication username |
| `mqtt.password` | string | — | Broker authentication password |
| `mqtt.clientId` | string | auto-generated | MQTT client ID (auto-generated if omitted) |
| `mqtt.dataTransport` | boolean | `false` | Use MQTT as a data transport in addition to signaling |
| `mqtt.qos` | number | `1` | MQTT QoS level: 0, 1, or 2 |
| `mqtt.keepalive` | number | `30` | Keep-alive interval in seconds |
| `mqtt.topicPrefix` | string | `'QDP'` | Custom topic prefix for namespace isolation |

---

## 9. Transport Bonding (Alpha)

QDP's bonding engine can stripe data across **heterogeneous transports** — not just parallel WebRTC data channels, but across WebRTC + MQTT + future transports simultaneously.

### How It Works

The `ConnectionMonitor` measures throughput, latency, and packet loss per transport link. The `BondingEngine` uses weighted round-robin scheduling to distribute chunks across all available paths:

```
┌─────────────────────────────────────────────────┐
│                  BondingEngine                   │
│  Weighted Round-Robin Scheduler                  │
├────────────────┬────────────────┬────────────────┤
│ WebRTC DC #0-31│  MQTT Broker   │  Future Txport │
│  (32 channels) │  (1 topic)     │                │
│  Weight: 0.75  │  Weight: 0.25  │  Weight: 0.00  │
└────────────────┴────────────────┴────────────────┘
```

The bonding engine dynamically rebalances weights based on real-time throughput measurements. If one transport degrades, traffic shifts automatically.

### Signaling Race

During connection setup, QDP races signaling across all configured transports:

```
Peer A                                              Peer B
  │                                                    │
  ├──[Tracker] ──offer──→  (arrives 2nd)               │
  ├──[MQTT]    ──offer──→  (arrives 1st) ──→ accepted  │
  │                                                    │
  │  ←──answer──[MQTT]────────────────────────────────┤
  │  ←──answer──[Tracker]── (ignored, already paired)  │
```

The first transport to complete the signaling handshake wins. All transports remain available for data bonding.

### Configuration

```javascript
const rtc = new QDP({
  trackerUrls: ['wss://tracker.openwebtorrent.com'],
  mqtt: {
    brokerUrl: 'wss://broker.hivemq.com:8884/mqtt',
    dataTransport: true,
  },
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
  ],
  bondTransports: true,
});
```

### Selective Transport Bonding

Instead of bonding **all** transports, you can pass an array of transport type strings to `bondTransports` to pick exactly which ones to combine:

```javascript
const rtc = new QDP({
  mqtt: {
    brokerUrl: 'wss://broker.hivemq.com:8884/mqtt',
    dataTransport: true,
  },
  srtp: {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  },
  icmp: {
    targetIp: '203.0.113.50',
    strategy: 'relay',
    relayUrl: 'wss://my-icmp-relay.example.com/icmp',
  },
  bondTransports: ['srtp', 'mqtt'],
});
```

Transports not listed in the array still connect normally (signaling, media, etc.) but are **excluded from the bonding engine's data striping**. This is useful when you want to isolate specific transports for data transfer while keeping others active for signaling or latency probing.

**Valid transport type strings:**

| String | Transport |
|---|---|
| `'webrtc'` or `'dc'` | WebRTC data channels (dc-0 through dc-31) |
| `'mqtt'` | MQTT broker data transport |
| `'webtransport'` | WebTransport |
| `'icmp'` | ICMP transport |
| `'srtp'` | SRTP transport |

**`bondTransports` values:**

| Value | Behavior |
|---|---|
| `true` | Bond all connected transports together |
| `['srtp', 'mqtt']` | Bond only SRTP and MQTT — other transports are not striped |
| `['webrtc', 'icmp']` | Bond only WebRTC data channels and ICMP |
| `false` (default) | No cross-transport bonding; data flows through WebRTC data channels only |

**Example — MQTT + ICMP only (no WebRTC data):**

```javascript
const rtc = new QDP({
  mqtt: {
    brokerUrl: 'wss://broker.hivemq.com:8884/mqtt',
    dataTransport: true,
  },
  icmp: {
    targetIp: '10.0.0.2',
    strategy: 'relay',
    relayUrl: 'wss://relay.example.com/icmp',
  },
  bondTransports: ['mqtt', 'icmp'],
});
```

**Example — All five transports bonded:**

```javascript
const rtc = new QDP({
  mqtt: { brokerUrl: 'wss://broker.hivemq.com:8884/mqtt', dataTransport: true },
  srtp: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] },
  icmp: { targetIp: '203.0.113.50', strategy: 'relay', relayUrl: 'wss://relay.example.com/icmp' },
  webTransport: { url: 'https://webtransport.example.com' },
  bondTransports: true,
});
```

---

## 10. Drive Traversal Signaling (Beta)

QDP can use a **Google Spreadsheet** as the signaling channel instead of WebTorrent trackers. Each peer gets a unique 9-character alphanumeric column header (e.g. `439ARWI38`), and signaling messages (SDP offers, answers, ICE candidates) are written as rows under that column. The remote peer polls the sheet to read them.

This lets you integrate your own Google Drive credentials and use a shared spreadsheet as the signaling relay — no WebSocket servers or public trackers needed.

> **Beta**: Client-side reads and writes via Google Sheets API v4. Server-sent writes are supported — the server POSTs signaling data to the sheet; clients only need read access.

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
  import { QDP } from './dist/QDP.es.js';

  const rtc = new QDP({
    driveSignal: {
      spreadsheetId: '1g0AAUVcJi5q7dwO4Tpyaqo7sx6PPBVoYAJqXjQNBzxo',
      raw: {
        token: 'AC4w5Vhz9QV0K9Z2_jRcPIAZrX3CI4X-wA:1775606624663',

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
  import { QDP } from './dist/QDP.es.js';

  const rtc = new QDP({
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
const rtc = new QDP({
  driveSignal: {
    spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms',
    serviceAccount: {
      client_email: 'QDP@my-project.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvg...\n-----END PRIVATE KEY-----\n',
    },
  }
});

const code = await rtc.createRoom('MY-ROOM');
```

#### Auth Mode 4: Refresh Token (Never expires, user-scoped)

Provide your OAuth2 `client_id`, `client_secret`, and a long-lived `refresh_token`. DriveSignal auto-exchanges it for new access tokens every ~55 minutes:

```javascript
const rtc = new QDP({
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
const rtc = new QDP({
  driveSignal: {
    spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms',
    accessToken: 'ya29.a0AfH6SM...your_oauth2_token',
  }
});
```

#### Auth Mode 6: API Key (Read-only)

If you only have a Google API key (no OAuth), a peer can read the spreadsheet but not write:

```javascript
const rtc = new QDP({
  driveSignal: {
    spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms',
    apiKey: 'AIzaSy...your_api_key',
  }
});
```

By default, QDP signals over WebTorrent trackers. Setting the `driveSignal` option switches the signaling channel to the configured Google Spreadsheet. Room creation, peer connection, file transfers, messaging, proxying works identically.

```javascript
import { DriveSignal } from 'QDP';

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

---

## 11. ICMP Transport (Alpha)

QDP can tunnel data through **ICMP Echo Request/Reply** (ping) packets, providing a transport path that works even when TCP and UDP are blocked. This is an **alpha** transport with four pluggable strategies for different runtime environments.

> **Alpha**: Experimental transport. APIs and behavior may change. Not recommended for production use.

### Strategies

| Strategy | Environment | How It Works |
|---|---|---|
| `relay` | Browser / Node.js | A WebSocket connection to an ICMP relay server which crafts and receives raw ICMP packets on your behalf |
| `native-bridge` | Android (JNI) / Linux | Calls a native bridge function (e.g. JNI or shell `ping`) to send/receive ICMP directly |
| `wasi` | WASI runtimes | Uses WASI socket APIs to open a raw ICMP socket |
| `pseudo-ping` | Browser (latency only) | Measures round-trip latency by loading a 1×1 image from the target IP; no data payload transfer |

### Quick Start — Relay Strategy

The relay strategy is the most portable. It requires a WebSocket relay server that accepts data payloads and wraps them in ICMP Echo packets.

```javascript
import { QDP } from 'qdp';

const rtc = new QDP({
  icmp: {
    targetIp: '203.0.113.50',
    strategy: 'relay',
    relayUrl: 'wss://my-icmp-relay.example.com/icmp',
  },
});

const code = await rtc.createRoom();
```

Once the peer connects, QDP automatically starts the ICMP transport and bonds it alongside WebRTC data channels. The bonding engine assigns it link ID `icmp-0`.

### Quick Start — Native Bridge Strategy

For Android (via JNI) or Linux (via shell), provide a `nativeBridge` object with `send(packetBytes)` and register an `onReceive(callback)`:

```javascript
import { QDP } from 'qdp';

const bridge = {
  send(packetBytes) {
    NativeICMP.sendRawPacket(packetBytes);
  },
  onReceive(callback) {
    NativeICMP.registerListener((data) => callback(new Uint8Array(data)));
  },
};

const rtc = new QDP({
  icmp: {
    targetIp: '10.0.0.2',
    strategy: 'native-bridge',
    nativeBridge: bridge,
  },
});

const code = await rtc.createRoom();
```

### Quick Start — WASI Strategy

For WASI-compatible runtimes that expose raw socket APIs:

```javascript
import { QDP } from 'qdp';

const rtc = new QDP({
  icmp: {
    targetIp: '192.168.1.100',
    strategy: 'wasi',
  },
});

const code = await rtc.createRoom();
```

### Quick Start — Pseudo-Ping Strategy (Latency Only)

The pseudo-ping strategy does not carry data. It measures round-trip latency by loading a tiny image from the target. Useful for selecting the best path when combined with other transports.

```javascript
import { QDP } from 'qdp';

const rtc = new QDP({
  icmp: {
    targetIp: '203.0.113.50',
    strategy: 'pseudo-ping',
    pingInterval: 2000,
  },
});

rtc.on('icmp-latency', ({ latency }) => {
  console.log(`Ping latency: ${latency}ms`);
});

const code = await rtc.createRoom();
```

### Standalone Usage

```javascript
import { ICMPTransport, ICMP_STRATEGY } from 'qdp';

const transport = new ICMPTransport({
  targetIp: '203.0.113.50',
  strategy: ICMP_STRATEGY.RELAY,
  relayUrl: 'wss://my-icmp-relay.example.com/icmp',
  roomCode: 'MY-ROOM',
  localPeerId: 'peer-a',
  remotePeerId: 'peer-b',
  onData: (data) => console.log('Received:', data),
  onOpen: () => console.log('ICMP connected'),
  onClose: () => console.log('ICMP closed'),
  onLatency: ({ latency }) => console.log(`RTT: ${latency}ms`),
});

await transport.connect();
await transport.send(new TextEncoder().encode('hello via ICMP'));
transport.close();
```

### Events

| Event | Payload | Description |
|---|---|---|
| `transport-added` | `{ type: 'icmp', linkId: 'icmp-0' }` | ICMP transport connected and added to bonding |
| `transport-removed` | `{ type: 'icmp', linkId: 'icmp-0' }` | ICMP transport disconnected |
| `icmp-latency` | `{ latency: <number> }` | Round-trip latency measurement (all strategies) |

### Configuration Options

| Option | Type | Default | Description |
|---|---|---|---|
| `targetIp` | string | *required* | Target IP address for ICMP packets |
| `strategy` | string | `'relay'` | Transport strategy: `'relay'`, `'native-bridge'`, `'wasi'`, `'pseudo-ping'` |
| `relayUrl` | string | — | WebSocket URL of the ICMP relay server (relay strategy only) |
| `nativeBridge` | object | — | Object with `send(bytes)` and `onReceive(cb)` functions (native-bridge strategy only) |
| `identifier` | number | random | ICMP echo identifier (0–65535) |
| `pingInterval` | number | `1000` | Interval between pings in milliseconds (pseudo-ping strategy) |

---

## 12. SRTP Transport (Alpha)

QDP can tunnel data through **SRTP-encrypted RTP media streams**, piggybacking on WebRTC's built-in media encryption. This creates a separate RTCPeerConnection with a fake audio track and uses the **Encoded Transforms API** (`RTCRtpSender.readable/writable`) to inject and extract arbitrary data payloads through the encrypted RTP pipeline.

> **Alpha**: Experimental transport. Requires a browser with Encoded Transforms API support (Chrome 86+, Edge 86+). APIs may change.

### How It Works

1. A new RTCPeerConnection is created (separate from QDP's main connection)
2. A silent audio track is added (inaudible oscillator at zero gain)
3. The Encoded Transforms API intercepts outgoing RTP frames and replaces the payload with your data
4. On the receiving side, encoded frames are decoded and reassembled
5. All data is encrypted by SRTP automatically — no additional encryption needed
6. The bonding engine registers this as link `srtp-0`

### Quick Start

```javascript
import { QDP } from 'qdp';

const rtc = new QDP({
  srtp: {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  },
});

const code = await rtc.createRoom();
```

The SRTP transport uses the same signaling channel as QDP (via message types `srtp-offer`, `srtp-answer`, `srtp-ice`) to negotiate its own peer connection. Once connected, data is bonded alongside WebRTC data channels and other transports.

### Standalone Usage

```javascript
import { SRTPTransport } from 'qdp';

const transport = new SRTPTransport({
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  roomCode: 'MY-ROOM',
  localPeerId: 'peer-a',
  remotePeerId: 'peer-b',
  signaling: mySignalingInstance,
  onData: (data) => console.log('Received:', data),
  onOpen: () => console.log('SRTP transport connected'),
  onClose: () => console.log('SRTP transport closed'),
});

await transport.connect(true);
await transport.send(new TextEncoder().encode('hello via SRTP'));
transport.close();
```

### Signaling Messages

The SRTP transport exchanges three signaling message types through the existing signaling channel:

| Message Type | Description |
|---|---|
| `srtp-offer` | SDP offer for the SRTP peer connection |
| `srtp-answer` | SDP answer for the SRTP peer connection |
| `srtp-ice` | ICE candidate for the SRTP peer connection |

These are handled automatically when using QDP with the `srtp` config option. For standalone usage, forward signaling messages to `transport.handleSignalingMessage(msg)`.

### Events

| Event | Payload | Description |
|---|---|---|
| `transport-added` | `{ type: 'srtp', linkId: 'srtp-0' }` | SRTP transport connected and added to bonding |
| `transport-removed` | `{ type: 'srtp', linkId: 'srtp-0' }` | SRTP transport disconnected |

### Configuration Options

| Option | Type | Default | Description |
|---|---|---|---|
| `iceServers` | array | `[{ urls: 'stun:stun.l.google.com:19302' }]` | ICE servers for the SRTP peer connection |
| `sampleRate` | number | `48000` | Audio context sample rate (used for the silent carrier track) |

### Browser Compatibility

| Feature | Chrome | Edge | Firefox | Safari |
|---|---|---|---|---|
| Encoded Transforms API | 86+ | 86+ | — | — |
| ScriptProcessorNode fallback | All | All | All | All |

When the Encoded Transforms API is unavailable, SRTP Transport falls back to a ScriptProcessorNode-based approach that modulates data into the audio stream. This fallback has lower throughput but works across all browsers.

---

## 13. Proxy Relay — Multi-Network Chaining (Alpha)

QDP nodes can act as **relay points** that forward proxy traffic between two different QDP connections, each potentially using a different transport. This lets you chain networks together so a client on Network A can fetch data from a server via Network B:

```
Client ──[MQTT]──→ Relay Node ──[SRTP]──→ Exit Node ──→ google.com
                                                    ←── response
Client ←──[MQTT]── Relay Node ←──[SRTP]── Exit Node
```

Every transport (WebRTC, MQTT, ICMP, SRTP, WebTransport) can carry relay traffic. The relay node doesn't need to understand the proxy protocol — it just forwards raw frames between its two connections.

> **Alpha**: Experimental feature. APIs may change.

### Quick Start — Single Relay

Three peers: **Client**, **Relay**, **Exit Node**. The relay connects to both and forwards proxy traffic.

**Exit Node** (fetches from the internet):
```javascript
const exit = new QDP({
  srtp: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] },
  bondTransports: ['srtp'],
});
const exitCode = await exit.createRoom('EXIT-ROOM');
exit.proxy.serve();
```

**Relay Node** (bridges two networks):
```javascript
const toClient = new QDP({
  mqtt: { brokerUrl: 'wss://broker.hivemq.com:8884/mqtt', dataTransport: true },
  bondTransports: ['mqtt'],
});
const relayCode = await toClient.createRoom('RELAY-ROOM');

const toExit = new QDP({
  srtp: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] },
  bondTransports: ['srtp'],
});
await toExit.joinRoom('EXIT-ROOM');

toExit.on('connected', () => {
  toClient.proxy.relay(toExit, {
    onRelay: (stats) => console.log(`Relayed ${stats.relayedFrames} frames`),
  });
});
```

**Client** (sends requests through the chain):
```javascript
const client = new QDP({
  mqtt: { brokerUrl: 'wss://broker.hivemq.com:8884/mqtt', dataTransport: true },
  bondTransports: ['mqtt'],
});
await client.joinRoom('RELAY-ROOM');

client.on('connected', async () => {
  const resp = await client.proxy.fetch('https://www.google.com');
  const html = await resp.text();
  console.log('Got Google via MQTT → SRTP relay:', html.length, 'bytes');
});
```

### Multi-Hop Chains

Chain multiple relays for onion-style routing through different networks:

```
Client ──[MQTT]──→ Relay 1 ──[ICMP]──→ Relay 2 ──[SRTP]──→ Exit ──→ internet
```

Each relay node calls `proxy.relay(nextHopQdp)` to forward traffic to the next connection.

### Relay API

| Method | Description |
|---|---|
| `proxy.relay(upstreamQdp, opts?)` | Start relaying proxy traffic to another QDP instance. Returns the `ProxyRelay` instance. |
| `proxy.stopRelay()` | Stop the relay and drop all pending requests |
| `proxy.getRelayStats()` | Get relay statistics: `{ active, pendingRequests, relayedFrames, relayedBytes }` |

### Relay Options

| Option | Type | Default | Description |
|---|---|---|---|
| `allowList` | string[] | `[]` | Domain allowlist (e.g. `['*.google.com', 'api.example.com']`). Empty = allow all. |
| `blockList` | string[] | `[]` | Domain blocklist. Checked before allowlist. |
| `onRelay` | function | — | Callback fired on each relayed frame with `{ relayedFrames, relayedBytes }` |

### Standalone ProxyRelay

For advanced setups, use `ProxyRelay` directly:

```javascript
import { ProxyRelay } from 'qdp';

const relay = new ProxyRelay({
  allowList: ['*.google.com'],
});

relay.setUpstream(async (data) => {
});

relay.setDownstream(async (data) => {
});

relay.start();
```

### Use Cases

| Scenario | Chain | Why |
|---|---|---|
| Bypass corporate firewall | Client ──[MQTT]──→ Relay ──[WebRTC]──→ Exit | MQTT passes through corp firewall; exit fetches blocked sites |
| ICMP-only network | Client ──[ICMP]──→ Relay ──[MQTT]──→ Exit | ICMP tunnels through networks where TCP/UDP is blocked |
| Geographic relay | Client ──[SRTP]──→ EU Relay ──[SRTP]──→ US Exit | Route through a specific region for geo-restricted content |
| Redundant path | Client ──[MQTT+ICMP bonded]──→ Relay ──[SRTP]──→ Exit | Bond multiple transports on the client leg for reliability |

---

## 14. Transport Server Mode

Every transport (MQTT, ICMP, SRTP, WebTransport) supports a `server` option. When set, the transport routes all data through a WebSocket relay server instead of using its native protocol directly. When omitted or falsy, the transport operates in its default P2P/direct mode.

### Configuration

Pass a `server` property in any transport config:

```js
const peer = new QDP({
  roomCode: 'my-room',
  mqtt: {
    brokerUrl: 'wss://broker.hivemq.com:8884/mqtt',
    server: 'wss://relay.example.com'
  },
  icmp: {
    targetIp: '10.0.0.1',
    strategy: 'relay',
    server: 'wss://relay.example.com'
  },
  srtp: {
    server: 'wss://relay.example.com'
  },
  webTransport: {
    url: 'https://wt.example.com',
    server: 'wss://relay.example.com'
  }
});
```

Setting `server` to a URL string enables relay mode. Omitting it keeps native behaviour:

```js
const peer = new QDP({
  roomCode: 'my-room',
  mqtt: {
    brokerUrl: 'wss://broker.hivemq.com:8884/mqtt'

  }
});
```

### Server Value Formats

| Format | Example | Description |
|---|---|---|
| URL string | `'wss://relay.example.com'` | WebSocket relay server URL |
| Object | `{ url: 'wss://relay.example.com' }` | Object with `url` property |
| Falsy | `null`, `undefined`, `false` | Disabled — use native transport |

### How It Works

When `server` is set on a transport:

1. The transport creates a `ServerRelay` instance instead of its native connection
2. `ServerRelay` opens a WebSocket to the relay URL with query params: `?room=ROOM&peer=LOCAL&remote=REMOTE&transport=TYPE`
3. All `send()` calls are forwarded over the WebSocket as binary frames
4. Incoming binary messages from the relay are delivered to `onData`

When `server` is not set:

1. MQTT connects directly to the MQTT broker
2. ICMP uses its configured strategy (relay, native bridge, WASI, or pseudo-ping)
3. SRTP establishes a direct WebRTC peer connection
4. WebTransport connects via HTTP/3 to the WebTransport server

### ServerRelay API

The `ServerRelay` class can be used standalone:

```js
import { ServerRelay } from 'qdp';

const relay = new ServerRelay({
  server: 'wss://relay.example.com',
  roomCode: 'my-room',
  localPeerId: 'peer-a',
  remotePeerId: 'peer-b',
  transportType: 'mqtt',
  onData: (data) => console.log('received', data),
  onOpen: () => console.log('relay connected'),
  onClose: () => console.log('relay closed')
});

await relay.connect();
relay.send(new Uint8Array([1, 2, 3]));
relay.close();
```

### Relay Server Requirements

The relay server must:

- Accept WebSocket connections at the configured URL
- Parse query parameters: `room`, `peer`, `remote`, `transport`
- Forward binary messages between peers in the same room
- Match peers by their `peer`/`remote` IDs (peer A's `remote` = peer B's `peer`)
