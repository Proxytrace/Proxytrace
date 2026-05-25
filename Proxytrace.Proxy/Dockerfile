FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
USER root
RUN mkdir -p /app
RUN chown $APP_UID:$APP_UID /app
USER $APP_UID
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:10.0 as build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["Proxytrace.Proxy/Proxytrace.Proxy.csproj", "Proxytrace.Proxy/"]
COPY ["Proxytrace.Application/Proxytrace.Application.csproj", "Proxytrace.Application/"]
COPY ["Proxytrace.Common/Proxytrace.Common.csproj", "Proxytrace.Common/"]
COPY ["Proxytrace.Domain/Proxytrace.Domain.csproj", "Proxytrace.Domain/"]
COPY ["Proxytrace.Messaging/Proxytrace.Messaging.csproj", "Proxytrace.Messaging/"]
COPY ["Proxytrace.Serialization/Proxytrace.Serialization.csproj", "Proxytrace.Serialization/"]
COPY ["Proxytrace.Storage/Proxytrace.Storage.csproj", "Proxytrace.Storage/"]
RUN dotnet restore "Proxytrace.Proxy/Proxytrace.Proxy.csproj"
COPY . .
WORKDIR "/src/Proxytrace.Proxy"
RUN dotnet build "./Proxytrace.Proxy.csproj" -c $BUILD_CONFIGURATION -o /app/build

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./Proxytrace.Proxy.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "Proxytrace.Proxy.dll"]
