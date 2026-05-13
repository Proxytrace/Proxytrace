FROM mcr.microsoft.com/dotnet/sdk:10.0

ENV DOTNET_CLI_TELEMETRY_OPTOUT=1 \
    DOTNET_NOLOGO=1 \
    DOTNET_GENERATE_ASPNET_CERTIFICATE=0 \
    NUGET_XMLDOC_MODE=skip \
    PATH="/home/vscode/.dotnet/tools:${PATH}"

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git \
        curl \
        ca-certificates \
        sqlite3 \
        unzip \
    && rm -rf /var/lib/apt/lists/*
