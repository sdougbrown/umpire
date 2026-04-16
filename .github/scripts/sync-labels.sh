#!/usr/bin/env bash
# Sync GitHub labels from .github/labels.yml definitions.
# Renames existing defaults so issue/PR associations are preserved.
set -euo pipefail

echo "==> Migrating existing labels..."

# Renames: old default name → new emoji name
declare -A RENAMES=(
  ["bug"]="🐛 bug"
  ["enhancement"]="✨ feature"
  ["documentation"]="📝 docs"
  ["duplicate"]="🔁 duplicate"
  ["wontfix"]="🙅 wontfix"
  ["question"]="❓ question"
  ["good first issue"]="👋 good first issue"
  ["help wanted"]="🙏 help wanted"
  ["invalid"]="❌ invalid"
  ["release"]="🚀 release"
  ["polish"]="💅 polish"
  ["types"]="📐 types"
)

for old in "${!RENAMES[@]}"; do
  new="${RENAMES[$old]}"
  if gh label list --json name -q ".[].name" | grep -qxF "$old"; then
    echo "  rename: $old → $new"
    gh label edit "$old" --name "$new"
  fi
done

echo "==> Applying label definitions..."

# Full label set (creates if missing, updates color/description if exists)
declare -A LABELS=(
  ["🐛 bug"]="D3F0AA|Something isn't working"
  ["✨ feature"]="8AC4FF|New functionality"
  ["📝 docs"]="87d7d7|Documentation only"
  ["🔧 chore"]="B8DBFF|Maintenance and housekeeping"
  ["⚙️ refactor"]="B8DBFF|Code restructuring, no behavior change"
  ["📐 types"]="B8DBFF|Type system changes"
  ["💅 polish"]="FFB8F5|Refinement and cleanup"
  ["🚀 release"]="1cd862|Release tracking"
  ["🔁 duplicate"]="bcbcbc|Already exists"
  ["🙅 wontfix"]="3a3a4a|Will not be worked on"
  ["❌ invalid"]="e4e669|Not valid"
  ["❓ question"]="d78fff|Needs more information"
  ["👋 good first issue"]="7057ff|Good for newcomers"
  ["🙏 help wanted"]="1cd862|Extra attention needed"
)

for name in "${!LABELS[@]}"; do
  IFS='|' read -r color desc <<< "${LABELS[$name]}"
  if gh label list --json name -q ".[].name" | grep -qxF "$name"; then
    echo "  update: $name"
    gh label edit "$name" --color "$color" --description "$desc"
  else
    echo "  create: $name"
    gh label create "$name" --color "$color" --description "$desc"
  fi
done

echo "==> Done!"
