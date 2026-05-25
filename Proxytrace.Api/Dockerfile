FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
USER root
RUN mkdir -p /app
RUN chown $APP_UID:$APP_UID /app
USER $APP_UID
WORKDIR /app
EXPOSE 8080
EXPOSE 8081

FROM mcr.microsoft.com/dotnet/sdk:10.0 as build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["Proxytrace.Api/Proxytrace.Api.csproj", "Proxytrace.Api/"]
COPY ["Proxytrace.Application/Proxytrace.Application.csproj", "Proxytrace.Application/"]
COPY ["Proxytrace.Common/Proxytrace.Common.csproj", "Proxytrace.Common/"]
COPY ["Proxytrace.Domain/Proxytrace.Domain.csproj", "Proxytrace.Domain/"]
COPY ["Proxytrace.Infrastructure/Proxytrace.Infrastructure.csproj", "Proxytrace.Infrastructure/"]
COPY ["Proxytrace.Serialization/Proxytrace.Serialization.csproj", "Proxytrace.Serialization/"]
COPY ["Proxytrace.Storage/Proxytrace.Storage.csproj", "Proxytrace.Storage/"]
RUN dotnet restore "Proxytrace.Api/Proxytrace.Api.csproj"
COPY . .
WORKDIR "/src/Proxytrace.Api"
RUN dotnet build "./Proxytrace.Api.csproj" -c $BUILD_CONFIGURATION -o /app/build

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./Proxytrace.Api.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "Proxytrace.Api.dll"]
