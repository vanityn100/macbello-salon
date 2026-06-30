fetch('http://localhost:3000/api/reports/tax?month=06&year=2026&branch=All%20Branches')
  .then(res => res.text())
  .then(text => console.log(text))
  .catch(err => console.error(err));
