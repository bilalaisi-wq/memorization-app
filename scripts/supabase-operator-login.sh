#!/usr/bin/env bash
# Run from the Codex environment setup script, where environment secrets are available.
# Standard CLI login persists the operator session without copying credentials into source.
set +x
set -eu
if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  printf '%s\n' 'Add SUPABASE_ACCESS_TOKEN to the Codex environment Secrets before running this setup step.' >&2
  exit 2
fi
npx --cache /tmp/ayah-supabase-cli --yes supabase@3.2.0 login --token "$SUPABASE_ACCESS_TOKEN"
