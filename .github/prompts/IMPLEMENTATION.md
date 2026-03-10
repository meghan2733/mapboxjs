# GitHub Actions Migration - Implementation Complete

This document summarizes the implementation of the Azure Pipelines to GitHub Actions migration.

## What Was Created

### 1. GitHub Actions Workflow
**File:** `.github/workflows/deploy.yml`

This workflow replaces `azure-pipelines.yml` with the following structure:

#### Three Jobs (Sequential Execution)
- **`provision-azure`** — Creates/verifies Azure resources (RG, ACR, Container Apps environment)
- **`build-and-push`** — Builds Vite app, creates Docker image, pushes to ACR
- **`deploy-app`** — Deploys image to Container Apps, verifies deployment status

#### Key Features
- ✅ **OIDC Authentication** — Secure, keyless Azure access (no stored credentials)
- ✅ **ubuntu-latest Runner** — Linux-based, faster builds than Windows agent
- ✅ **Bash Scripts** — All PowerShell translated to Bash/Azure CLI
- ✅ **Job Dependencies** — Explicit sequencing with `needs:` keyword
- ✅ **Error Handling** — Proper exit code checking and status verification
- ✅ **Deployment Logging** — Clear output with FQDN and resource details

### 2. Setup Documentation

#### `OIDC-SETUP.md`
Step-by-step guide for one-time Azure AD configuration:
- Create app registration
- Add federated credentials
- Assign Contributor role
- Troubleshooting tips

#### `SECRETS-SETUP.md`
Instructions for adding GitHub repository secrets:
- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`

---

## Key Translations from Azure Pipelines

| Azure Pipelines | GitHub Actions | Status |
|---|---|---|
| PowerShell scripts | Bash/Azure CLI | ✅ Translated |
| Variables (`$(Variable)`) | Environment variables & GitHub context | ✅ Converted |
| Tasks (`AzureCLI@2`, `NodeTool@0`) | Actions & shell commands | ✅ Converted |
| Stages → Jobs dependencies | `needs:` keyword | ✅ Implemented |
| Windows path separators | Unix paths (`./`) | ✅ Fixed |
| Azure DevOps auth | Azure OIDC federated creds | ✅ New auth method |
| Build ID (`$(Build.BuildId)`) | Run ID (`github.run_id`) | ✅ Converted |
| Output variables | `$GITHUB_ENV` | ✅ Translated |

---

## Implementation Checklist

### ✅ Phase 1: Workflow Structure
- [x] Created `.github/workflows/` directory
- [x] Created `.github/workflows/deploy.yml` with 3 jobs
- [x] Configured environment variables for all resources
- [x] Set up permissions for OIDC

### ✅ Phase 2: Provision Azure Resources Job
- [x] Translated resource group creation
- [x] Translated ACR creation (with existence check)
- [x] Translated Container Apps environment creation
- [x] Converted PowerShell conditionals to Bash

### ✅ Phase 3: Build & Push Docker Image Job
- [x] Added `actions/setup-node@v4` for Node.js
- [x] Converted npm install/build commands
- [x] Translated Docker build command (fixed paths)
- [x] Implemented Docker push with job dependencies

### ✅ Phase 4: Deploy to Container Apps Job
- [x] Translated container app creation/update logic
- [x] Converted revision readiness polling to Bash loops
- [x] Simplified deployment validation (removed HTTP checks)
- [x] Added FQDN output to workflow logs

### ✅ Phase 5: Syntax Translation
- [x] All PowerShell conditionals → Bash `if` statements
- [x] String comparisons → Bash `[ -z ]` and `[ -n ]`
- [x] Variable output → `echo "X=Y" >> $GITHUB_ENV`
- [x] Loops → Bash `for` loops
- [x] Azure CLI commands → Cross-platform compatible

### ✅ Phase 6: Configuration
- [x] Environment variables defined in workflow
- [x] Secrets schema documented
- [x] OIDC authentication setup documented

### ✅ Phase 7: Documentation
- [x] OIDC setup guide created
- [x] GitHub secrets setup guide created
- [x] This implementation summary

---

## Next Steps

### **Step 1: Set Up OIDC (One-Time)**
Follow [`OIDC-SETUP.md`](./.github/prompts/OIDC-SETUP.md) to:
1. Create app registration in Azure AD
2. Add federated credentials
3. Assign Contributor role

**Estimated time:** 10 minutes

### **Step 2: Add GitHub Secrets**
Follow [`SECRETS-SETUP.md`](./.github/prompts/SECRETS-SETUP.md) to:
1. Add `AZURE_SUBSCRIPTION_ID`
2. Add `AZURE_TENANT_ID`
3. Add `AZURE_CLIENT_ID`

**Estimated time:** 5 minutes

### **Step 3: Test the Workflow**
```bash
# Push to main branch (or create a test branch)
git push origin main

# Monitor workflow in GitHub
# Go to Actions tab and watch the pipeline execute
```

**Estimated time:** 5-10 minutes (depending on resource provisioning)

### **Step 4: Validate Deployment**
Check:
- ✅ Resource group `rg-mapbox-prod` exists in Azure
- ✅ ACR `acrmapboxprod` has new image tags
- ✅ Container App `aca-mapbox-app` is running
- ✅ App is accessible at the FQDN (shown in workflow logs)

**Estimated time:** 5 minutes

### **Step 5: Clean Up (Optional)**
- Archive `azure-pipelines.yml` (keep as reference)
- Update README with new deployment instructions
- Document any environment-specific notes

---

## Important Differences from Azure Pipelines

### 1. Health Checks Removed
The original Azure Pipelines tested `/health` and `/` endpoints. The new workflow only verifies deployment state. If you need HTTP health checks:
- Add curl commands in the "Deployment Summary" step
- Or configure Azure Container Apps health probes separately

### 2. Linux vs. Windows
- **Old:** Windows agent (`AISWinLocal`) with PowerShell
- **New:** Linux agent (`ubuntu-latest`) with Bash
- **Impact:** Slightly faster builds, more familiar tooling, no cross-platform issues expected

### 3. OIDC Instead of Connection String
- **Old:** Azure Service Connection stored auth secrets
- **New:** Federated credentials + OIDC tokens
- **Benefit:** No long-lived secrets, better security, easier rotation

### 4. Single Workflow File
- **Old:** Monolithic `azure-pipelines.yml` with stages
- **New:** `.github/workflows/deploy.yml` with jobs
- **Benefit:** GitHub-native, easier to version in git, better integration

---

## Troubleshooting Quick Reference

| Issue | Solution |
|---|---|
| Workflow doesn't appear | Push to `main` branch; check Actions tab permissions |
| "Authentication failed" | Verify secrets are set correctly (see SECRETS-SETUP.md) |
| "Federated credential error" | Re-check OIDC setup, especially subject matching |
| Docker build fails on ubuntu-latest | Check for Windows-specific dependencies in Dockerfile |
| Resources not provisioned | Verify service principal has Contributor role on subscription |
| Deployment timeout | Container Apps environment may take 5+ min first creation |

---

## Files Reference

```
.github/
├── workflows/
│   └── deploy.yml                 # Main GitHub Actions workflow
└── prompts/
    ├── plan-mapboxJs.prompt.md    # Original migration plan
    ├── OIDC-SETUP.md              # OIDC federated credential setup
    ├── SECRETS-SETUP.md           # GitHub secrets configuration
    └── IMPLEMENTATION.md          # This file
```

---

## Success Criteria

✅ **Workflow Runs Successfully**
- All 3 jobs execute without errors
- Logs show "Deployment Successful!" summary

✅ **Azure Resources Created**
- Resource group exists in Azure Portal
- ACR contains new image tags
- Container Apps shows running revision

✅ **App Is Accessible**
- FQDN from workflow logs resolves
- App loads at `https://aca-fqdn/`
- Nginx routes correctly to React app

✅ **Logs Are Clear**
- Workflow output shows provisioning steps
- Build output shows successful npm build
- Deployment output shows FQDN and status

---

## Questions?

- **Azure CLI issues?** Check [Azure CLI documentation](https://learn.microsoft.com/cli/azure/)
- **GitHub Actions syntax?** Check [GitHub Actions documentation](https://docs.github.com/en/actions)
- **OIDC problems?** See OIDC-SETUP.md troubleshooting section
- **Container Apps?** Check [Azure Container Apps docs](https://learn.microsoft.com/en-us/azure/container-apps/)

---

**Status:** ✅ Migration implementation complete. Ready for OIDC setup and testing.
