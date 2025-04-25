#!/bin/bash
# Test runner script for the containers
# Collects results of all container tests
#
# Usage: ./test.sh
#    or: ./test.sh [container1 container2 ...]
#
# Valid container names: demo_api, sam2, metrabs, capex, skel3d
#
# Examples:
#   ./test.sh                    Run all tests
#   ./test.sh demo_api skel3d    Run tests for demo_api and skel3d only


# Check if apptainer is installed
if ! command -v apptainer &> /dev/null; then
	echo "Apptainer could not be found. Please install Apptainer first."
	exit -1
fi


# Check if the user requested only to test specific containers
test_containers=("${@:1}")

# Function to check if a container needs to be tested
should_test() {
	local container=$1
	
	for cont in "${test_containers[@]}"; do
		if [ "$cont" == "$container" ]; then
			return 0  # Success = true
		fi
	done
	
	return 1  # Failure = false
}


# Function to run test and parse results
run_test() {
	local container=$1
	local name=$2
	local needs_nv=$3
	local test_output
	local passed=0
	local failed=0
	local warnings=0
	local skipped=0
	local errors=0

	# Check if the container exists or should be tested
	if [ ! -f "$container.sif" ]; then
		echo -e "\n\e[33m$name container not found. Skipping...\e[0m"
		return
	elif [ -n "$test_containers" ] && ! should_test "$container"; then
		echo -e "\n\e[33mSkipping $name...\e[0m"
		return
	fi
	
	echo -e "\n\e[1;34m===== Testing $name =====\e[0m"
	
	# Run test and capture output
	if [ -n "$needs_nv" ]; then
		test_output=$(apptainer test --nv "$container.sif" 2>&1)
	else
		test_output=$(apptainer test "$container.sif" 2>&1)
	fi
	
	# Display test output
	echo "$test_output"
	
	# Parse test results
	test_output=$(echo "$test_output" | grep -E '^=+ [0-9]+ (passed|failed|warning|skipped|error)' | tail -1)
	passed=$(echo "$test_output" | grep -o '[0-9]* passed' | grep -o '[0-9]*' || echo 0)
	failed=$(echo "$test_output" | grep -o '[0-9]* failed' | grep -o '[0-9]*' || echo 0)
	warnings=$(echo "$test_output" | grep -o '[0-9]* warning' | grep -o '[0-9]*' || echo 0)
	skipped=$(echo "$test_output" | grep -o '[0-9]* skipped' | grep -o '[0-9]*' || echo 0)
	errors=$(echo "$test_output" | grep -o '[0-9]* error' | grep -o '[0-9]*' || echo 0)
	
	# Print summary
	# Passed tests
	if [ "$passed" -gt 0 ]; then
		echo -e "\n\e[1;32mPassed: $passed\e[0m"
	else
		echo -e "\nPassed: 0"
	fi
	# Failed tests
	if [ "$failed" -gt 0 ]; then
		echo -e "\e[1;31mFailed: $failed\e[0m"
	else
		echo -e "Failed: 0"
	fi
	# Warnings
	if [ "$warnings" -gt 0 ]; then
		echo -e "\e[1;33mWarnings: $warnings\e[0m"
	else
		echo -e "Warnings: 0"
	fi
	# Skipped tests
	if [ "$skipped" -gt 0 ]; then
		echo -e "\e[1;36mSkipped: $skipped\e[0m"
	else
		echo -e "Skipped: 0"
	fi
	# Errors
	if [ "$errors" -gt 0 ]; then
		echo -e "\e[1;31mErrors: $errors\e[0m"
	else
		echo -e "Errors: 0"
	fi

	# Add to total counters
	total_passed=$((total_passed + passed))
	total_failed=$((total_failed + failed + errors))
	
	# Return the number of failed tests to track overall status
	return $((failed + errors))
}

# Initialize total counters
total_passed=0
total_failed=0
any_failures=0


# Run tests for each container
echo -e "\e[1;35m========== Starting Tests ==========\e[0m\n"

run_test "demo_api" "Demo API"
if [ "$?" -gt 0 ]; then any_failures=1; fi

run_test "sam2" "SAM2" "--nv"
if [ "$?" -gt 0 ]; then any_failures=1; fi

run_test "metrabs" "MeTRAbs" "--nv"
if [ "$?" -gt 0 ]; then any_failures=1; fi

run_test "capex" "CapeX" "--nv"
if [ "$?" -gt 0 ]; then any_failures=1; fi

run_test "skel3d" "Skel3D" "--nv"
if [ "$?" -gt 0 ]; then any_failures=1; fi

echo -e "\n\e[1;35m========== Test Summary ==========\e[0m"


# Print final status
if [ "$any_failures" -eq 0 ]; then
	echo -e "\n\e[1;32mAll tests passed ($total_passed / $total_passed)\e[0m\n"
	exit 0
else
	echo -e "\n\e[1;32mPassed: $total_passed\e[0m"
	echo -e "\e[1;31mFailed: $total_failed\e[0m\n"
	exit 1
fi