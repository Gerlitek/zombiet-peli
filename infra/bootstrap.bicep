// Bootstrap: the resource group, two identities and their roles. Deployed by the owner by hand.
// Role assignments need more rights than Contributor, so they are made here and never by CI.
// A leaked CI identity can therefore deploy into rg-zombies but cannot grant itself anything.
targetScope = 'subscription'

// GitHub puts numeric ids into the OIDC subject of repositories created after 2026-11 (immutable
// subject). The ids never change, so renaming the repository does not break the login, and nobody
// can take over a freed name. Find them with: gh api repos/<owner>/<repo> --jq '{id, owner_id: .owner.id}'
@description('GitHub owner (user or organization) and its numeric id.')
param githubOwner string = 'Gerlitek'
param githubOwnerId int = 263029107

@description('GitHub repository name and its numeric id.')
param githubRepoName string = 'zombiet-peli'
param githubRepoId int = 1461639455

@description('GitHub environment whose runs may sign in. It has a required reviewer.')
param githubEnvironment string = 'production'

param location string = 'swedencentral'

resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: 'rg-zombies'
  location: location
}

module identities 'modules/identities.bicep' = {
  name: 'identities'
  scope: rg
  params: {
    location: location
    githubSubject: 'repo:${githubOwner}@${githubOwnerId}/${githubRepoName}@${githubRepoId}:environment:${githubEnvironment}'
  }
}

// Values for the three GitHub variables (not secrets) used by azure/login.
output AZURE_CLIENT_ID string = identities.outputs.githubClientId
output AZURE_TENANT_ID string = tenant().tenantId
output AZURE_SUBSCRIPTION_ID string = subscription().subscriptionId
