# FastRTC v2.5 — The Serverless P2P Suite

FastRTC has evolved from a simple file-transfer engine into a comprehensive **P2P Communication Suite**. It leverages WebRTC data channel bonding to achieve unparalleled speeds, and it's now **100% serverless** thanks to matchmaking over public WebTorrent trackers.

## Core Features

- **🌐 Serverless Matchmaking**: Connects instantly across networks using 22 concurrent public WebTorrent trackers. No Node.js backend required!
- **🔗 Bonded Channels**: Stripes data across 32 parallel WebRTC data channels simultaneously for maximum throughput.
- **📁 File Transfer**: Ultra-fast P2P file transfers with zero limits.
- **💬 Real-time Chat**: Text and binary P2P messaging.
- **🛡️ HTTP Proxying**: Tunnel actual HTTP `fetch()` requests through the P2P connection to bypass firewalls or region blocks.
- **📹 Audio / Video Calls**: Add camera and screen-sharing directly to the P2P mesh.
- **⚡ Data Streaming**: Continuous generic binary feeds with backpressure handling.

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

### 🖥️ Running a Dedicated Proxy Host (Node.js)

Because browser-to-browser proxying is strictly bound by standard CORS limitations, to create a **true unrestricted VPN/Proxy**, you can run FastRTC in a headless Node.js environment.

By deploying a simple Node.js script to a cheap VPS (using a library like `node-datachannel` or `wrtc`), you can host a permanent 24/7 "Exit Node".

1. Start FastRTC on your Node.js server with `new FastRTC({ isHost: true })`
2. The Node.js Host calls `rtc.proxy.serve()`.
3. Your browser connects to the swarm. The `connected` event fires with `info.remoteIsHost === true`.
4. Your browser tunnels all `rtc.proxy.fetch()` traffic through the Node.js server.
5. Because the exit node is running Node.js, **it FULLY bypasses CORS** and can fetch absolutely any domain or API on the open internet and stream the raw bytes back to your browser!

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
