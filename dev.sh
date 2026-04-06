#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Process IDs
API_PID=""
FRONTEND_PID=""

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}Shutting down services...${NC}"
    
    if [ ! -z "$API_PID" ]; then
        echo -e "${YELLOW}Stopping API (PID: $API_PID)...${NC}"
        kill $API_PID 2>/dev/null
    fi
    
    if [ ! -z "$FRONTEND_PID" ]; then
        echo -e "${YELLOW}Stopping Frontend (PID: $FRONTEND_PID)...${NC}"
        kill $FRONTEND_PID 2>/dev/null
    fi
    
    echo -e "${GREEN}Services stopped.${NC}"
    exit 0
}

# Set up trap to catch SIGINT (Ctrl+C) and SIGTERM
trap cleanup SIGINT SIGTERM

echo -e "${GREEN}Starting Trsr development environment...${NC}\n"

# Start API
echo -e "${GREEN}Starting API...${NC}"
cd "$SCRIPT_DIR/Trsr.Api"
dotnet run --no-launch-profile &
API_PID=$!
echo -e "${GREEN}API started (PID: $API_PID)${NC}\n"

# Give API a moment to start
sleep 2

# Start Frontend
echo -e "${GREEN}Starting Frontend...${NC}"
cd "$SCRIPT_DIR/frontend"
npm run start &
FRONTEND_PID=$!
echo -e "${GREEN}Frontend started (PID: $FRONTEND_PID)${NC}\n"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Development environment is running!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "API:      ${YELLOW}http://localhost:5000${NC}"
echo -e "Frontend: ${YELLOW}http://localhost:4200${NC}"
echo -e "\n${YELLOW}Press Ctrl+C to stop all services${NC}\n"

# Wait for both processes
wait $API_PID $FRONTEND_PID
