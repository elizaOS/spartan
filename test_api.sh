#!/bin/bash

# Navigate to the correct directory if the script is run from elsewhere
# cd ~/eliza/packages/spartan || exit

echo "Starting Bun dev server..."
bun run dev &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

echo "Waiting for server to start (10 seconds)..."
sleep 10

# Define API endpoints to test
endpoints=(
  "http://localhost:3000/api/479233fd-b0e7-0f50-9d88-d4c9ea5b0de0/intel/sentiment"
  "http://localhost:3000/api/479233fd-b0e7-0f50-9d88-d4c9ea5b0de0/intel/portfolio"
  "http://localhost:3000/api/479233fd-b0e7-0f50-9d88-d4c9ea5b0de0/intel/summary"
  "http://localhost:3000/api/479233fd-b0e7-0f50-9d88-d4c9ea5b0de0/intel/trending"
  "http://localhost:3000/api/479233fd-b0e7-0f50-9d88-d4c9ea5b0de0/intel/tweets"
  "http://localhost:3000/api/479233fd-b0e7-0f50-9d88-d4c9ea5b0de0/intel/signals"
  # Add any other endpoints you want to test
)

# Loop through endpoints and hit them with curl
for endpoint in "${endpoints[@]}"
do
  echo "-----------------------------------------"
  echo "Testing endpoint: $endpoint"
  # Use curl -s for silent (no progress meter), -S to show errors, -i to include headers
  # You can also use -X GET explicitly if needed, though GET is default
  # Add -w \"\\nHTTP Status: %{http_code}\\n\" to see the status code easily
  curl -sSi -w "\\nHTTP Status: %{http_code}\\n" "$endpoint"
  echo "-----------------------------------------"
  sleep 1 # Small delay between requests
done

echo "Stopping Bun dev server (PID: $SERVER_PID)..."
kill "$SERVER_PID"
# Wait a moment to ensure it's killed
sleep 2
# Force kill if it didn't stop (optional, use with caution)
# if ps -p $SERVER_PID > /dev/null; then
#   echo "Server did not stop gracefully, force killing..."
#   kill -9 $SERVER_PID
# fi

echo "API test loop finished."
