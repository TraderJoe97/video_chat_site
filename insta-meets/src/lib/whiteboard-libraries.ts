// Pre-loaded Excalidraw Libraries (Stick Figures, Tech Logos & Software Architecture)

export const DEFAULT_LIBRARY_ITEMS = [
  // =========================================================================
  // 1. STICK FIGURES
  // =========================================================================
  {
    id: "stick-figure-standing",
    status: "published" as const,
    created: Date.now(),
    name: "Stick Figure - Standing",
    elements: [
      { id: "head-1", type: "ellipse", x: 40, y: 10, width: 30, height: 30, strokeColor: "#ffffff", backgroundColor: "transparent", strokeWidth: 2, roughness: 1, groupIds: ["stick-1"] },
      { id: "torso-1", type: "line", x: 55, y: 40, width: 0, height: 40, points: [[0, 0], [0, 40]], strokeColor: "#ffffff", strokeWidth: 2, roughness: 1, groupIds: ["stick-1"] },
      { id: "arm-l-1", type: "line", x: 55, y: 50, width: 25, height: 15, points: [[0, 0], [-25, 15]], strokeColor: "#ffffff", strokeWidth: 2, roughness: 1, groupIds: ["stick-1"] },
      { id: "arm-r-1", type: "line", x: 55, y: 50, width: 25, height: 20, points: [[0, 0], [25, -20]], strokeColor: "#ffffff", strokeWidth: 2, roughness: 1, groupIds: ["stick-1"] },
      { id: "leg-l-1", type: "line", x: 55, y: 80, width: 20, height: 35, points: [[0, 0], [-20, 35]], strokeColor: "#ffffff", strokeWidth: 2, roughness: 1, groupIds: ["stick-1"] },
      { id: "leg-r-1", type: "line", x: 55, y: 80, width: 20, height: 35, points: [[0, 0], [20, 35]], strokeColor: "#ffffff", strokeWidth: 2, roughness: 1, groupIds: ["stick-1"] },
    ],
  },
  {
    id: "stick-figure-presenter",
    status: "published" as const,
    created: Date.now(),
    name: "Stick Figure - Presenter",
    elements: [
      { id: "head-2", type: "ellipse", x: 50, y: 10, width: 32, height: 32, strokeColor: "#38bdf8", backgroundColor: "#0284c7", fillStyle: "solid", strokeWidth: 2, roughness: 1, groupIds: ["stick-2"] },
      { id: "torso-2", type: "line", x: 66, y: 42, width: 0, height: 45, points: [[0, 0], [0, 45]], strokeColor: "#38bdf8", strokeWidth: 2, roughness: 1, groupIds: ["stick-2"] },
      { id: "arm-point-2", type: "line", x: 66, y: 55, width: 45, height: 25, points: [[0, 0], [45, -25]], strokeColor: "#38bdf8", strokeWidth: 2.5, roughness: 1, groupIds: ["stick-2"] },
      { id: "arm-hip-2", type: "line", x: 66, y: 55, width: 20, height: 20, points: [[0, 0], [-20, 10], [0, 20]], strokeColor: "#38bdf8", strokeWidth: 2, roughness: 1, groupIds: ["stick-2"] },
      { id: "leg-l-2", type: "line", x: 66, y: 87, width: 18, height: 38, points: [[0, 0], [-18, 38]], strokeColor: "#38bdf8", strokeWidth: 2, roughness: 1, groupIds: ["stick-2"] },
      { id: "leg-r-2", type: "line", x: 66, y: 87, width: 18, height: 38, points: [[0, 0], [18, 38]], strokeColor: "#38bdf8", strokeWidth: 2, roughness: 1, groupIds: ["stick-2"] },
    ],
  },
  {
    id: "stick-figure-user-persona",
    status: "published" as const,
    created: Date.now(),
    name: "User Persona Avatar",
    elements: [
      { id: "user-circle", type: "ellipse", x: 30, y: 10, width: 40, height: 40, strokeColor: "#f59e0b", backgroundColor: "#fbbf24", fillStyle: "hachure", strokeWidth: 2, roughness: 1, groupIds: ["user-1"] },
      { id: "user-shoulders", type: "ellipse", x: 15, y: 45, width: 70, height: 40, strokeColor: "#f59e0b", backgroundColor: "#fde68a", fillStyle: "cross-hatch", strokeWidth: 2, roughness: 1, groupIds: ["user-1"] },
    ],
  },

  // =========================================================================
  // 2. SOFTWARE LOGOS & TECH STACK ICONS
  // =========================================================================
  {
    id: "tech-logo-react",
    status: "published" as const,
    created: Date.now(),
    name: "React Logo",
    elements: [
      { id: "react-core", type: "ellipse", x: 45, y: 35, width: 20, height: 20, strokeColor: "#61dafb", backgroundColor: "#61dafb", fillStyle: "solid", strokeWidth: 2, roughness: 1, groupIds: ["react-logo"] },
      { id: "react-ring-1", type: "ellipse", x: 15, y: 25, width: 80, height: 40, strokeColor: "#61dafb", backgroundColor: "transparent", strokeWidth: 2, roughness: 1, angle: 0, groupIds: ["react-logo"] },
      { id: "react-ring-2", type: "ellipse", x: 15, y: 25, width: 80, height: 40, strokeColor: "#61dafb", backgroundColor: "transparent", strokeWidth: 2, roughness: 1, angle: 1.05, groupIds: ["react-logo"] },
      { id: "react-ring-3", type: "ellipse", x: 15, y: 25, width: 80, height: 40, strokeColor: "#61dafb", backgroundColor: "transparent", strokeWidth: 2, roughness: 1, angle: 2.09, groupIds: ["react-logo"] },
    ],
  },
  {
    id: "tech-logo-nextjs",
    status: "published" as const,
    created: Date.now(),
    name: "Next.js Logo Badge",
    elements: [
      { id: "next-box", type: "rectangle", x: 10, y: 10, width: 110, height: 46, strokeColor: "#ffffff", backgroundColor: "#000000", fillStyle: "solid", strokeWidth: 2, roughness: 1, roundness: { type: 3 }, groupIds: ["next-logo"] },
      { id: "next-txt", type: "text", x: 20, y: 22, width: 90, height: 22, text: "▲ NEXT.JS", fontSize: 16, fontFamily: 1, strokeColor: "#ffffff", groupIds: ["next-logo"] },
    ],
  },
  {
    id: "tech-logo-dotnet",
    status: "published" as const,
    created: Date.now(),
    name: ".NET Core Badge",
    elements: [
      { id: "dotnet-box", type: "rectangle", x: 10, y: 10, width: 110, height: 46, strokeColor: "#a855f7", backgroundColor: "#581c87", fillStyle: "solid", strokeWidth: 2, roughness: 1, roundness: { type: 3 }, groupIds: ["dotnet-logo"] },
      { id: "dotnet-txt", type: "text", x: 20, y: 22, width: 90, height: 22, text: "🟣 .NET 10", fontSize: 15, fontFamily: 1, strokeColor: "#ffffff", groupIds: ["dotnet-logo"] },
    ],
  },
  {
    id: "tech-logo-docker",
    status: "published" as const,
    created: Date.now(),
    name: "Docker Container Logo",
    elements: [
      { id: "docker-box", type: "rectangle", x: 10, y: 10, width: 120, height: 48, strokeColor: "#38bdf8", backgroundColor: "#0c4a6e", fillStyle: "solid", strokeWidth: 2, roughness: 1, roundness: { type: 3 }, groupIds: ["docker-logo"] },
      { id: "docker-txt", type: "text", x: 18, y: 22, width: 100, height: 22, text: "🐳 Docker", fontSize: 15, fontFamily: 1, strokeColor: "#ffffff", groupIds: ["docker-logo"] },
    ],
  },
  {
    id: "tech-logo-supabase",
    status: "published" as const,
    created: Date.now(),
    name: "Supabase Logo",
    elements: [
      { id: "supa-box", type: "rectangle", x: 10, y: 10, width: 130, height: 48, strokeColor: "#34d399", backgroundColor: "#064e3b", fillStyle: "solid", strokeWidth: 2, roughness: 1, roundness: { type: 3 }, groupIds: ["supa-logo"] },
      { id: "supa-txt", type: "text", x: 18, y: 22, width: 110, height: 22, text: "⚡ Supabase", fontSize: 15, fontFamily: 1, strokeColor: "#ffffff", groupIds: ["supa-logo"] },
    ],
  },

  // =========================================================================
  // 3. SOFTWARE ARCHITECTURE & SYSTEM DESIGN
  // =========================================================================
  {
    id: "arch-client-spa",
    status: "published" as const,
    created: Date.now(),
    name: "Architecture - Client Browser",
    elements: [
      { id: "client-frame", type: "rectangle", x: 10, y: 10, width: 150, height: 90, strokeColor: "#60a5fa", backgroundColor: "#1e3a8a", fillStyle: "solid", strokeWidth: 2, roughness: 1, roundness: { type: 3 }, groupIds: ["arch-client"] },
      { id: "client-title", type: "text", x: 20, y: 25, width: 130, height: 20, text: "🖥️ Client Web App", fontSize: 13, fontFamily: 1, strokeColor: "#ffffff", groupIds: ["arch-client"] },
      { id: "client-sub", type: "text", x: 20, y: 55, width: 130, height: 18, text: "React 19 / Turbopack", fontSize: 10, fontFamily: 1, strokeColor: "#93c5fd", groupIds: ["arch-client"] },
    ],
  },
  {
    id: "arch-api-gateway",
    status: "published" as const,
    created: Date.now(),
    name: "Architecture - API Gateway",
    elements: [
      { id: "gw-box", type: "rectangle", x: 10, y: 10, width: 160, height: 90, strokeColor: "#fb923c", backgroundColor: "#7c2d12", fillStyle: "solid", strokeWidth: 2, roughness: 1, roundness: { type: 3 }, groupIds: ["arch-gw"] },
      { id: "gw-title", type: "text", x: 20, y: 25, width: 140, height: 20, text: "🚪 API Gateway", fontSize: 13, fontFamily: 1, strokeColor: "#ffffff", groupIds: ["arch-gw"] },
      { id: "gw-sub", type: "text", x: 20, y: 55, width: 140, height: 18, text: "Reverse Proxy / Auth", fontSize: 10, fontFamily: 1, strokeColor: "#fdba74", groupIds: ["arch-gw"] },
    ],
  },
  {
    id: "arch-webrtc-sfu",
    status: "published" as const,
    created: Date.now(),
    name: "Architecture - WebRTC SFU / Media",
    elements: [
      { id: "sfu-box", type: "rectangle", x: 10, y: 10, width: 170, height: 90, strokeColor: "#a855f7", backgroundColor: "#581c87", fillStyle: "solid", strokeWidth: 2, roughness: 1, roundness: { type: 3 }, groupIds: ["arch-sfu"] },
      { id: "sfu-title", type: "text", x: 20, y: 25, width: 150, height: 20, text: "📹 WebRTC / SFU Node", fontSize: 13, fontFamily: 1, strokeColor: "#ffffff", groupIds: ["arch-sfu"] },
      { id: "sfu-sub", type: "text", x: 20, y: 55, width: 150, height: 18, text: "Mediasoup / RTP Relays", fontSize: 10, fontFamily: 1, strokeColor: "#d8b4fe", groupIds: ["arch-sfu"] },
    ],
  },
  {
    id: "arch-database-cylinder",
    status: "published" as const,
    created: Date.now(),
    name: "Architecture - PostgreSQL DB",
    elements: [
      { id: "db-top", type: "ellipse", x: 20, y: 10, width: 100, height: 26, strokeColor: "#10b981", backgroundColor: "#064e3b", fillStyle: "solid", strokeWidth: 2, roughness: 1, groupIds: ["arch-db"] },
      { id: "db-body", type: "rectangle", x: 20, y: 23, width: 100, height: 65, strokeColor: "#10b981", backgroundColor: "#064e3b", fillStyle: "solid", strokeWidth: 2, roughness: 1, groupIds: ["arch-db"] },
      { id: "db-txt", type: "text", x: 28, y: 45, width: 90, height: 20, text: "🗄️ PostgreSQL", fontSize: 12, fontFamily: 1, strokeColor: "#ffffff", groupIds: ["arch-db"] },
    ],
  },
  {
    id: "arch-redis-cache",
    status: "published" as const,
    created: Date.now(),
    name: "Architecture - Redis Cache",
    elements: [
      { id: "redis-box", type: "rectangle", x: 10, y: 10, width: 140, height: 75, strokeColor: "#ef4444", backgroundColor: "#7f1d1d", fillStyle: "solid", strokeWidth: 2, roughness: 1, roundness: { type: 3 }, groupIds: ["arch-redis"] },
      { id: "redis-title", type: "text", x: 20, y: 25, width: 120, height: 20, text: "⚡ Redis Cache", fontSize: 13, fontFamily: 1, strokeColor: "#ffffff", groupIds: ["arch-redis"] },
      { id: "redis-sub", type: "text", x: 20, y: 48, width: 120, height: 16, text: "In-Memory KV Store", fontSize: 10, fontFamily: 1, strokeColor: "#fca5a5", groupIds: ["arch-redis"] },
    ],
  },
  {
    id: "arch-message-queue",
    status: "published" as const,
    created: Date.now(),
    name: "Architecture - Message Queue / Kafka",
    elements: [
      { id: "mq-box", type: "rectangle", x: 10, y: 10, width: 150, height: 75, strokeColor: "#eab308", backgroundColor: "#713f12", fillStyle: "solid", strokeWidth: 2, roughness: 1, roundness: { type: 3 }, groupIds: ["arch-mq"] },
      { id: "mq-title", type: "text", x: 20, y: 25, width: 130, height: 20, text: "📬 Message Queue", fontSize: 13, fontFamily: 1, strokeColor: "#ffffff", groupIds: ["arch-mq"] },
      { id: "mq-sub", type: "text", x: 20, y: 48, width: 130, height: 16, text: "Kafka / Pub-Sub", fontSize: 10, fontFamily: 1, strokeColor: "#fde047", groupIds: ["arch-mq"] },
    ],
  },
]
