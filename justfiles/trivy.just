# Scan config files for misconfigurations
[no-cd]
trivy-config:
    echo "Running Trivy IaC and Configuration security checker..."
    trivy config .

# Scan local filesystem
[no-cd]
trivy-fs:
    echo "Running Trivy FileSystem security checker..."
    trivy fs .

# Scan a container image
[no-cd]
trivy-image:
    echo "Running Trivy image security checker..."
    trivy image ghcr.io/zmynx/aws-lambda-calculator

# Scan a repository
[no-cd]
trivy-repository:
    echo "Running Trivy repository security checker..."
    trivy repository .

# Scan SBOM for vulnerabilities and licenses
[no-cd]
trivy-sbom:
    echo "Running Trivy sbom security checker..."
    trivy sbom .
