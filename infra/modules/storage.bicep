// Data layer: blob containers (raw, curated), tables (scores, messages, limits) and the
// lifecycle rule that deletes raw data after 30 days. Cheapest setup on purpose:
// Standard LRS, no versioning, no SFTP (hourly fee), no hierarchical namespace.
// guardrails.bicep denies any other SKU.
param location string

// Storage account names: 3-24 lowercase letters and digits, globally unique.
var accountName = 'stzombies${uniqueString(resourceGroup().id)}'

resource account 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: accountName
  location: location
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: {
    accessTier: 'Hot'
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
    // No account keys: access only through Entra ID and the roles from bootstrap.bicep.
    // A leaked key cannot exist. The Function App uses identity-based connections.
    allowSharedKeyAccess: false
    isSftpEnabled: false
    isHnsEnabled: false
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: account
  name: 'default'
  properties: {
    isVersioningEnabled: false
    deleteRetentionPolicy: { enabled: false }
    containerDeleteRetentionPolicy: { enabled: false }
  }
}

var containers = [
  'raw' // events as received, NDJSON, deleted after 30 days
  'curated' // validated Parquet and the dashboard summary
  'app-package' // deployment package of the Function App (Flex Consumption)
]

resource blobContainers 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = [for name in containers: {
  parent: blobService
  name: name
  properties: { publicAccess: 'None' }
}]

resource tableService 'Microsoft.Storage/storageAccounts/tableServices@2023-05-01' = {
  parent: account
  name: 'default'
}

var tables = [
  'scores'
  'messages'
  'limits'
]

resource storageTables 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = [for name in tables: {
  parent: tableService
  name: name
}]

// Raw data is deleted 30 days after its last change. Curated stays.
resource lifecycle 'Microsoft.Storage/storageAccounts/managementPolicies@2023-05-01' = {
  parent: account
  name: 'default'
  properties: {
    policy: {
      rules: [
        {
          name: 'delete-raw-after-30-days'
          enabled: true
          type: 'Lifecycle'
          definition: {
            filters: {
              blobTypes: ['blockBlob']
              prefixMatch: ['raw/']
            }
            actions: {
              baseBlob: { delete: { daysAfterModificationGreaterThan: 30 } }
            }
          }
        }
      ]
    }
  }
}

output accountName string = account.name
output blobEndpoint string = account.properties.primaryEndpoints.blob
output tableEndpoint string = account.properties.primaryEndpoints.table
