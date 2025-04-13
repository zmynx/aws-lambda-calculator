# Run Super-Linter in a container
superlinter-run:
    podman run \
      --env LOG_LEVEL=DEBUG \
      --env RUN_LOCAL=true \
      --env VALIDATE_GITHUB_ACTIONS=true \
      --env ENABLE_ACTIONLINT=true \
      --volume ./:/tmp/lint \
      ghcr.io/super-linter/super-linter:latest
# --volume ./.git:/tmp/lint/.git \
# --volume ./.github:/tmp/lint/.github \
