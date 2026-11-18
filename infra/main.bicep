// Resource group scope: everything the game runs on. Run by GitHub Actions and azd.
// Modules are added one at a time, each reviewed with what-if before it is deployed.
targetScope = 'resourceGroup'

param location string = resourceGroup().location

module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring'
  params: {
    location: location
  }
}
