#!/bin/bash

# Build all plugins in the plugins directory

# Get a list of all plugins in the plugins directory
plugins=$(ls plugins)

# Build each plugin
# Array to hold the commands for concurrently
build_commands=()

# Populate the array with commands for each plugin
for plugin_name in $plugins; do
  # Each command changes to the plugin's directory and runs npm run build.
  # Quoting \"plugins/$plugin_name\" handles cases where plugin names might contain spaces,
  # though this is uncommon for directory names.
  build_commands+=("cd \"plugins/$plugin_name\" && npm run build")
done

# Check if there are any commands to run (i.e., if plugins were found)
if [ ${#build_commands[@]} -gt 0 ]; then
  # Run all build commands in parallel using concurrently.
  # --kill-others-on-fail: If one build command fails, concurrently will stop all other running commands.
  # Consider adding other concurrently options like --names "p1,p2,..." or --prefix-colors "auto" for more detailed/readable output if needed.
  concurrently --kill-others-on-fail "${build_commands[@]}"
else
  echo "No plugins found in 'plugins/' directory to build."
fi