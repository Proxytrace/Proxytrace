FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
USER root
RUN mkdir -p /app
RUN chown $APP_UID:$APP_UID /app
USER $APP_UID
WORKDIR /app
EXPOSE 8080

# --platform=$BUILDPLATFORM: the SDK always runs natively on the build host and
# cross-compiles for $TARGETARCH (amd64/arm64), so multi-arch release builds avoid
# running the compiler under QEMU emulation. Only the runtime stages are per-arch.
FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG TARGETARCH
ARG BUILD_CONFIGURATION=Release
# Release version injected by the release workflow (-p:Version); see Directory.Build.props.
ARG APP_VERSION=0.0.0-dev
WORKDIR /src
COPY ["Proxytrace.Proxy/Proxytrace.Proxy.csproj", "Proxytrace.Proxy/"]
COPY ["Proxytrace.Application/Proxytrace.Application.csproj", "Proxytrace.Application/"]
COPY ["Proxytrace.Common/Proxytrace.Common.csproj", "Proxytrace.Common/"]
COPY ["Proxytrace.Domain/Proxytrace.Domain.csproj", "Proxytrace.Domain/"]
COPY ["Proxytrace.Messaging/Proxytrace.Messaging.csproj", "Proxytrace.Messaging/"]
COPY ["Proxytrace.Serialization/Proxytrace.Serialization.csproj", "Proxytrace.Serialization/"]
COPY ["Proxytrace.Storage/Proxytrace.Storage.csproj", "Proxytrace.Storage/"]
RUN dotnet restore "Proxytrace.Proxy/Proxytrace.Proxy.csproj" -a $TARGETARCH
COPY . .
WORKDIR "/src/Proxytrace.Proxy"
RUN dotnet build "./Proxytrace.Proxy.csproj" -a $TARGETARCH -c $BUILD_CONFIGURATION -o /app/build -p:Version=$APP_VERSION

FROM build AS publish
ARG TARGETARCH
ARG BUILD_CONFIGURATION=Release
ARG APP_VERSION=0.0.0-dev
# DebugType=none: ship no PDBs — they carry line-accurate symbols and a SourceLink map
# pointing at the private repo + commit SHA. Trade-off: production stack traces lose
# file/line info (exception messages and frames remain).
RUN dotnet publish "./Proxytrace.Proxy.csproj" -a $TARGETARCH -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false -p:Version=$APP_VERSION -p:DebugType=none

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "Proxytrace.Proxy.dll"]
