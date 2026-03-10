# Quick Reference: GitHub Actions Migration

## TL;DR - 4 Step Setup

### 1️⃣ Create Azure AD App & Federated Creds (5 min)
```bash
# Create app registration
az ad app create --display-name "github-actions-mapbox"

# Get Client ID
APP_ID=$(az ad app list --filter "displayName eq 'github-actions-mapbox'" --query "[0].appId" -o tsv)

# Create service principal
az ad sp create --id $APP_ID

# Assign role
az role assignment create \
  --role "Contributor" \
  --assignee $APP_ID \
  --scope "/subscriptions/$(az account show --query id -o tsv)"

# Add federated credential (replace with YOUR values)
az ad app federated-credential create \
  --id $APP_ID \
  --parameters '{
    "name": "github-repo-main",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:YOUR_GITHUB_USERNAME/mapboxjs:ref:refs/heads/main",
    "audiences": ["api://AzureADTokenExchange"]
  }'
```

### 2️⃣ Get Your Azure IDs
```bash
AZURE_SUBSCRIPTION_ID=$(az account show --query id -o tsv)
AZURE_TENANT_ID=$(az account show --query tenantId -o tsv)
AZURE_CLIENT_ID=$APP_ID  # From step 1

echo "SUBSCRIPTION_ID: $AZURE_SUBSCRIPTION_ID"
echo "TENANT_ID: $AZURE_TENANT_ID"
echo "CLIENT_ID: $AZURE_CLIENT_ID"
```

### 3️⃣ Add GitHub Secrets
Go to GitHub → Repo Settings → Secrets and variables → Actions

Add these 3 secrets:
- `AZURE_SUBSCRIPTION_ID` = (from step 2)
- `AZURE_TENANT_ID` = (from step 2)
- `AZURE_CLIENT_ID` = (from step 2)

Or use CLI:
```bash
gh secret set AZURE_SUBSCRIPTION_ID --body "your-value"
gh secret set AZURE_TENANT_ID --body "your-value"
gh secret set AZURE_CLIENT_ID --body "your-value"
```

### 4️⃣ Test
```bash
git push origin main
# Go to Actions tab and watch workflow run
```

---

## Configuration Values (No Changes Needed)

These are already set in `.github/workflows/deploy.yml`:

| Variable | Value |
|---|---|
| Runner | `ubuntu-latest` |
| ACR Name | `acrmapboxprod` |
| ACR Registry | `acrmapboxprod.azurecr.io` |
| Image Repository | `mapbox-app` |
| Resource Group | `rg-mapbox-prod` |
| Container Apps Name | `aca-mapbox-app` |
| Container Apps Environment | `aca-env-mapbox` |
| Region | `eastus` |
| App Port | `80` |

---

## Workflow Job Sequence

```
provision-azure
    ↓
build-and-push (waits for provision-azure)
    ↓
deploy-app (waits for build-and-push)
```

Each job runs on `ubuntu-latest` with OIDC authentication.

---

## What Each Job Does

### `provision-azure`
- ✅ Creates resource group `rg-mapbox-prod`
- ✅ Creates ACR `acrmapboxprod` (if needed)
- ✅ Creates Container Apps environment (if needed)
- ⏱️ ~1-2 minutes (first run takes longer)

### `build-and-push`
- ✅ Installs Node.js 20.x
- ✅ Runs `npm install` and `npm run build`
- ✅ Builds Docker image from `./Dockerfile`
- ✅ Pushes image to ACR with tags `latest` and CI run ID
- ⏱️ ~5-10 minutes

### `deploy-app`
- ✅ Creates or updates Container App `aca-mapbox-app`
- ✅ Waits for deployment to reach `Provisioned` state (max 60 sec)
- ✅ Outputs public FQDN URL
- ⏱️ ~2-5 minutes

**Total Runtime:** ~10-20 minutes (first run), ~5-10 minutes (subsequent runs)

---

## Outputs & Logs

After successful deployment, check workflow logs for:

```
Container App URL: https://aca-mapbox-app.xyz.eastus.azurecontainerapps.io
```

Access your app at this URL!

---

## Common Issues

| Error | Fix |
|---|---|
| `federated identity credential is not configured` | Re-check OIDC subject matches exactly: `repo:OWNER/REPO:ref:refs/heads/main` |
| `Authentication failed with no error description` | Verify all 3 GitHub secrets are set correctly |
| `Resource group not found` | Ensure service principal has Contributor role on subscription |
| `Docker build fails` | Check Dockerfile uses cross-platform compatible commands |
| `Workflow doesn't start` | Push to `main` branch (trigger is on main only) |

---

## Verify Everything Works

```bash
# 1. Check workflow file syntax
yamllint .github/workflows/deploy.yml

# 2. Check Azure login
az login

# 3. Check you can query resources
az group list --output table

# 4. Verify GitHub secrets are set
gh secret list
```

---

## Comparison: Old vs. New

| Aspect | Azure Pipelines | GitHub Actions |
|---|---|---|
| Config File | `azure-pipelines.yml` | `.github/workflows/deploy.yml` |
| Runner | Windows (AISWinLocal) | Linux (ubuntu-latest) |
| Language | PowerShell | Bash |
| Auth | Service Connection | OIDC Federated Creds |
| Trigger | On push to main | On push to main |
| Secrets | Azure DevOps Secrets | GitHub Secrets |
| Build Time | ~10-20 min | ~5-10 min (Linux faster) |

---

## Next Steps After First Success

1. ✅ Verify app loads and works correctly
2. 📝 Update README with new workflow info
3. 🗑️ Archive `azure-pipelines.yml` as reference
4. 🔐 Verify Azure AD app is tagged/documented
5. 📅 Set calendar reminder to rotate OIDC creds every 6-12 months (best practice)

---

## Reference Links

- 📖 [Full Implementation Guide](./IMPLEMENTATION.md)
- 🔐 [Detailed OIDC Setup](./OIDC-SETUP.md)
- 🔑 [GitHub Secrets Setup](./SECRETS-SETUP.md)
- 📋 [Original Migration Plan](./plan-mapboxJs.prompt.md)

---

✅ **Ready to start?** Follow steps 1️⃣-4️⃣ above!
