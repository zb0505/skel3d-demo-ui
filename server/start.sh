#!/bin/bash
# This script starts all built containers as services
# Uses apptainer to run the containers
#
# Usage: ./start.sh
#    or: ./start.sh [container1 container2 ...]
#
# Valid container names: demo_api, sam2, metrabs, capex, skel3d
#
# Examples:
#   ./start.sh                    Start all services
#   ./start.sh demo_api skel3d    Start services for demo_api and skel3d only


# Check if apptainer is installed
if ! command -v apptainer &> /dev/null; then
	echo "Apptainer could not be found. Please install Apptainer first."
	exit -1
fi


# Check if the user requested only to start specific containers
start_containers=("${@:1}")

# Function to check if a container needs to be rebuilt
should_start() {
	local container=$1
	
	for cont in "${start_containers[@]}"; do
		if [ "$cont" == "$container" ]; then
			return 0  # Success = true
		fi
	done
	
	return 1  # Failure = false
}


# Start the given service
start_service() {
	local service_name=$1
	local container_name=$2
	local instance_name=$3
	local needs_nv=$4

	# Check if the container exists
	if [ ! -f "$container_name.sif" ]; then
		echo -e "\n\e[33m$service_name container not found. Skipping...\e[0m"
		return
	elif [ -n "$start_containers" ] && ! should_start "$container_name"; then
		echo -e "\n\e[33mSkipping $service_name container...\e[0m"
		return
	fi
	echo -e "\n\e[1;34m===== Starting $service_name service =====\e[0m"
	# Build command with --nv option if needed
	cmd=(apptainer instance start)
	[ -n "$needs_nv" ] && cmd+=(--nv)
	cmd+=("$container_name.sif" "$instance_name")

	# Execute command
	"${cmd[@]}" || echo -e "\e[33m$service_name service could not be started, exit code: $?\e[0m"
}


# Start Demo API container
start_service "Demo API" "demo_api" "demo-api-service"

# Start SAM2 container
start_service "SAM2" "sam2" "sam2-service" "--nv"

# Start MeTRAbs container
start_service "MeTRAbs" "metrabs" "metrabs-service" "--nv"

# Start CapeX container
start_service "CapeX" "capex" "capex-service" "--nv"

# Start Skel3D container
start_service "Skel3D" "skel3d" "skel3d-service" "--nv"