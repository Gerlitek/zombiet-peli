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

module storage 'modules/storage.bicep' = {
  name: 'storage'
  params: {
    location: location
  }
}

module api 'modules/api.bicep' = {
  name: 'api'
  params: {
    location: location
    storageAccountName: storage.outputs.accountName
    blobEndpoint: storage.outputs.blobEndpoint
    appInsightsConnectionString: monitoring.outputs.appInsightsConnectionString
  }
}

output AZURE_FUNCTION_APP_NAME string = api.outputs.functionAppName
output API_HOST_NAME string = api.outputs.functionAppHostName
