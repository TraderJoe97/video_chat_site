# Unified Production Dockerfile: .NET 9 Backend + Mediasoup SFU (Ubuntu Noble for Prebuilt Binary)

# --- Stage 1: Build .NET Backend ---
FROM mcr.microsoft.com/dotnet/sdk:9.0-noble AS dotnet-build
WORKDIR /src/backend
ENV DOTNET_CLI_TELEMETRY_OPTOUT=1
ENV DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1
ENV DOTNET_NOLOGO=1
COPY backend/Backend.csproj .
RUN dotnet restore --disable-parallel
COPY backend/ .
RUN dotnet publish -c Release -o /app/backend -m:1 --no-restore

# --- Stage 2: Unified Runtime with Node.js 22 & Prebuilt Mediasoup SFU ---
FROM mcr.microsoft.com/dotnet/aspnet:9.0-noble AS runtime
WORKDIR /app

# Install Node.js 22 and Supervisor on Ubuntu Noble
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    supervisor \
    ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install SFU dependencies using the official prebuilt binary (Zero compilation, <200MB RAM)
WORKDIR /app/sfu
COPY sfu/package.json sfu/package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY sfu/ .

# Copy .NET published output
WORKDIR /app
COPY --from=dotnet-build /app/backend /app/backend
COPY supervisord.conf /etc/supervisord.conf

# Expose ports:
# 5000 (Unified Gateway: SFU Socket.io + SignalR Hub + REST APIs)
# 20000-29999/udp (Mediasoup WebRTC Media Traffic)
EXPOSE 5000 20000-29999/udp

ENV PORT="5000"
ENV ASPNETCORE_URLS="http://127.0.0.1:5001"
ENV DOTNET_BACKEND_URL="http://127.0.0.1:5001"
ENV NODE_ENV="production"

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
