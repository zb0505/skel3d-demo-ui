#!/bin/bash
# This script stops all running containers
# Uses apptainer to stop the containers
#
# Usage: ./stop.sh
#    or: ./stop.sh [container1 container2 ...]
#
# Valid container names: demo_api, sam2, metrabs, capex, skel3d
#
# Examples:
#   ./stop.sh                    Stop all services
#   ./stop.sh demo_api skel3d    Stop services for demo_api and skel3d only


# Check if apptainer is installed
if ! command -v apptainer &> /dev/null; then
	echo "Apptainer could not be found. Please install Apptainer first."
	exit -1
fi


# Check if the user requested only to start specific containers
stop_containers=("${@:1}")

# Function to check if a container needs to be rebuilt
should_stop() {
	local container=$1
	
	for cont in "${stop_containers[@]}"; do
		if [ "$cont" == "$container" ]; then
			return 0  # Success = true
		fi
	done
	
	return 1  # Failure = false
}


# Stop the given service
stop_service() {
	local service_name=$1
	local container_name=$2
	local instance_name=$3

	# Check if the container exists
	if [ ! -f "$container_name.sif" ]; then
		echo -e "\n\e[33m$service_name container not found. Skipping...\e[0m"
		return
	elif [ -n "$stop_containers" ] && ! should_stop "$container_name"; then
		echo -e "\n\e[33mSkipping $service_name container...\e[0m"
		return
	fi
	echo -e "\n\e[1;34m===== Stopping $service_name service =====\e[0m"
	apptainer instance stop --timeout 60 "$instance_name" || echo -e "\e[33m$service_name service could not be stopped, exit code: $?\e[0m"
}


# Stop Demo API container
stop_service "Demo API" "demo_api" "demo-api-service"

# Stop SAM2 container
stop_service "SAM2" "sam2" "sam2-service"

# Stop MeTRAbs container
stop_service "MeTRAbs" "metrabs" "metrabs-service"

# Stop CapeX container
stop_service "CapeX" "capex" "capex-service"

# Stop Skel3D container
stop_service "Skel3D" "skel3d" "skel3d-service"