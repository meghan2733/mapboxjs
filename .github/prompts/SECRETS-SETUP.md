# GitHub Secrets Setup Guide

This guide explains how to configure the required GitHub repository secrets for the CI/CD workflow to authenticate with Azure.

## Required Secrets

Create these three secrets in your GitHub repository settings:

| Secret Name | Description | How to Get |
|---|---|---|
| `AZURE_SUBSCRIPTION_ID` | Your Azure subscription ID (GUID) | `az account show --query id -o tsv` |
| `AZURE_TENANT_ID` | Your Azure tenant/directory ID (GUID) | `az account show --query tenantId -o tsv` |
| `AZURE_CLIENT_ID` | Service principal / app registration client ID | From federated credentials setup (see OIDC-SETUP.md) |

## Steps to Add Secrets

### Via GitHub Web UI

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** for each secret:
   - Name: `AZURE_SUBSCRIPTION_ID`
   - Value: (paste your subscription ID)
4. Repeat for `AZURE_TENANT_ID` and `AZURE_CLIENT_ID`

### Via GitHub CLI

```bash
# Assuming you have gh CLI installed and authenticated
gh secret set AZURE_SUBSCRIPTION_ID --body "your-subscription-id"
gh secret set AZURE_TENANT_ID --body "your-tenant-id"
gh secret set AZURE_CLIENT_ID --body "your-client-id"
```

## Getting Your Azure IDs

```bash
# Show all subscription and tenant info
az account show --output table

# Or individually:
az account show --query id -o tsv              # Subscription ID
az account show --query tenantId -o tsv        # Tenant ID
```

## Next Steps

After adding these secrets, complete the **one-time OIDC federated credential setup** in Azure AD before running the workflow. See [OIDC-SETUP.md](./OIDC-SETUP.md) for detailed instructions.

---

**Important:** Never commit these values to git. GitHub secrets are encrypted and only exposed to workflow runs.
