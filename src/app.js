const records = window.metricRecords;
const formatter = new Intl.NumberFormat("en-US");

const scoreMetric = (record) => {
  const freshnessPenalty = Math.min(record.freshnessHours / 48, 1) * 20;
  const variancePenalty = Math.min(record.variancePct / 8, 1) * 22;
  const excelPenalty = Math.min(record.excelMismatchRate / 8, 1) * 18;
  const issuePenalty = Math.min(record.issueCount / 8, 1) * 18;
  const definitionCredit = record.definitionScore * 0.18;
  const usageCredit = Math.min(record.usage30d / 180, 1) * 10;
  return Math.min(100, Math.max(0, Math.round(90 + definitionCredit + usageCredit - freshnessPenalty - variancePenalty - excelPenalty - issuePenalty)));
};

const enrich = (record) => {
  const trustScore = scoreMetric(record);
  let risk = "Low";
  if (trustScore < 70 || (record.decisionCriticality >= 4 && record.issueCount >= 5)) risk = "High";
  else if (trustScore < 82 || record.issueCount >= 3 || record.variancePct > 3.5) risk = "Medium";

  const causes = [];
  if (record.owner === "Unassigned") causes.push("missing owner");
  if (record.definitionScore < 80) causes.push("definition drift");
  if (record.freshnessHours > 24) causes.push("stale refresh");
  if (record.variancePct > 4) causes.push("warehouse variance");
  if (record.excelMismatchRate > 4) causes.push("Excel mismatch");
  if (!causes.length) causes.push("monitor only");

  const action = risk === "High"
    ? "Block leadership use until owner, definition, and reconciliation checks are fixed."
    : risk === "Medium"
      ? "Assign remediation before the next weekly business review."
      : "Certify for routine reporting and keep monitoring."

  return { ...record, trustScore, risk, causes, action };
};

const rows = records.map(enrich).sort((a, b) => {
  const riskRank = { High: 3, Medium: 2, Low: 1 };
  return riskRank[b.risk] - riskRank[a.risk] || b.decisionCriticality - a.decisionCriticality || a.trustScore - b.trustScore;
});

const teams = [...new Set(rows.map((row) => row.team))].sort();
let selectedTeam = "All";

const byTeam = (team) => rows.filter((row) => team === "All" || row.team === team);
const average = (items, field) => Math.round(items.reduce((sum, item) => sum + item[field], 0) / items.length);
const countWhere = (items, test) => items.filter(test).length;

const el = (tag, className, html) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
};

const riskClass = (risk) => risk.toLowerCase();

const renderExecutive = () => {
  const filtered = byTeam(selectedTeam);
  const highRisk = countWhere(filtered, (row) => row.risk === "High");
  const mediumRisk = countWhere(filtered, (row) => row.risk === "Medium");
  const certified = countWhere(filtered, (row) => row.risk === "Low");
  const trustScore = average(filtered, "trustScore");
  const freshness = countWhere(filtered, (row) => row.freshnessHours <= 24);
  const owned = countWhere(filtered, (row) => row.owner !== "Unassigned");

  document.querySelector("#heroScore").textContent = `${trustScore}%`;
  document.querySelector("#heroContext").textContent = `${highRisk} high risk metrics`;
  document.querySelector("#metrics").replaceChildren(
    el("article", "metric", `<span>Decision trust score</span><strong>${trustScore}%</strong><small>${selectedTeam} metric set</small>`),
    el("article", "metric", `<span>Certified metrics</span><strong>${certified}</strong><small>${mediumRisk} need remediation</small>`),
    el("article", "metric", `<span>Fresh within 24 hours</span><strong>${freshness}/${filtered.length}</strong><small>refresh discipline</small>`),
    el("article", "metric", `<span>Named metric owners</span><strong>${owned}/${filtered.length}</strong><small>accountability coverage</small>`)
  );

  const teamSummaries = teams.map((team) => {
    const teamRows = byTeam(team);
    const score = average(teamRows, "trustScore");
    const high = countWhere(teamRows, (row) => row.risk === "High");
    return { team, score, high };
  });

  document.querySelector("#teamPulse").replaceChildren(...teamSummaries.map((item) => el(
    "div",
    "team-row",
    `<div><strong>${item.team}</strong><span>${item.high} high risk</span></div><div class="bar"><i style="width: ${item.score}%"></i></div><b>${item.score}%</b>`
  )));
};

const renderFilters = () => {
  const filterButtons = ["All", ...teams].map((team) => {
    const button = el("button", team === selectedTeam ? "filter active" : "filter", team);
    button.type = "button";
    button.addEventListener("click", () => {
      selectedTeam = team;
      render();
    });
    return button;
  });
  document.querySelector("#filters").replaceChildren(...filterButtons);
};

const renderWorkbench = () => {
  const filtered = byTeam(selectedTeam);
  const issueRows = filtered.slice().sort((a, b) => a.trustScore - b.trustScore).slice(0, 10);
  document.querySelector("#workbenchTable").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Metric</th>
          <th>Team</th>
          <th>Trust</th>
          <th>Risk</th>
          <th>Root cause</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${issueRows.map((row) => `
          <tr>
            <td><strong>${row.metric}</strong><small>${row.dashboard}</small></td>
            <td>${row.team}</td>
            <td>${row.trustScore}%</td>
            <td><b class="badge ${riskClass(row.risk)}">${row.risk}</b></td>
            <td>${row.causes.join(", ")}</td>
            <td>${row.action}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
};

const renderEvidence = () => {
  const filtered = byTeam(selectedTeam);
  const stale = countWhere(filtered, (row) => row.freshnessHours > 24);
  const ownerGaps = countWhere(filtered, (row) => row.owner === "Unassigned");
  const definitionDrift = countWhere(filtered, (row) => row.definitionScore < 80);
  const reconciliationGaps = countWhere(filtered, (row) => row.excelMismatchRate > 4);

  const checks = [
    ["Freshness SLA", stale, "Metrics refreshed after the 24 hour target."],
    ["Owner coverage", ownerGaps, "Metrics missing a named accountable owner."],
    ["Definition stability", definitionDrift, "Metrics below the definition quality threshold."],
    ["Excel reconciliation", reconciliationGaps, "Metrics with spreadsheet variance above tolerance."]
  ];

  document.querySelector("#qualityTests").replaceChildren(...checks.map(([name, count, detail]) => {
    const status = count === 0 ? "Pass" : count <= 2 ? "Watch" : "Fail";
    return el("article", "test-card", `<span class="badge ${status.toLowerCase()}">${status}</span><strong>${name}</strong><b>${count}</b><small>${detail}</small>`);
  }));

  const reconciliationRows = filtered
    .filter((row) => row.excelMismatchRate > 3 || row.variancePct > 4)
    .sort((a, b) => b.excelMismatchRate - a.excelMismatchRate)
    .slice(0, 6);

  document.querySelector("#reconciliation").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Metric</th>
          <th>Source</th>
          <th>BI variance</th>
          <th>Excel gap</th>
          <th>Owner</th>
        </tr>
      </thead>
      <tbody>
        ${reconciliationRows.map((row) => `
          <tr>
            <td><strong>${row.metric}</strong></td>
            <td>${row.system}</td>
            <td>${row.variancePct.toFixed(1)}%</td>
            <td>${row.excelMismatchRate.toFixed(1)}%</td>
            <td>${row.owner}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
};

const renderReadout = () => {
  const allRows = byTeam(selectedTeam);
  const highestRisk = allRows.slice().sort((a, b) => a.trustScore - b.trustScore)[0];
  const mostUsedRisk = allRows.filter((row) => row.risk !== "Low").sort((a, b) => b.usage30d - a.usage30d)[0];
  const highRiskTeams = teams
    .map((team) => ({ team, count: countWhere(byTeam(team), (row) => row.risk === "High") }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);

  const readout = [
    {
      title: "Decision recommendation",
      body: `${highestRisk.metric} should be excluded from executive decision packs until ${highestRisk.causes.join(", ")} is remediated.`
    },
    {
      title: "Stakeholder impact",
      body: `${mostUsedRisk.metric} is still heavily used with ${formatter.format(mostUsedRisk.usage30d)} views in 30 days, so the cleanup should be visible in the next business review.`
    },
    {
      title: "Operating focus",
      body: `${highRiskTeams[0].team} has the most high risk metrics. Start there, then certify the remaining medium risk definitions.`
    }
  ];

  document.querySelector("#readout").replaceChildren(...readout.map((item, index) => el(
    "article",
    "memo",
    `<span>0${index + 1}</span><strong>${item.title}</strong><p>${item.body}</p>`
  )));
};

const render = () => {
  renderFilters();
  renderExecutive();
  renderWorkbench();
  renderEvidence();
  renderReadout();
};

render();
