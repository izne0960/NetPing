# Ping Tool

A simple web-based network diagnostic tool.

Enter a hostname or IP address and get real ping results, including:

- Reachability
- Packets sent and received
- Packet loss
- Average latency
- Individual ping replies
- Raw ping output

## How it works

The browser cannot send ICMP requests directly. The `/api/ping` endpoint validates the target and uses the Globalping network to perform real ICMP pings.

## Run locally

```bash
npm install
npm run dev
```

The app runs at:

```text
http://localhost:8080
```

## Build

```bash
npm run build
```