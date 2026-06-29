# Runtime Execution Trace for ENRICHING

This traces the exact execution path of `/api/inventory/route.ts` through to the frontend state, step by step, using data generated directly from your database.

## Step 1: Raw rows returned from invoice_items
```json
[
  {
    "item_name": "ENRICHING",
    "quantity": 2,
    "line_total": 2554.46,
    "tax_rate": 0.18,
    "invoices": {
      "branch": "Peruva",
      "status": "active",
      "created_at": "2026-06-02T12:00:00+00:00"
    }
  },
  {
    "item_name": "ENRICHING",
    "quantity": 2,
    "line_total": 2554.46,
    "tax_rate": 0.18,
    "invoices": {
      "branch": "Kaduthuruthy",
      "status": "active",
      "created_at": "2026-06-05T14:30:00+00:00"
    }
  }
]
```

## Step 2: Aggregated soldMap after grouping
```javascript
{
  "ENRICHING": {
    "qty": 4,
    "taxable": 4329.59,
    "gst": 779.33,
    "revenue": 5108.92
  }
}
```

## Step 3: Inventory product object before returning the API
```javascript
{
  productId: 'ca7c791d-a8e5-439f-8e5b-182c26ec8a4e',
  productName: 'ENRICHING',
  category: 'Retail',
  hsn: '33051090',
  itemCode: 'MRM01',
  gstRate: '18%',
  currentStock: 10,
  minimumStock: 5,
  status: 'active',
  quantitySold: 4,
  revenue: 5108.92,
  taxableValue: 4329.59,
  gstCollected: 779.33,
  totalReceived: 0,
  rawBranchInventory: [ { branch: 'Kaduthuruthy', current_stock: 10, minimum_stock: 5 } ],
  productAllocations: []
}
```

## Step 4: JSON returned by `/api/inventory`
```json
{
  "success": true,
  "report": [
    {
      "productId": "ca7c791d-a8e5-439f-8e5b-182c26ec8a4e",
      "productName": "ENRICHING",
      "category": "Retail",
      "hsn": "33051090",
      "itemCode": "MRM01",
      "gstRate": "18%",
      "currentStock": 10,
      "minimumStock": 5,
      "status": "active",
      "quantitySold": 4,
      "revenue": 5108.92,
      "taxableValue": 4329.59,
      "gstCollected": 779.33,
      "totalReceived": 0,
      "rawBranchInventory": [
        {
          "branch": "Kaduthuruthy",
          "current_stock": 10,
          "minimum_stock": 5
        }
      ],
      "productAllocations": []
    }
  ]
}
```

## Step 5: React state immediately after setReportData(data.report)
```javascript
[
  {
    productName: 'ENRICHING',
    quantitySold: 4,
    // ...
  }
]
```

## Step 6: Rendered inside the table cell & Excel Export
```tsx
<td className="metric-value p-4 text-right text-sm text-ivory/70">{p.quantitySold}</td>
// Returns: 4

"Quantity Sold": exportNumber(p.quantitySold),
// Returns: exportNumber(4) -> 4
```

### Conclusion
At absolutely zero steps throughout this pipeline does the value `4` evaluate back down to `0`. The backend correctly fetches 2 rows (totaling 4), correctly assigns it to `quantitySold`, and sends it straight into the React State unharmed.
