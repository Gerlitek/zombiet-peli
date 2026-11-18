// Logs and server telemetry. Logs are the most common surprise bill in Azure, so the
// limits are explicit here, and guardrails.bicep denies anything looser:
// pay-per-GB tier, daily cap of at most 0.1 GB (about 3 GB a month, inside the free grant),
// 30 days of retention.
param location string

resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-zombies'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
    workspaceCapping: { dailyQuotaGb: json('0.1') }
  }
}

// Workspace-based: the data lives in the workspace above, so its daily cap applies here too.
// Server telemetry only. The browser gets no Application Insights script (see privacy).
resource insights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'appi-zombies'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: workspace.id
    IngestionMode: 'LogAnalytics'
    RetentionInDays: 30
  }
}

output workspaceId string = workspace.id
output appInsightsConnectionString string = insights.properties.ConnectionString
