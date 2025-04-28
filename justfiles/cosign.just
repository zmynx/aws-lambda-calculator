# Generate key-pair 
cosign-generate:
    echo "Generating key pair using Cosign..."
    cosign generate-key-pair
    gh auth token | read GITHUB_TOKEN && export GITHUB_TOKEN && cosign generate-key-pair github://{{org}}/{{repo}}

# Sign the image
cosign-sign:
    echo "Signing an image..."
    cosign sign --yes --key cosign.key ghcr.io/{{org}}/{{repo}}@sha256:d4e2d83c62707e84f69ac39b86f742a06f887ffe52758645dd846d824af4599f
