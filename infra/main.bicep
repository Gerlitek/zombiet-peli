// Resource group scope: everything the game runs on. Run by GitHub Actions and azd.
// Empty on purpose for now: it only proves that the pipeline (OIDC login, what-if) works.
// Modules (monitoring, storage, api) are added one at a time, each reviewed with what-if.
targetScope = 'resourceGroup'
