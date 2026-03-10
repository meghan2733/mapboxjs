# Mapbox React + Vite Application

A modern React application built with Vite and Mapbox GL for interactive mapping capabilities.

## Features

- **React 18** with Vite for fast development and optimized builds
- **Mapbox GL** for interactive map visualization
- **Docker containerization** with multi-stage builds for production readiness
- **Azure Container Apps** deployment with automated CI/CD via Azure Pipelines
- **SPA routing** support through Nginx configuration
- **ESLint** for code quality enforcement

## Local Development

### Prerequisites

- Node.js 20.x or higher
- npm (includes with Node.js)

### Setup

```bash
# Install dependencies
npm install

# Start development server (runs on http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Lint code
npm run lint
```

## Docker & Deployment

### Local Container Testing

```bash
# Build the Docker image locally
docker build -t mapbox-app:test .

# Run container locally (accessible on http://localhost:8080)
docker run -p 8080:80 mapbox-app:test
```

### Azure Deployment Prerequisites

Before deploying to Azure Container Apps, ensure:

1. **Azure Subscription** with active service connection in Azure DevOps
2. **Service Principal** with permissions to:
   - Create and manage resource groups
   - Create and manage Azure Container Registry (ACR)
   - Create and manage Azure Container Apps (ACA)
   - Assign roles (AcrPull)

3. **Azure DevOps Service Connection** configured:
   - Go to Project Settings > Service Connections
   - Create **Azure Resource Manager** connection named `Azure Subscription`
   - Grant required permissions to the service principal

### CI/CD Pipeline Variables

The `azure-pipelines.yml` file uses these configurable variables:

| Variable | Default | Purpose |
|----------|---------|---------|
| `AzureServiceConnectionName` | `Azure Subscription` | Azure DevOps service connection name |
| `AcrResourceGroup` | `rg-mapbox-prod` | Resource group for ACR |
| `AcrName` | `acrmapboxprod` | Azure Container Registry name |
| `AcrLoginServer` | `acrmapboxprod.azurecr.io` | ACR login server URL |
| `ImageRepository` | `mapbox-app` | Image repository name in ACR |
| `AcaResourceGroup` | `rg-mapbox-prod` | Resource group for Container Apps |
| `AcaEnvironmentName` | `aca-env-mapbox` | Container Apps environment name |
| `AcaAppName` | `aca-mapbox-app` | Container App instance name |

**To customize** for your environment, edit these variables in `azure-pipelines.yml`.

### Pipeline Execution Flow

The pipeline runs automatically on every push to the `main` branch and includes these stages:

#### Stage 1: Build & Push Image
- Installs Node.js 20
- Runs `npm install` and `npm run build`
- Logs into Azure Container Registry
- Builds and pushes Docker image with tags: `BUILD_ID` and `latest`

#### Stage 2: Provision Azure Resources
- Creates resource group (idempotent - safe to re-run)
- Creates ACR with Basic SKU if not existing
- Creates Container Apps environment if not existing

#### Stage 3: Deploy to Container Apps
- Creates or updates Container App with:
  - Ingress on port 80
  - Min replicas: 1, Max replicas: 3
  - System-managed identity for ACR pull
- Waits for revision to be provisioned (max 60 seconds)
- Tests health endpoint (`/health`)
- Tests main app endpoint (`/`)
- Outputs Container App public FQDN

### Deploy Manually (Re-trigger Existing Container App)

To redeploy the latest image to an existing Container App:

```bash
# Using Azure CLI
az containerapp update \
  --name aca-mapbox-app \
  --resource-group rg-mapbox-prod \
  --image acrmapboxprod.azurecr.io/mapbox-app:latest
```

Or re-run the pipeline from Azure DevOps.

### Access Deployed Application

After successful deployment, the pipeline output will display:

```
Deployment successful!
Access your app at: https://<your-app>.azurecontainerapps.io
```

Navigate to this URL in your browser to access the application.

### Troubleshooting

**Pipeline fails on Docker login:**
- Verify Azure Pipelines service connection is properly configured
- Check service principal has ACR access

**Container App health check fails:**
- Verify `/health` endpoint is accessible (defined in `nginx.conf`)
- Check Container App revision is in "Provisioned" state
- Review Container App logs in Azure Portal

**Deep linking not working in deployed app:**
- Confirm `nginx.conf` contains `try_files $uri /index.html`
- Check SPA routing is correctly configured for your routes

## Project Structure

```
.
├── src/                    # React source code
│   ├── App.jsx            # Main app component
│   ├── MapboxExample.jsx  # Mapbox integration
│   ├── main.jsx           # React entry point
│   └── assets/            # Static assets
├── Dockerfile             # Multi-stage Docker build
├── nginx.conf             # SPA routing configuration
├── .dockerignore           # Docker build context optimization
├── vite.config.js         # Vite configuration
├── azure-pipelines.yml    # CI/CD pipeline definition
└── package.json           # Dependencies and scripts
```

## Deployment Verification Checklist

- [ ] Service connection configured in Azure DevOps
- [ ] Azure resource creation attempted (check for errors)
- [ ] Docker image built and tagged in ACR
- [ ] Container App created/updated successfully
- [ ] Health endpoint returns 200 OK
- [ ] Main app endpoint returns 200 OK
- [ ] Can access app via output FQDN
- [ ] SPA deep links work (e.g., `/some-route`)

## Tech Stack

- **Frontend**: React 18, Vite, Mapbox GL
- **Build**: Vite, Docker (multi-stage)
- **Runtime**: Nginx (alpine)
- **CI/CD**: Azure Pipelines
- **Cloud**: Azure Container Registry, Azure Container Apps
- **Code Quality**: ESLint
