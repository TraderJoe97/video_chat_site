# Unified Production Dockerfile: .NET 10 Backend + Mediasoup SFU

# --- Stage 1: Build .NET Backend ---
FROM mcr.microsoft.com/dotnet/sdk:10.0-preview-alpine AS dotnet-build
WORKDIR /src/backend
COPY backend/Backend.csproj .
RUN dotnet restore
COPY backend/ .
RUN dotnet publish -c Release -o /app/backend

# --- Stage 2: Build Mediasoup SFU (Node.js + C++ Worker compilation) ---
FROM node:22-alpine AS sfu-build
WORKDIR /src/sfu
RUN apk add --no-cache python3 make g++ linux-headers
COPY sfu/package.json .
RUN npm install --production
COPY sfu/ .

# --- Stage 3: Final Unified Runtime Image ---
FROM mcr.microsoft.com/dotnet/aspnet:10.0-preview-alpine AS runtime
WORKDIR /app

# Install Node.js & Supervisord to run both services in one container
RUN apk add --no-cache nodejs supervisor

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
