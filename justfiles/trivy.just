# Scan config files for misconfigurations
trivy-config:
    echo "Running Trivy IaC and Configuration security checker..."
    trivy config .

# Scan local filesystem
trivy-fs:
    echo "Running Trivy FileSystem security checker..."
    trivy fs .

# Scan a container image
trivy-image:
    echo "Running Trivy image security checker..."
    trivy image ghcr.io/zmynx/aws-lambda-calculator

# Scan a repository
trivy-repository:
    echo "Running Trivy repository security checker..."
    trivy repository .

# Scan SBOM for vulnerabilities and licenses
trivy-sbom:
    echo "Running Trivy sbom security checker..."
    trivy sbom .
