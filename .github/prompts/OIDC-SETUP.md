# Azure OIDC Federated Credential Setup Guide

This guide explains how to set up OpenID Connect (OIDC) federated credentials in Azure for GitHub Actions to authenticate without storing long-lived secrets.

## Prerequisites

- Azure subscription with permissions to create/manage app registrations
- GitHub repository access with admin permissions to add secrets
- Azure CLI installed (`az` command)

## Overview

OpenID Connect allows GitHub Actions to authenticate with Azure without storing Azure credentials as GitHub secrets. Instead, Azure AD trusts the GitHub token issuer, and GitHub provides an OIDC token that Azure validates.

**Benefits:**
- No long-lived secrets to rotate
- Audit trail in Azure AD
- GitHub Actions has minimal privileges for each job
- Compliance-friendly (no stored credentials)

## Step 1: Create an App Registration in Azure AD

```bash
# Create app registration
az ad app create --display-name "github-actions-mapbox"

# Get the application ID (Client ID)
APP_ID=$(az ad app list --filter "displayName eq 'github-actions-mapbox'" --query "[0].appId" -o tsv)
echo "Client ID: $APP_ID"
```

Save the `APP_ID` (Client ID) — you'll need this for GitHub secrets.

## Step 2: Create a Service Principal

```bash
# Create service principal for the app
az ad sp create --id $APP_ID

# Assign Contributor role to the service principal
# (Adjust scope to your specific resource group or subscription as needed)
az role assignment create \
  --role "Contributor" \
  --assignee $APP_ID \
  --scope "/subscriptions/$(az account show --query id -o tsv)"
```

## Step 3: Add Federated Credentials

Replace the placeholders with your actual GitHub repository details:

```bash
# Variables - UPDATE THESE
GITHUB_REPO_OWNER="your-github-username"           # e.g., "kulkarni-meghan"
GITHUB_REPO_NAME="mapboxjs"                        # Repo name
AZURE_TENANT_ID=$(az account show --query tenantId -o tsv)

# Get the service principal object ID
SP_OBJECT_ID=$(az ad sp show --id $APP_ID --query id -o tsv)

# Add federated credential for main branch
az ad app federated-credential create \
  --id $APP_ID \
  --parameters '{
    "name": "github-repo-main",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:'$GITHUB_REPO_OWNER'/'$GITHUB_REPO_NAME':ref:refs/heads/main",
    "audiences": ["api://AzureADTokenExchange"]
  }'

echo "✓ Federated credential created for main branch"
```

### Optional: Add Credential for All Branches

To allow deployments from any branch (useful for testing):

```bash
az ad app federated-credential create \
  --id $APP_ID \
  --parameters '{
    "name": "github-repo-all-branches",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:'$GITHUB_REPO_OWNER'/'$GITHUB_REPO_NAME':*",
    "audiences": ["api://AzureADTokenExchange"]
  }'

echo "✓ Federated credential created for all branches"
```

## Step 4: Verify the Setup

```bash
# List federated credentials
az ad app federated-credential list --id $APP_ID

# Verify service principal has the correct role
az role assignment list --assignee $APP_ID --output table
```

**Expected output:**
- Federated credential with subject matching your GitHub repo
- Service principal with Contributor role on your subscription

## Step 5: Add GitHub Secrets

See [SECRETS-SETUP.md](./SECRETS-SETUP.md) for detailed steps to add these secrets to GitHub:

1. `AZURE_CLIENT_ID` = `$APP_ID` (from Step 1)
2. `AZURE_TENANT_ID` = `$AZURE_TENANT_ID` (from above)
3. `AZURE_SUBSCRIPTION_ID` = `$(az account show --query id -o tsv)`

## Step 6: Test the Workflow

1. Push a commit to the `main` branch
2. Go to your GitHub repository → **Actions** tab
3. Verify the workflow runs successfully
4. Check Azure Portal to confirm resources are being provisioned

## Troubleshooting

### "Federated identity credential is not configured"

- Verify the federated credential subject matches exactly: `repo:OWNER/REPO:ref:refs/heads/main`
- Check that the issuer is `https://token.actions.githubusercontent.com`
- Confirm the credential was created on the correct app registration

### "Authentication failed" in workflow

- Verify all three secrets (`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`) are set correctly
- Check the service principal has `Contributor` role on the subscription
- Verify the app registration name and federated credentials exist: `az ad app federated-credential list --id $APP_ID`

### "Unable to find resource group"

- Verify the resource group `rg-mapbox-prod` exists or will be created by the workflow
- Check that the service principal has permissions on the subscription

## Cleanup (if needed)

```bash
# Delete federated credentials
az ad app federated-credential delete --id $APP_ID --federated-credential-id "github-repo-main"

# Delete service principal
SP_ID=$(az ad sp show --id $APP_ID --query id -o tsv)
az ad sp delete --id $SP_ID

# Delete app registration
az ad app delete --id $APP_ID
```

---

## Reference: Understanding OIDC Flow

1. **GitHub Actions** runs your workflow
2. **GitHub's OIDC provider** issues a token for your workflow
3. **Workflow requests** Azure access using the OIDC token (no secrets sent)
4. **Azure AD** validates the token signature and subject (trusts GitHub)
5. **Azure grants access** to your subscription via the service principal role

This is more secure than storing Azure credentials as secrets because:
- No long-lived secrets in GitHub
- Token is automatically scoped to the specific repo/branch
- Full audit trail in Azure AD
- Credentials are never exposed in logs

---

**Next:** Once OIDC is configured and GitHub secrets are added, push to `main` to trigger the workflow!
