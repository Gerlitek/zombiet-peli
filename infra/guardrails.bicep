// Subscription-wide guardrails. Deployed by the owner by hand, before any other resource.
// Everything here is free: Azure Policy and Cost Management alerts have no charge.
//
// 1. Allowed resource types: anything outside the plan (VMs, AKS, SQL, ...) is denied.
// 2. Costly settings: the allowed types may only use their cheapest, capped settings.
// 3. Cost anomaly alert: a daily email when spending suddenly changes.
//
// A leaked deploy identity (Contributor on rg-zombies) cannot change these, because
// policy lives at subscription scope.
targetScope = 'subscription'

@description('Email addresses for the anomaly alert. Passed at deploy time, never committed.')
param contactEmails array

@description('Resource types the project uses. Add a type here before adding it to Bicep, then run register-providers.sh.')
param allowedResourceTypes array = [
  'Microsoft.Storage/storageAccounts'
  'Microsoft.Web/serverFarms'
  'Microsoft.Web/sites'
  'Microsoft.ManagedIdentity/userAssignedIdentities'
  'Microsoft.OperationalInsights/workspaces'
  'Microsoft.Insights/components'
  'Microsoft.Insights/actionGroups'
  'Microsoft.AlertsManagement/smartDetectorAlertRules'
]

@description('First day of the anomaly alert schedule. The alert must be renewed before the end date.')
param anomalyStart string = '2026-11-18T00:00:00Z'
param anomalyEnd string = '2031-11-18T00:00:00Z'

// Built-in policy "Allowed resource types". Mode Indexed: resource groups, role
// assignments and child resources are not evaluated.
var allowedTypesPolicyId = tenantResourceId('Microsoft.Authorization/policyDefinitions', 'a08ec900-254a-4555-9bf5-e42af04b5c5c')

resource allowedTypes 'Microsoft.Authorization/policyAssignments@2024-04-01' = {
  name: 'zombies-allowed-resource-types'
  properties: {
    displayName: 'Zombies: only planned resource types'
    policyDefinitionId: allowedTypesPolicyId
    parameters: {
      listOfResourceTypesAllowed: { value: allowedResourceTypes }
    }
  }
}

// Each rule denies the expensive variant of a type that is otherwise allowed.
resource costlySettings 'Microsoft.Authorization/policyDefinitions@2024-05-01' = {
  name: 'zombies-deny-costly-settings'
  properties: {
    displayName: 'Zombies: deny costly SKUs and uncapped settings'
    policyType: 'Custom'
    mode: 'Indexed'
    policyRule: {
      if: {
        anyOf: [
          {
            // Only the Flex Consumption plan (pay per use, free grant). No Premium or dedicated plans.
            allOf: [
              { field: 'type', equals: 'Microsoft.Web/serverFarms' }
              { field: 'Microsoft.Web/serverfarms/sku.name', notEquals: 'FC1' }
            ]
          }
          {
            // Function App: Flex only, at most 1 instance of 512 MB, no always-ready instances.
            allOf: [
              { field: 'type', equals: 'Microsoft.Web/sites' }
              {
                anyOf: [
                  { field: 'Microsoft.Web/sites/functionAppConfig.scaleAndConcurrency.maximumInstanceCount', exists: false }
                  { field: 'Microsoft.Web/sites/functionAppConfig.scaleAndConcurrency.maximumInstanceCount', greater: 1 }
                  { field: 'Microsoft.Web/sites/functionAppConfig.scaleAndConcurrency.instanceMemoryMB', greater: 512 }
                  {
                    count: {
                      field: 'Microsoft.Web/sites/functionAppConfig.scaleAndConcurrency.alwaysReady[*]'
                      where: { field: 'Microsoft.Web/sites/functionAppConfig.scaleAndConcurrency.alwaysReady[*].instanceCount', greater: 0 }
                    }
                    greater: 0
                  }
                ]
              }
            ]
          }
          {
            // Storage: Standard LRS only. Premium storage bills provisioned capacity.
            allOf: [
              { field: 'type', equals: 'Microsoft.Storage/storageAccounts' }
              { field: 'Microsoft.Storage/storageAccounts/sku.name', notEquals: 'Standard_LRS' }
            ]
          }
          {
            // Logs: pay per GB with an explicit daily cap of exactly 0.1 GB. No commitment tiers.
            // Equality, not less/greater: those fail to evaluate when the field is an integer
            // (-1 means unlimited) and the operand is a float, and then the deployment is denied.
            allOf: [
              { field: 'type', equals: 'Microsoft.OperationalInsights/workspaces' }
              {
                anyOf: [
                  { field: 'Microsoft.OperationalInsights/workspaces/sku.name', notEquals: 'PerGB2018' }
                  { field: 'Microsoft.OperationalInsights/workspaces/workspaceCapping.dailyQuotaGb', exists: false }
                  { field: 'Microsoft.OperationalInsights/workspaces/workspaceCapping.dailyQuotaGb', notEquals: json('0.1') }
                ]
              }
            ]
          }
        ]
      }
      then: { effect: 'deny' }
    }
  }
}

resource costlySettingsAssignment 'Microsoft.Authorization/policyAssignments@2024-04-01' = {
  name: 'zombies-deny-costly-settings'
  properties: {
    displayName: costlySettings.properties.displayName
    policyDefinitionId: costlySettings.id
  }
}

// Daily anomaly detection on cost per resource group. Reacts to a sudden change faster
// than the monthly budget percentages, but still has the cost data delay (8 to 24 h).
resource anomalyAlert 'Microsoft.CostManagement/scheduledActions@2023-11-01' = {
  name: 'zombies-cost-anomaly'
  kind: 'InsightAlert'
  properties: {
    displayName: 'Zombies cost anomaly'
    status: 'Enabled'
    viewId: '${subscription().id}/providers/Microsoft.CostManagement/views/ms:DailyAnomalyByResourceGroup'
    notificationEmail: contactEmails[0]
    notification: {
      to: contactEmails
      subject: 'Azure cost anomaly in the Zombies subscription'
    }
    schedule: {
      frequency: 'Daily'
      startDate: anomalyStart
      endDate: anomalyEnd
    }
  }
}
