const data = window.dashboardData;
const el = (tag, className, html) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html) node.innerHTML = html;
  return node;
};
document.querySelector("#metrics").replaceChildren(...data.cards.map((card) => el("article", "metric", `<span>${card[0]}</span><strong>${card[1]}</strong><small>${card[2]}</small>`)));
document.querySelector("#table").innerHTML = `<table><thead><tr><th>Signal</th><th>Segment</th><th>Status</th><th>Finding</th><th>Risk</th></tr></thead><tbody>${data.table.map((row) => `<tr><td>${row[0]}</td><td>${row[1]}</td><td>${row[2]}</td><td>${row[3]}</td><td><b class="${row[4].toLowerCase()}">${row[4]}</b></td></tr>`).join("")}</tbody></table>`;
document.querySelector("#signals").replaceChildren(...data.dataSays.map((item) => el("div", "signal", item)));
document.querySelector("#recs").replaceChildren(...data.recs.map((item, index) => el("article", "memo", `<strong>${index + 1}. Recommendation</strong>${item}`)));
