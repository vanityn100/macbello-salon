import { recalculateInvoiceTotals, InvoiceItemInput } from "../../src/lib/invoiceUtils";

function assertEqual(actual: any, expected: any, testName: string) {
    if (actual !== expected) {
        console.error(`❌ [FAILED] ${testName} | Expected ${expected}, got ${actual}`);
        process.exit(1);
    } else {
        console.log(`✅ [PASSED] ${testName}`);
    }
}

function assertThrows(fn: () => void, testName: string) {
    try {
        fn();
        console.error(`❌ [FAILED] ${testName} | Expected function to throw an error, but it didn't.`);
        process.exit(1);
    } catch (e) {
        console.log(`✅ [PASSED] ${testName}`);
    }
}

async function runTests() {
    console.log("Running Comprehensive Invoice Math Tests...");

    const standardItems: InvoiceItemInput[] = [
        { category: "Service", quantity: 1, unit_price: 200, tax_rate: 0.05 },
        { category: "Retail", quantity: 2, unit_price: 100, tax_rate: "0.18" }
    ];

    let res;

    // 1. No discount
    res = recalculateInvoiceTotals(standardItems, 0, 0);
    assertEqual(res.grand_total, 446, "No discount");

    // 2. Discount only
    res = recalculateInvoiceTotals(standardItems, 46, 0);
    assertEqual(res.grand_total, 400, "Discount only");

    // 3. Loyalty points only
    res = recalculateInvoiceTotals(standardItems, 0, 100);
    assertEqual(res.grand_total, 346, "Loyalty points only");

    // 4. Discount + loyalty points
    res = recalculateInvoiceTotals(standardItems, 20, 26);
    assertEqual(res.grand_total, 400, "Discount + loyalty points");

    // 5. GST and non-GST invoices
    const mixedGstItems: InvoiceItemInput[] = [
        { category: "Service", quantity: 1, unit_price: 200, tax_rate: 0 }, // Non-GST
        { category: "Service", quantity: 1, unit_price: 100, tax_rate: 0.18 } // GST
    ];
    res = recalculateInvoiceTotals(mixedGstItems, 0, 0);
    assertEqual(res.grand_total, 318, "Mixed GST and non-GST");

    // 6. Zero-value invoices (e.g. 100% discount via points)
    res = recalculateInvoiceTotals(standardItems, 446, 0);
    assertEqual(res.grand_total, 0, "Zero-value invoice via full discount");

    // 7. Negative inputs / Invalid data (should throw)
    assertThrows(() => {
        recalculateInvoiceTotals([{ category: "Service", quantity: -1, unit_price: 200, tax_rate: 0.05 }], 0, 0);
    }, "Negative quantity throws");

    assertThrows(() => {
        recalculateInvoiceTotals(standardItems, 500, 0);
    }, "Discount exceeding grand total throws");

    assertThrows(() => {
        recalculateInvoiceTotals([], 0, 0);
    }, "Empty items array throws");

    console.log("All tests passed successfully!");
}

runTests();
