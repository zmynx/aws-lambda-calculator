#!/usr/bin/env just --justfile --working-directory .

import '../../.justfile'

# Default recipe to display help information
[no-cd]
dummy-default:
	@echo "-=== Easy Management Using Justfile ===-"
	@sleep 0.1
	@echo
	@echo "Initiating chooser...."
	@sleep 0.1
	@just --choose

# Use it in recipes
[no-cd]
show-path:
    echo "Justfile is located at: {{justfile_directory()}}"
