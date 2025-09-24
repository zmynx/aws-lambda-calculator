# Build Container using Podman
[no-cd]
podman-build:
    echo "Building the container using podman..."
    podman build -f Containerfile -t ghcr.io/{{org}}/{{repo}}:$(python -m poetry version -s)

# Connect to the GitHub Registery
[no-cd]
podman-login:
    echo "Logging into the GitHub registery..."
    podman login ghcr.io --authfile .podman-auth.secret

# Publish image to registery
[no-cd]
podman-push: podman-login
    echo "Pusing image to ghcr.io registery..."
    podman build -f Containerfile -t ghcr.io/{{org}}/{{repo}}:$(python -m poetry version -s)

# Build using the compose file
[no-cd]
podman-compose-build:
    echo "Building the container using podman compose..."
    podman compose build
