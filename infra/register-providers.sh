#!/usr/bin/env bash
# Registers the Azure resource providers the project needs. Run by the owner by hand, once per
# subscription, and again whenever a new resource type is added to guardrails.bicep.
#
# A new subscription has most providers unregistered. Creating a resource then fails with a
# misleading "SubscriptionNotFound" error. Bicep cannot register providers, and the CI identity
# (Contributor on rg-zombies only) has no right to do it at subscription scope.
#
# Registering is free and creates no resources. The list is read from allowedResourceTypes in
# guardrails.bicep, so the allowed types and the registered providers never drift apart.
set -euo pipefail
cd "$(dirname "$0")"

namespaces=$(sed -n '/^param allowedResourceTypes/,/^\]/p' guardrails.bicep | grep -o "'Microsoft\.[A-Za-z]*" | tr -d "'" | sort -u)

for ns in $namespaces; do
  state=$(az provider show --namespace "$ns" --query registrationState -o tsv)
  if [ "$state" = "Registered" ]; then
    echo "$ns: already registered"
  else
    echo "$ns: $state, registering..."
    az provider register --namespace "$ns" --wait
    echo "$ns: registered"
  fi
done
