#!/usr/bin/env just --justfile --working-directory .

# SEt directory to current
dir := "/Users/develeap/Desktop/Lior/aws-lambda-calculator/aws-lambda-calculator"

import '../.justfile'

# Default recipe to display help information
dummy-default:
	@echo "-=== Easy Management Using Justfile ===-"
	@sleep 0.1
	@echo
	@echo "Initiating chooser...."
	@sleep 0.1
	@just --choose
