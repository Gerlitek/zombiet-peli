// Resource group scope. Called only from bootstrap.bicep.
param location string

@description('OIDC subject GitHub puts in the token, e.g. repo:owner/name:environment:production')
param githubSubject string

// Built-in role definition ids.
var contributor = 'b24988ac-6180-42a0-ab88-20f7382dd24c'
var storageBlobDataContributor = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
var storageTableDataContributor = '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3'
var monitoringMetricsPublisher = '3913510d-42f4-4e42-8a64-420c390055eb'

// Cost brake: the API stops itself over a daily cap. The built-in Website Contributor would also let it
// deploy code, change app settings and read publishing credentials, so this custom role allows only "stop".
// Starting the app again stays with the owner.
resource stopOnly 'Microsoft.Authorization/roleDefinitions@2022-04-01' = {
  name: guid(resourceGroup().id, 'function-app-stop-only')
  properties: {
    roleName: 'Function App stop only (${resourceGroup().name})' // role names are unique in the tenant
    description: 'Can stop web and function apps in this resource group. Nothing else.'
    type: 'CustomRole'
    permissions: [{ actions: ['Microsoft.Web/sites/stop/action'], notActions: [] }]
    assignableScopes: [resourceGroup().id]
  }
}

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
]

resource roles 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for a in assignments: {
  name: guid(resourceGroup().id, a.key)
  properties: {
    principalId: a.identity == 'github' ? github.properties.principalId : api.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', a.role)
  }
}]

// New key: an existing assignment cannot change its role, so the old Website Contributor one ('api-stop')
// is deleted by hand once (docs/architecture.md, chapter 5).
resource stopRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, 'api-stop-only')
  properties: {
    principalId: api.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: stopOnly.id
  }
}

output githubClientId string = github.properties.clientId
