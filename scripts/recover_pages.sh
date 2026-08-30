#!/usr/bin/env bash
set -euo pipefail

gh_api_with_retry() {
  local attempt
  local output

  for attempt in 1 2 3; do
    if output="$(gh api "$@")"; then
      printf '%s' "${output}"
      return 0
    fi

    if (( attempt < 3 )); then
      sleep "$((attempt * 15))"
    fi
  done

  return 1
}

head_sha="$(
  gh_api_with_retry "repos/${GH_REPO}/git/ref/heads/${DEFAULT_BRANCH}" \
    --jq '.object.sha'
)"
runs="$(
  gh_api_with_retry \
    "repos/${GH_REPO}/actions/workflows/${DEPLOY_WORKFLOW}/runs?branch=${DEFAULT_BRANCH}&head_sha=${head_sha}&per_page=100"
)"

successful_runs="$(
  jq --arg head_sha "${head_sha}" \
    '[.workflow_runs[] | select(
      .head_sha == $head_sha and .conclusion == "success" and
      (.event == "push" or .event == "workflow_dispatch")
    )] | length' <<<"${runs}"
)"
active_runs="$(
  jq --arg head_sha "${head_sha}" \
    '[.workflow_runs[] | select(
      .head_sha == $head_sha and .status != "completed" and
      (.event == "push" or .event == "workflow_dispatch")
    )] | length' <<<"${runs}"
)"
recovery_runs="$(
  jq --arg head_sha "${head_sha}" \
    '[.workflow_runs[] | select(
      .head_sha == $head_sha and .event == "workflow_dispatch"
    )] | length' <<<"${runs}"
)"

if (( successful_runs > 0 )); then
  echo "Pages is already deployed for ${head_sha}."
  exit 0
fi

if (( active_runs > 0 )); then
  echo "A Pages deployment is already active for ${head_sha}."
  exit 0
fi

if (( recovery_runs >= MAX_RECOVERY_RUNS )); then
  echo "::warning::Pages recovery limit reached for ${head_sha}; manual investigation is required."
  exit 0
fi

current_head="$(gh_api_with_retry "repos/${GH_REPO}/git/ref/heads/${DEFAULT_BRANCH}" --jq '.object.sha')"
if [[ "${current_head}" != "${head_sha}" ]]; then
  echo "Default branch advanced; the next event will handle the newer commit."
  exit 0
fi

echo "Dispatching Pages recovery $((recovery_runs + 1))/${MAX_RECOVERY_RUNS} for ${head_sha}."
gh workflow run "${DEPLOY_WORKFLOW}" --ref "${DEFAULT_BRANCH}"
