## Plan: Dockerize Vite and Publish to ACR + Deploy to ACA

Containerize the Vite app with a multi-stage Docker build, then update Azure Pipelines to build/push the image to ACR using Docker@2 and deploy to Azure Container Apps through an Azure Resource Manager service connection. The plan includes one-time Azure resource provisioning in the pipeline flow, uses `Build.BuildId` + `latest` image tags, and targets a single environment.

**Steps**
1. Validate baseline app build behavior and artifact assumptions before containerization. Confirm `npm run build` creates `dist/` and no custom Vite output path is used. This ensures the Docker build context and runtime copy paths are correct.
2. Add container build assets for the frontend app.
Create `Dockerfile` with a multi-stage build: Node 20 stage to install dependencies and run Vite build, Nginx runtime stage serving static files from `/usr/share/nginx/html`. Add `.dockerignore` to exclude `node_modules`, VCS files, CI files not needed in build context, and local artifacts.
3. Add Nginx SPA routing config for client-side navigation support.
Create `nginx.conf` with `try_files $uri /index.html` so deep links resolve correctly in Container Apps.
4. Define pipeline variables and tagging strategy in `azure-pipelines.yml`.
Add variables for Azure subscription service connection name, ACR name/login server, repository/image name, resource group, Container Apps environment name, and app name. Define tags as `$(Build.BuildId)` and `latest`.
5. Update CI/CD pipeline to build and push the Docker image to ACR.
Use `Docker@2` with Azure service connection for login (`command: login`) and build/push (`command: buildAndPush`) against the new `Dockerfile`. Configure both tags in one pipeline run. Ensure trigger remains on `main`.
6. Add Azure CLI steps to provision required Azure resources (if missing). *depends on 4*
Using `AzureCLI@2` with the same ARM service connection:
- Create resource group (idempotent)
- Create ACR with Basic SKU if not existing
- Create Container Apps environment if not existing
- Ensure ACR admin/userless pull model with managed identity strategy for ACA
7. Add deployment step to Azure Container Apps from pushed ACR image. *depends on 5,6*
Use `AzureCLI@2` to create/update the Container App with ingress enabled and target port 80, referencing image `acrLoginServer/repository:Build.BuildId`. Configure revisions and minimum settings for a single-environment rollout.
8. Wire ACA to pull from ACR securely (managed identity preferred). *depends on 6,7*
Assign system/user managed identity to Container App and grant `AcrPull` role on ACR. Avoid embedded registry passwords in pipeline variables.
9. Add post-deploy validation and rollback-safe checks.
Include CLI checks for provisioning/deployment status, verify active revision health, and print public FQDN. Mark pipeline failure if image push or ACA rollout is unsuccessful.
10. Document operational runbook details. *parallel with 9*
Update `README.md` with prerequisites (service connection permissions), required pipeline variables, first-run behavior, and manual redeploy command examples.

**Relevant files**
- `/Users/meghankulkarni/mapboxjs/azure-pipelines.yml` — extend from Node build-only flow to full Docker build/push + Azure provisioning + Container Apps deployment.
- `/Users/meghankulkarni/mapboxjs/package.json` — reuse existing `build` script (`vite build`) as source for container build stage.
- `/Users/meghankulkarni/mapboxjs/vite.config.js` — confirm default output path assumptions used in Docker copy stage.
- `/Users/meghankulkarni/mapboxjs/Dockerfile` — new multi-stage Node->Nginx image definition.
- `/Users/meghankulkarni/mapboxjs/.dockerignore` — new build-context optimization and leak prevention.
- `/Users/meghankulkarni/mapboxjs/nginx.conf` — new SPA-friendly Nginx server config for static routing.
- `/Users/meghankulkarni/mapboxjs/README.md` — document CI/CD variables, provisioning expectations, and deployment behavior.

**Verification**
1. Local container verification:
`docker build -t vite-app:test .` and `docker run -p 8080:80 vite-app:test`, then verify app and deep-link routes (SPA fallback).
2. Pipeline build/push verification:
Run pipeline on `main`; confirm `Docker@2 buildAndPush` publishes both `Build.BuildId` and `latest` tags in ACR repository.
3. Azure provisioning verification:
Check resource creation idempotency by re-running pipeline and confirming no failures when resources already exist.
4. Deployment verification:
Confirm Container App revision reaches healthy state, ingress URL responds with 200, and deployed revision image matches `Build.BuildId` tag.
5. Security verification:
Validate ACA identity has `AcrPull` and that no plaintext registry secrets are committed to repo/pipeline YAML.

**Decisions**
- Build location: Azure DevOps agent with `Docker@2`.
- Authentication: Azure Resource Manager service connection.
- Image tagging: `Build.BuildId` and `latest`.
- Scope: Include deployment steps (not build/push only).
- Target runtime: Azure Container Apps.
- Environment strategy: Single environment.
- Infra assumption: Provisioning included in pipeline plan.
- Included scope: containerization, CI/CD updates, Azure provisioning for required resources, deployment, verification, and documentation.
- Excluded scope: blue/green or multi-stage environment promotion workflows, IaC refactor to Terraform/Bicep modules, advanced observability dashboards.

**Further Considerations**
1. Container Apps scaling defaults:
Recommendation is min replicas `0` and max `1-3` for cost control initially; adjust after traffic baseline.
2. Image retention policy in ACR:
Recommendation is to keep `latest` plus last N build tags to control storage costs.
3. Future hardening:
Add Trivy/Defender image scan gate before deployment once base pipeline is stable.
