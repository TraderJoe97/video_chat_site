# BMad Technical Architecture: Mediasoup SFU + .NET Backend + Next.js

**Status**: [APPROVED]  
**Architecture Paradigm**: Decoupled Selective Forwarding Unit (SFU) with .NET 10 Orchestration & SignalR Signaling

---

## 1. System Architecture Diagram

```mermaid
graph TD
    subgraph Clients ["Next.js 15 Frontend (Clients)"]
        ClientA["Client A (mediasoup-client)"]
        ClientB["Client B (mediasoup-client)"]
        ClientC["Client C (mediasoup-client)"]
    end

    subgraph Backend [".NET 10 Backend (Port 5000)"]
        API["ASP.NET Core REST API\n(/api/meetings, /api/health)"]
        SignalR["SignalR Meeting Hub\n(/hubs/meeting)"]
        MeetingService["Meeting & Session Manager"]
    end

    subgraph SFUService ["Mediasoup SFU Engine (Port 4000)"]
        WorkerPool["Mediasoup C++ Workers"]
        Router["Media Routers (1 per Meeting)"]
        Transports["WebRtcTransports (Send / Recv)"]
        Producers["Producers (Cam / Mic / Screen)"]
        Consumers["Consumers (Fanout to Peers)"]
    end

    %% Signaling Flows
    ClientA <-->|SignalR / REST| SignalR
    ClientB <-->|SignalR / REST| SignalR
    ClientC <-->|SignalR / REST| SignalR
    SignalR <-->|SFU RPC / Control| SFUService

    %% Media Flows (O(1) Upload)
    ClientA ==>|1 Up WebRTC RTP| Transports
    ClientB ==>|1 Up WebRTC RTP| Transports
    ClientC ==>|1 Up WebRTC RTP| Transports
    Transports ==>|Downlink RTP Fanout| ClientA
    Transports ==>|Downlink RTP Fanout| ClientB
    Transports ==>|Downlink RTP Fanout| ClientC
```

---

## 2. Invariants & Architecture Decisions

* **AD-1: SFU over Full-Mesh**
  * **Binds**: Media routing architecture.
  * **Prevents**: Exponential client CPU/upload bandwidth exhaustion with 3+ users.
  * **Rule**: Each client establishes **1 Send Transport** ($O(1)$ video+audio upload) and **1 Recv Transport** ($O(N-1)$ download fanout via Mediasoup SFU).

* **AD-2: .NET 10 for Business Logic & Room Lifecycle**
  * **Binds**: Primary backend stack (`backend/`).
  * **Prevents**: Node.js monolithic bottleneck for business APIs and session state.
  * **Rule**: ASP.NET Core 10 controls room creation, health checks, participant access tokens, and SignalR presence/chat broadcast.

* **AD-3: Mediasoup SFU Service Isolation**
  * **Binds**: Media processing engine (`sfu/`).
  * **Rule**: Dedicated Mediasoup worker processes handle RTP/RTCP packet switching and codec negotiation (VP8, VP9, H264, Opus).

* **AD-4: Modern Next.js 15 Glassmorphic UI/UX**
  * **Binds**: Frontend user interface (`insta-meets/`).
  * **Rule**: Deliver an elevated, premium meeting interface with dynamic speaker spotlight, audio level visualizations, responsive grid layout, floating glass control bar, and polished chat drawer.

---

## 3. Component Breakdown

| Component | Technology | Directory | Responsibility |
| :--- | :--- | :--- | :--- |
| **.NET Backend** | .NET 10, ASP.NET Core, SignalR | `backend/` | REST APIs, meeting lifecycle, SignalR presence & chat |
| **Mediasoup SFU** | Mediasoup v3, Node.js worker pool | `sfu/` | WebRtcTransports, Producers, Consumers, RTP forwarding |
| **Frontend App** | Next.js 15, React 19, `mediasoup-client`, Tailwind CSS | `insta-meets/` | Device management, SFU streams, premium meeting UI/UX |
