const fs = require('fs');

function fixAdminPage() {
  const file = 'src/app/admin/page.tsx';
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(
    'const dateStr = formatDate(inv.created_at);',
    'const dateStr = inv.created_at ? new Date(inv.created_at).toISOString().slice(0, 10) : "-";'
  );
  fs.writeFileSync(file, content);
}

function fixInventoryPage() {
  const file = 'src/app/admin/inventory/page.tsx';
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(
    '"Date": formatDate(txn.created_at),',
    '"Date": txn.created_at ? new Date(txn.created_at).toISOString().slice(0, 10) : "-",\n'
  );
  fs.writeFileSync(file, content);
}

function fixAdminProductsPage() {
  const file = 'src/app/admin/products/page.tsx';
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(
    '"Created Date": formatDate(p.created_at),',
    '"Created Date": p.created_at ? new Date(p.created_at).toISOString().slice(0, 10) : "-",'
  );
  fs.writeFileSync(file, content);
}

function fixStaffProductsPage() {
  const file = 'src/app/staff/products/page.tsx';
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(
    '"Created Date": formatDate(p.created_at),',
    '"Created Date": p.created_at ? new Date(p.created_at).toISOString().slice(0, 10) : "-",'
  );
  fs.writeFileSync(file, content);
}

fixAdminPage();
fixInventoryPage();
fixAdminProductsPage();
fixStaffProductsPage();
console.log("All extra exports updated!");
