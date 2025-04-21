#!/bin/bash
# Installation script for the containers
# This script will build the containers using apptainer
#
# Usage: ./install.sh [--rebuild[=container1,container2,...]]
#    or: ./install.sh [--rebuild] [container1 container2 ...]
#
# Valid container names: demo_api, sam2, metrabs, capex, skel3d
#
# Examples:
#   ./install.sh                              Build all containers that haven't been built yet
#   ./install.sh demo_api skel3d              Build only demo_api and skel3d containers
#   ./install.sh --rebuild                    Force build all containers
#   ./install.sh --rebuild=demo_api,skel3d    Force build demo_api and skel3d containers
#   ./install.sh --rebuild demo_api skel3d    Force build demo_api and skel3d containers


# Check if apptainer is installed
if ! command -v apptainer &> /dev/null; then
	echo "Apptainer could not be found. Please install Apptainer first."
	exit -1
fi

# Check if the containers directory exists
if [ ! -d "./containers" ]; then
	echo "The containers directory does not exist. Please make sure the containers directory is in the same directory as the install.sh script."
	exit -1
fi


# Check if the user requested rebuild
rebuild_flag=false
containers=()

# Handle different ways of specifying rebuild
# Case: --rebuild component1 component2
if [[ "$1" == "--rebuild" ]]; then
	rebuild_flag=true
	if [ $# -gt 1 ]; then
		containers=("${@:2}")
	fi

# Case: --rebuild=component1,component2
elif [[ "$1" == "--rebuild="* ]]; then
	rebuild_flag=true
	components="${1#*=}"
	IFS=',' read -r -a containers <<< "$components"

# If rebuild flag is not set, check for specific containers
elif [ $# -gt 0 ]; then
	containers=("$@")
fi


# Function to check if a container needs to be built/rebuilt
should_build() {
	local container=$1

	# Check if any containers were provided (non-rebuild mode)
	if [ ${#containers[@]} -eq 0 ]; then
		return 0  # No specific containers provided, build all
	fi
	
	# Look for the container in the list of containers to build/rebuild
	for cont in "${containers[@]}"; do
		if [ "$cont" == "$container" ]; then
			return 0  # Success = true
		fi
	done
	
	return 1  # Failure = false
}


# Function to build containers
build_container() {
	local container=$1
	local name=$2
	local needs_nv=$3
	
	# Build the container if required
	if should_build "$container" && ([ ! -f "$container.sif" ] || [ "$rebuild_flag" == "true" ]); then
		echo -e "\n\e[1;34mBuilding $name container\e[0m"
		# Build command with --nv option if needed
		cmd=(apptainer build --force)
		[ -n "$needs_nv" ] && cmd+=(--nv)
		cmd+=(--bind $(pwd):/mnt "$container.sif" "containers/$container.def")
		
		# Execute command
		"${cmd[@]}"
		if [ $? -ne 0 ]; then
			echo -e "\e[1;31m$name container could not be built. Exiting...\e[0m"
			exit -1
		else
			echo -e "\e[1;32m$name container built successfully\e[0m"
		fi

	# If not required, skip the build
	# Only print the message if build was requested
	elif should_build "$container"; then
		echo -e "\e[33m$name container already exists. Skipping build...\e[0m"
	fi
}


# Build Demo API container
build_container "demo_api" "Demo API"

# Build SAM2 container
build_container "sam2" "SAM2" "--nv"

# Build MeTRAbs container
build_container "metrabs" "MeTRAbs" "--nv"

# Build CapeX container
build_container "capex" "CapeX" "--nv"

# Build Skel3D container
build_container "skel3d" "Skel3D" "--nv"