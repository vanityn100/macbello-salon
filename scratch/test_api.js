// Fetch local API to see what it returns
fetch('http://localhost:3000/api/reports/tax?month=06&year=2026&branch=All%20Branches')
  .then(res => res.json())
  .then(data => {
    console.log("itemSummary sample:");
    console.log(data.report.itemSummary.slice(0, 2));
    console.log("hsnSummary sample:");
    console.log(data.report.hsnSummary.slice(0, 2));
  })
  .catch(err => console.error(err));
