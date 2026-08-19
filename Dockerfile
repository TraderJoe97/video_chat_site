# Unified Production Dockerfile: .NET Backend + Mediasoup SFU (Strict Low-Memory Sequential Pipeline)

# --- Stage 1: Build .NET Backend ---
FROM mcr.microsoft.com/dotnet/sdk:9.0-bookworm-slim AS dotnet-build
WORKDIR /src/backend
ENV DOTNET_CLI_TELEMETRY_OPTOUT=1
ENV DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1
ENV DOTNET_NOLOGO=1
COPY backend/Backend.csproj .
RUN dotnet restore --disable-parallel
COPY backend/ .
RUN dotnet publish -c Release -o /app/backend -m:1 --no-restore

# --- Stage 2: Build Mediasoup SFU (Sequential dependency on Stage 1 to prevent memory contention) ---
FROM node:22-bookworm-slim AS sfu-build
WORKDIR /src/sfu
ENV MEDIASOUP_BUILD_WORKER_CONCURRENT_NUMBER=1
ENV npm_config_jobs=1
# Force Docker BuildKit to wait for dotnet-build to finish before starting sfu-build
COPY --from=dotnet-build /app/backend/Backend.dll /tmp/stage1-barrier
COPY sfu/package.json sfu/package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund --loglevel=error
COPY sfu/ .

# --- Stage 3: Minimal Unified Runtime Image ---
FROM mcr.microsoft.com/dotnet/aspnet:9.0-bookworm-slim AS runtime
WORKDIR /app

# Install Node.js 22 & Supervisor sequentially
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    supervisor \
    ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /root/.npm /root/.cache

# Copy artifacts from prior stages
COPY --from=dotnet-build /app/backend /app/backend
COPY --from=sfu-build /src/sfu /app/sfu
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
