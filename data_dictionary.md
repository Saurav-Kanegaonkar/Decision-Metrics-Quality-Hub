# Data Dictionary

The dataset is synthetic and models a metric quality register for cross-functional business reporting.

| Field | Description |
| --- | --- |
| `metric` | Governed KPI or recurring dashboard metric. |
| `team` | Business function that uses or owns the metric. |
| `owner` | Accountable reporting owner. `Unassigned` indicates an ownership gap. |
| `system` | Primary source system or workflow where the metric originates. |
| `dashboard` | Reporting surface where stakeholders review the metric. |
| `freshnessHours` | Hours since the metric was refreshed. Values above 24 create a freshness flag. |
| `definitionScore` | 0 to 100 score for definition clarity, documented logic, and stakeholder agreement. |
| `usage30d` | Synthetic dashboard or report views in the last 30 days. |
| `variancePct` | Percent variance between BI output and governed source extract. |
| `excelMismatchRate` | Percent variance between BI output and spreadsheet reconciliation. |
| `issueCount` | Count of open data quality, ownership, freshness, or reconciliation issues. |
| `decisionCriticality` | 1 to 5 score for how directly the metric supports leadership decisions. |

## Synthetic Data Notes

- Finance and executive metrics have stronger definitions and lower variance because they are modeled as more mature reporting workflows.
- Product, Marketing, Support, and Operations include more definition drift, event tracking gaps, and refresh delays.
- Spreadsheet-backed metrics have higher Excel mismatch rates because manual adjustment and versioning issues are common in analyst workflows.
- Metrics with high usage and high decision criticality are intentionally included in the issue queue to show prioritization, not only data profiling.
- The dataset is suitable for portfolio demonstration and interview discussion. It is not presented as real company performance data.
