// Monthly cost budget with email alerts for the whole subscription.
// A budget does NOT stop spending. It only sends emails.
targetScope = 'subscription'

@description('Monthly budget in the billing currency of the subscription.')
param amount int = 5

@description('Email addresses that receive the alerts. Passed at deploy time, never committed.')
param contactEmails array

@description('First day of the budget period. Must be the first day of a month.')
param startDate string = '2026-11-01'

var thresholds = [
  { name: 'actual-50', threshold: 50, thresholdType: 'Actual' }
  { name: 'actual-80', threshold: 80, thresholdType: 'Actual' }
  { name: 'actual-100', threshold: 100, thresholdType: 'Actual' }
  { name: 'forecast-100', threshold: 100, thresholdType: 'Forecasted' }
]

resource budget 'Microsoft.Consumption/budgets@2023-11-01' = {
  name: 'Zombies' // same name as the budget first created in the portal, so a deploy updates it in place
  properties: {
    category: 'Cost'
    amount: amount
    timeGrain: 'Monthly'
    timePeriod: {
      startDate: startDate
    }
    notifications: toObject(thresholds, t => t.name, t => {
      enabled: true
      operator: 'GreaterThan'
      threshold: t.threshold
      thresholdType: t.thresholdType
      contactEmails: contactEmails
    })
  }
}
