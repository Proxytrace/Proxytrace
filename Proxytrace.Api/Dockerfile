FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
USER root
# Pre-create the writable runtime data dirs (Lucene search index + SQLite DB live here)
# and hand /app to the non-root app user. A named volume mounted at /app/searchindex
# inherits this ownership; bind mounts must be made writable by $APP_UID on the host.
RUN mkdir -p /app/searchindex && chown -R $APP_UID:$APP_UID /app
USER $APP_UID
WORKDIR /app
EXPOSE 8080
EXPOSE 8081

FROM mcr.microsoft.com/dotnet/sdk:10.0 as build
ARG BUILD_CONFIGURATION=Release
# Release version injected by the release workflow (-p:Version); see Directory.Build.props.
ARG APP_VERSION=0.0.0-dev
WORKDIR /src
COPY ["Proxytrace.Api/Proxytrace.Api.csproj", "Proxytrace.Api/"]
COPY ["Proxytrace.Application/Proxytrace.Application.csproj", "Proxytrace.Application/"]
COPY ["Proxytrace.Common/Proxytrace.Common.csproj", "Proxytrace.Common/"]
COPY ["Proxytrace.Domain/Proxytrace.Domain.csproj", "Proxytrace.Domain/"]
COPY ["Proxytrace.Infrastructure/Proxytrace.Infrastructure.csproj", "Proxytrace.Infrastructure/"]
COPY ["Proxytrace.Messaging/Proxytrace.Messaging.csproj", "Proxytrace.Messaging/"]
COPY ["Proxytrace.Serialization/Proxytrace.Serialization.csproj", "Proxytrace.Serialization/"]
COPY ["Proxytrace.Storage/Proxytrace.Storage.csproj", "Proxytrace.Storage/"]
RUN dotnet restore "Proxytrace.Api/Proxytrace.Api.csproj"
COPY . .
WORKDIR "/src/Proxytrace.Api"
# SkipManualBuild: the SDK image has no npm, and in the Docker setup the VitePress manual
# is served by the nginx frontend, not the API's wwwroot. So skip the manual build here.
RUN dotnet build "./Proxytrace.Api.csproj" -c $BUILD_CONFIGURATION -o /app/build /p:SkipManualBuild=true -p:Version=$APP_VERSION

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
ARG APP_VERSION=0.0.0-dev
# DebugType=none: ship no PDBs — they carry line-accurate symbols and a SourceLink map
# pointing at the private repo + commit SHA. Trade-off: production stack traces lose
# file/line info (exception messages and frames remain).
RUN dotnet publish "./Proxytrace.Api.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false /p:SkipManualBuild=true -p:Version=$APP_VERSION -p:DebugType=none

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "Proxytrace.Api.dll"]
