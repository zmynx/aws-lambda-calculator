#!/usr/bin/env just --justfile

# Set shell for non-Windows OSs:
set shell := ["/bin/bash", "-c"]

## Set the shell for windows users
set windows-powershell := true

# set defaults
bin       := "./src/main.py"
req_file  := "./requirements.txt"
org       := "zmynx"
repo      := "aws-lambda-calculator"
region    := "us-east-1"
account_id:= "012345678901"
profile   := "default"

####################################################################################################################################################################################
## General recipes
####################################################################################################################################################################################

import 'justfiles/cosign.just'
import 'justfiles/podman.just'
import 'justfiles/poetry.just'
import 'justfiles/trivy.just'
import 'justfiles/superlinter.just'
import 'justfiles/cdk.just'

# Default recipe to display help information
[no-cd]
default:
	@echo "-=== Easy Management Using Justfile ===-"
	@sleep 0.1
	@echo
	@echo "Initiating chooser...."
	@sleep 0.1
	@just --choose --unsorted

# Help command to display available tasks
[no-cd]
help:
    @just --list
