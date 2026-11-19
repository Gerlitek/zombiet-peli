// The API: a Function App on the Flex Consumption plan (pay per use, no monthly fee).
// guardrails.bicep denies anything looser than what is set here: plan FC1, at most
// 1 instance, at most 512 MB, no always-ready instances.
param location string
param storageAccountName string
param blobEndpoint string
param appInsightsConnectionString string

@description('Only the game itself may call the API from a browser.')
param allowedOrigins array = ['https://zombit.gerlitek.fi']

// Created in bootstrap.bicep together with its roles (blob, table, metrics).
resource apiIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: 'id-zombies-api'
}

resource plan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: 'plan-zombies'
  location: location
  kind: 'functionapp'
  sku: { name: 'FC1', tier: 'FlexConsumption' }
  properties: { reserved: true } // Linux
}

var appName = 'func-zombies-${uniqueString(resourceGroup().id)}'

resource app 'Microsoft.Web/sites@2024-04-01' = {
  name: appName
  location: location
  kind: 'functionapp,linux'
  // azd finds the deploy target by this tag.
  tags: { 'azd-service-name': 'api' }
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${apiIdentity.id}': {} }
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    functionAppConfig: {
      // The code package is stored in a blob container and read with the identity, not a key.
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${blobEndpoint}app-package'
          authentication: {
            type: 'UserAssignedIdentity'
            userAssignedIdentityResourceId: apiIdentity.id
          }
        }
      }
      scaleAndConcurrency: {
        maximumInstanceCount: 1 // hard cost cap: one instance, so no scale-out bill
        instanceMemoryMB: 512
        // Python's default is 1 request at a time per instance. With one instance, requests then wait for each
        // other and some time out (503 after 60 s, seen on 2026-11-19). The requests are tiny, so 16 is safe.
        // This does not add instances or cost: guardrails.bicep still caps instances and memory.
        triggers: { http: { perInstanceConcurrency: 16 } }
      }
      runtime: { name: 'python', version: '3.12' }
    }
    siteConfig: {
      cors: { allowedOrigins: allowedOrigins }
      appSettings: [
        // Identity-based storage connection: no connection string, no key.
        { name: 'AzureWebJobsStorage__accountName', value: storageAccountName }
        { name: 'AzureWebJobsStorage__credential', value: 'managedidentity' }
        { name: 'AzureWebJobsStorage__clientId', value: apiIdentity.properties.clientId }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsightsConnectionString }
        // Read by the API code to reach the data with the same identity.
        { name: 'STORAGE_ACCOUNT_NAME', value: storageAccountName }
        { name: 'AZURE_CLIENT_ID', value: apiIdentity.properties.clientId }
        // The cost brake: the API stops this app when a daily cap is reached (role in identities.bicep).
        { name: 'SELF_RESOURCE_ID', value: resourceId('Microsoft.Web/sites', appName) }
      ]
    }
  }
}

output functionAppName string = app.name
output functionAppHostName string = app.properties.defaultHostName
