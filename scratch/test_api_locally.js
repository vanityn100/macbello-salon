const http = require('http');

const data = JSON.stringify({
  action: "get_summary_report",
  startDate: "2026-06-01",
  endDate: "2026-06-30",
  branch: "Kaduthuruthy"
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/inventory',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  let body = '';
  res.on('data', d => {
    body += d;
  });
  res.on('end', () => {
    try {
      const parsed = JSON.parse(body);
      if (parsed.success) {
        const enriching = parsed.report.find(p => p.productName === 'ENRICHING');
        const flow = parsed.report.find(p => p.productName.includes('FLO W ONE'));
        console.log("ENRICHING:", enriching ? enriching.quantitySold : "Not Found");
        console.log("FLO W ONE:", flow ? flow.quantitySold : "Not Found");
        console.log("Total Products in report:", parsed.report.length);
      } else {
        console.log("API returned false:", parsed.error);
      }
    } catch(e) {
      console.log("Parse error:", e, body.substring(0, 500));
    }
  });
});

req.on('error', error => {
  console.error("HTTP error:", error);
});

req.write(data);
req.end();
