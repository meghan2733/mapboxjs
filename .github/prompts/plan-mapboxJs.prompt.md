# Plan: Migrate Azure Pipelines to GitHub Actions

## TL;DR
Migrate the 3-stage Azure Pipelines CI/CD workflow to GitHub Actions using `ubuntu-latest` runners. The workflow will use Azure OIDC federated credentials for secure authentication, maintain automatic Azure resource provisioning (RG, ACR, Container Apps), build & push container images, and deploy to Azure Container Apps. Health checks will be omitted for a leaner deployment process.

**Key changes:**
- Azure DevOps → GitHub Actions YAML syntax
- Windows agent (AISWinLocal) → ubuntu-latest Linux runner
- PowerShell → Bash/Azure CLI
- Azure DevOps variables → GitHub Actions secrets/environment variables
- 3 stages → Single workflow with 3 jobs

---

## Steps

### Phase 1: GitHub Actions Workflow Structure & Setup
1. Create `.github/workflows/` directory structure
2. Create main workflow file `.github/workflows/deploy.yml` with:
   - Trigger: on push to main branch
   - Environment variables: ACR name, RG, Container Apps config
   - Secrets: Azure subscription ID, Azure client ID (for OIDC)
3. Configure 3 jobs: `provision-azure`, `build-and-push`, `deploy-app` (with job dependencies)
4. Set up OIDC configuration in GitHub (requires one-time Azure setup for federated credentials)

### Phase 2: Provision Azure Resources Job
5. Translate Azure PowerShell scripts to Bash-compatible Azure CLI equivalents:
   - Resource group creation
   - ACR creation  
   - Container Apps environment creation
6. Replace Azure DevOps task syntax with GitHub Actions `azure/cli@v2` or `azure/login@v2`
7. Update condition logic from YAML to GitHub Actions syntax

### Phase 3: Build & Push Docker Image Job
8. Translate build job:
   - Replace `NodeTool@0` with `actions/setup-node@v4`
   - Replace `Npm@1` with `npm` commands via `run:` directive
   - Replace `CmdLine@2` Docker commands with direct `docker` commands in Linux bash
   - Update working directory references (from Windows paths to Unix)
9. Docker build command: adapt Windows path syntax `\Dockerfile` → `./Dockerfile`
10. Use environment variables for image tag (GitHub Actions provides `github.run_id`)

### Phase 4: Deploy to Container Apps Job
11. Translate deployment job:
    - ACR image pull & update logic
    - Revision readiness polling (Bash compatible)
    - Remove `/health` and `/` endpoint tests (per decision)
    - Output deployment FQDN
12. Add proper error handling and logging for readiness checks
13. Simplify validation: just verify deployment state, skip HTTP checks

### Phase 5: Syntax & Tool Translation
14. Translate all PowerShell-specific syntax:
    - `$LASTEXITCODE` → check exit codes with Bash
    - String comparisons: `[string]::IsNullOrEmpty()` → `[ -z "$VAR" ]`
    - Variable setting: `Write-Host "##vso[task.setvariable variable=X]$Y"` → `echo "X=$Y" >> $GITHUB_ENV`
    - Loop syntax: PowerShell `for` → Bash `for`
    - Retry/sleep logic: translate to Bash equivalents
15. Ensure all Azure CLI commands are cross-platform compatible (they should be)

### Phase 6: Environment & Secrets Configuration
16. Update variable names:
    - Map Azure DevOps variables to GitHub Actions equivalents
    - Store sensitive values in GitHub repository secrets: `AZURE_SUBSCRIPTION_ID`, `AZURE_CLIENT_ID`, `AZURE_TENANT_ID` (for OIDC)
    - Store configuration in GitHub environment variables or workflow file defaults
17. Document required secrets in a setup guide (for reference)

### Phase 7: Testing & Validation
18. Syntax validation: Verify YAML is valid using `yamllint` or GitHub's workflow validation
19. Create test run: Trigger workflow on a test branch to validate provisioning logic
20. Verify all resource naming conventions match (RG names, ACR names, etc.)
21. Check Docker build succeeds on ubuntu-latest (may have different dependencies vs Windows)
22. Confirm ACR push works with OIDC auth
23. Verify Container Apps deployment completes and app is accessible
24. Compare final deployment FQDN output between old and new workflow

---

## Relevant Files

- `azure-pipelines.yml` — Source pipeline to translate (current approach)
- `.github/workflows/deploy.yml` — New GitHub Actions workflow (to create)
- `package.json` — Define build commands, Node.js version (20.x)
- `Dockerfile` — Multi-stage build (Node 20-Alpine + Nginx-Alpine)
- `nginx.conf` — Nginx routing config for SPA (should not change)

---

## Verification Checklist

1. **Syntax validation:** Run `yamllint .github/workflows/deploy.yml` to ensure valid YAML
2. **Workflow trigger:** Push to main branch and confirm workflow appears in Actions tab
3. **Provision stage:**
   - Check that resource group exists in Azure (or verify it already exists)
   - ACR exists and is reachable at `acrmapboxprod.azurecr.io`
   - Container Apps environment is created
4. **Build stage:**
   - Confirm Node modules install successfully on ubuntu-latest
   - `npm run build` produces artifacts in `dist/`
   - Docker image builds without errors
   - Image is tagged with `build-id` and `latest` in ACR
5. **Deploy stage:**
   - Verify Container App revision reaches `Provisioned` state within timeout
   - Container App image is updated to new tag
   - App is accessible at the output FQDN
   - Nginx routes SPA traffic correctly to `index.html`
6. **Compare outputs:** Check workflow logs match expected resource IDs and URLs

---

## Decision Log

- **Auth Method:** OpenID Connect (OIDC) with federated credentials for secure, keyless authentication (no stored secrets)
- **Runner:** `ubuntu-latest` (hard-coded in workflow) — requires translating all PowerShell to Bash/Azure CLI
- **Health checks:** Omitted for simplicity — only validates deployment state, not HTTP responses
- **Resource provisioning:** Kept automatic in workflow (not moved to separate IaC pipeline)
- **Job dependencies:** Explicit sequential execution (`needs:` keyword) — Provision → Build → Deploy
- **Error handling:** Continue same error checking logic but adapted to Bash exit codes

---

## Further Considerations

1. **OIDC Setup Required:** Requires one-time configuration in Azure AD / GitHub settings. Cannot be scripted from workflow and must be done beforehand.

2. **Linux vs. Windows Behavior:** Docker build on ubuntu-latest (Linux) should be faster and require fewer resources than Windows agent. No known compatibility issues with the current Dockerfile.

3. **Logging & Debugging:** GitHub Actions logs are more concise than Azure DevOps. Plan includes standard logging without verbose debug mode unless troubleshooting is needed.

---

## Implementation Sequence

### ✅ Completed
1. ✅ Create `.github/workflows/` directory
2. ✅ Create `.github/workflows/deploy.yml` with all three jobs
3. ✅ Create OIDC setup documentation
4. ✅ Create GitHub secrets setup documentation
5. ✅ Create implementation guide and quick reference

### 📋 Next Steps (User Action Required)
6. Set up GitHub repository secrets for OIDC credentials (see SECRETS-SETUP.md)
7. Perform one-time OIDC federated credential setup in Azure AD (see OIDC-SETUP.md)
8. Test workflow on main branch
9. Validate each stage (provision → build → deploy)
10. Verify app accessibility and functionality
11. Document any environment-specific notes

---

## Files Delivered

- **`.github/workflows/deploy.yml`** — Production-ready GitHub Actions workflow
- **`OIDC-SETUP.md`** — Step-by-step OIDC federated credential setup
- **`SECRETS-SETUP.md`** — GitHub secrets configuration guide
- **`IMPLEMENTATION.md`** — Complete implementation details and troubleshooting
- **`QUICK-REFERENCE.md`** — Quick setup checklist and common issues
