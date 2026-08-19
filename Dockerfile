# Unified Production Dockerfile: .NET Backend + Mediasoup SFU (Debian Bookworm)

# --- Stage 1: Build .NET Backend ---
FROM mcr.microsoft.com/dotnet/sdk:9.0-bookworm-slim AS dotnet-build
WORKDIR /src/backend
COPY backend/Backend.csproj .
RUN dotnet restore
COPY backend/ .
RUN dotnet publish -c Release -o /app/backend

# --- Stage 2: Build Mediasoup SFU ---
FROM node:22-bookworm-slim AS sfu-build
WORKDIR /src/sfu
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    build-essential \
    && rm -rf /var/lib/apt/lists/*
COPY sfu/package.json .
RUN npm install --omit=dev
COPY sfu/ .

# --- Stage 3: Final Unified Runtime Image ---
FROM mcr.microsoft.com/dotnet/aspnet:9.0-bookworm-slim AS runtime
WORKDIR /app

# Install Node.js 22 & Supervisor
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    supervisor \
    ca-certificates \
    gnupg \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list \
    && apt-get update && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy .NET published output
COPY --from=dotnet-build /app/backend /app/backend

# Copy Mediasoup SFU output
COPY --from=sfu-build /src/sfu /app/sfu

# Copy Supervisor configuration
COPY supervisord.conf /etc/supervisord.conf

# Expose ports:
# 5000 (ASP.NET Core REST API & SignalR)
# 4000 (Mediasoup SFU Socket.io Signaling)
# 20000-29999/udp (Mediasoup WebRTC Media Traffic)
EXPOSE 5000 4000 20000-29999/udp

ENV ASPNETCORE_URLS="http://+:5000"
ENV PORT="4000"
ENV NODE_ENV="production"

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
