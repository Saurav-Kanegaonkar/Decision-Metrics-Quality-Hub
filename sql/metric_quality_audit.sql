-- Metric quality audit logic for the Decision Metrics Quality Hub.
-- The query demonstrates the SQL pattern behind the trust score and triage queue.

with metric_inputs as (
  select
    metric,
    team,
    owner,
    system,
    dashboard,
    freshness_hours,
    definition_score,
    usage_30d,
    variance_pct,
    excel_mismatch_rate,
    issue_count,
    decision_criticality
  from metric_quality_register
),

scored as (
  select
    metric,
    team,
    owner,
    system,
    dashboard,
    freshness_hours,
    definition_score,
    usage_30d,
    variance_pct,
    excel_mismatch_rate,
    issue_count,
    decision_criticality,
    least(
      100,
      greatest(
        0,
        round(
          90
          + definition_score * 0.18
          + least(usage_30d / 180.0, 1) * 10
          - least(freshness_hours / 48.0, 1) * 20
          - least(variance_pct / 8.0, 1) * 22
          - least(excel_mismatch_rate / 8.0, 1) * 18
          - least(issue_count / 8.0, 1) * 18
        )
      )
    ) as trust_score
  from metric_inputs
),

classified as (
  select
    *,
    case
      when trust_score < 70
        or (decision_criticality >= 4 and issue_count >= 5)
        then 'High'
      when trust_score < 82
        or issue_count >= 3
        or variance_pct > 3.5
        then 'Medium'
      else 'Low'
    end as decision_risk,
    concat_ws(
      ', ',
      case when owner = 'Unassigned' then 'missing owner' end,
      case when definition_score < 80 then 'definition drift' end,
      case when freshness_hours > 24 then 'stale refresh' end,
      case when variance_pct > 4 then 'warehouse variance' end,
      case when excel_mismatch_rate > 4 then 'Excel mismatch' end
    ) as quality_findings
  from scored
)

select
  metric,
  team,
  owner,
  dashboard,
  trust_score,
  decision_risk,
  quality_findings,
  case
    when decision_risk = 'High'
      then 'Block leadership use until owner, definition, and reconciliation checks are fixed.'
    when decision_risk = 'Medium'
      then 'Assign remediation before the next weekly business review.'
    else 'Certify for routine reporting and keep monitoring.'
  end as recommended_action
from classified
order by
  case decision_risk when 'High' then 1 when 'Medium' then 2 else 3 end,
  decision_criticality desc,
  trust_score asc;
