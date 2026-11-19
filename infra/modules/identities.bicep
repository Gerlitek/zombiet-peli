// Resource group scope. Called only from bootstrap.bicep.
param location string

@description('OIDC subject GitHub puts in the token, e.g. repo:owner/name:environment:production')
param githubSubject string

// Built-in role definition ids.
var contributor = 'b24988ac-6180-42a0-ab88-20f7382dd24c'
var storageBlobDataContributor = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
var storageTableDataContributor = '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3'
var websiteContributor = 'de139f84-1756-47ae-9be6-808fbbe84772' // can stop and start the app, cannot read keys of other resources
var monitoringMetricsPublisher = '3913510d-42f4-4e42-8a64-420c390055eb'

// Used by GitHub Actions to deploy into this resource group.
resource github 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-zombies-github'
  location: location
}

// Trust only tokens whose subject matches exactly. Pull requests have another subject.
resource githubTrust 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  parent: github
  name: 'github-production'
  properties: {
    issuer: 'https://token.actions.githubusercontent.com'
    subject: githubSubject
    audiences: ['api://AzureADTokenExchange']
  }
}

// Used by the Function App at runtime to reach storage and telemetry without keys.
resource api 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-zombies-api'
  location: location
}

// The list must be known at the start of the deployment, so it holds only static values.
// The principal id (known only after the identity exists) is picked in the loop body.
var assignments = [
  { identity: 'github', role: contributor, key: 'github-contributor' }
  { identity: 'api', role: storageBlobDataContributor, key: 'api-blob' }
  { identity: 'api', role: storageTableDataContributor, key: 'api-table' }
  { identity: 'api', role: monitoringMetricsPublisher, key: 'api-metrics' }
  { identity: 'api', role: websiteContributor, key: 'api-stop' } // cost brake: the API stops itself over the daily cap
]

resource roles 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for a in assignments: {
  name: guid(resourceGroup().id, a.key)
  properties: {
    principalId: a.identity == 'github' ? github.properties.principalId : api.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', a.role)
  }
}]

output githubClientId string = github.properties.clientId
