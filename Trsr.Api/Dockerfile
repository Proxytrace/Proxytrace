FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
USER $APP_UID
WORKDIR /app
EXPOSE 8080
EXPOSE 8081

FROM mcr.microsoft.com/dotnet/sdk:10.0 as build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["Trsr.Api/Trsr.Api.csproj", "Trsr.Api/"]
COPY ["Trsr.Application/Trsr.Application.csproj", "Trsr.Application/"]
COPY ["Trsr.Common/Trsr.Common.csproj", "Trsr.Common/"]
COPY ["Trsr.Domain/Trsr.Domain.csproj", "Trsr.Domain/"]
COPY ["Trsr.Infrastructure/Trsr.Infrastructure.csproj", "Trsr.Infrastructure/"]
COPY ["Trsr.Serialization/Trsr.Serialization.csproj", "Trsr.Serialization/"]
COPY ["Trsr.Storage/Trsr.Storage.csproj", "Trsr.Storage/"]
RUN dotnet restore "Trsr.Api/Trsr.Api.csproj"
COPY . .
WORKDIR "/src/Trsr.Api"
RUN dotnet build "./Trsr.Api.csproj" -c $BUILD_CONFIGURATION -o /app/build

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./Trsr.Api.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "Trsr.Api.dll"]
