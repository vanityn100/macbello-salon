"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var invoiceUtils_1 = require("../../src/lib/invoiceUtils");
function assertEqual(actual, expected, testName) {
    if (actual !== expected) {
        console.error("\u274C [FAILED] ".concat(testName, " | Expected ").concat(expected, ", got ").concat(actual));
        process.exit(1);
    }
    else {
        console.log("\u2705 [PASSED] ".concat(testName));
    }
}
function assertThrows(fn, testName) {
    try {
        fn();
        console.error("\u274C [FAILED] ".concat(testName, " | Expected function to throw an error, but it didn't."));
        process.exit(1);
    }
    catch (e) {
        console.log("\u2705 [PASSED] ".concat(testName));
    }
}
function runTests() {
    return __awaiter(this, void 0, void 0, function () {
        var standardItems, res, mixedGstItems;
        return __generator(this, function (_a) {
            console.log("Running Comprehensive Invoice Math Tests...");
            standardItems = [
                { category: "Service", quantity: 1, unit_price: 200, tax_rate: 0.05 },
                { category: "Retail", quantity: 2, unit_price: 100, tax_rate: "0.18" }
            ];
            // 1. No discount
            res = (0, invoiceUtils_1.recalculateInvoiceTotals)(standardItems, 0, 0);
            assertEqual(res.grand_total, 446, "No discount");
            // 2. Discount only
            res = (0, invoiceUtils_1.recalculateInvoiceTotals)(standardItems, 46, 0);
            assertEqual(res.grand_total, 400, "Discount only");
            // 3. Loyalty points only
            res = (0, invoiceUtils_1.recalculateInvoiceTotals)(standardItems, 0, 100);
            assertEqual(res.grand_total, 346, "Loyalty points only");
            // 4. Discount + loyalty points
            res = (0, invoiceUtils_1.recalculateInvoiceTotals)(standardItems, 20, 26);
            assertEqual(res.grand_total, 400, "Discount + loyalty points");
            mixedGstItems = [
                { category: "Service", quantity: 1, unit_price: 200, tax_rate: 0 }, // Non-GST
                { category: "Service", quantity: 1, unit_price: 100, tax_rate: 0.18 } // GST
            ];
            res = (0, invoiceUtils_1.recalculateInvoiceTotals)(mixedGstItems, 0, 0);
            assertEqual(res.grand_total, 318, "Mixed GST and non-GST");
            // 6. Zero-value invoices (e.g. 100% discount via points)
            res = (0, invoiceUtils_1.recalculateInvoiceTotals)(standardItems, 446, 0);
            assertEqual(res.grand_total, 0, "Zero-value invoice via full discount");
            // 7. Negative inputs / Invalid data (should throw)
            assertThrows(function () {
                (0, invoiceUtils_1.recalculateInvoiceTotals)([{ category: "Service", quantity: -1, unit_price: 200, tax_rate: 0.05 }], 0, 0);
            }, "Negative quantity throws");
            assertThrows(function () {
                (0, invoiceUtils_1.recalculateInvoiceTotals)(standardItems, 500, 0);
            }, "Discount exceeding grand total throws");
            assertThrows(function () {
                (0, invoiceUtils_1.recalculateInvoiceTotals)([], 0, 0);
            }, "Empty items array throws");
            console.log("All tests passed successfully!");
            return [2 /*return*/];
        });
    });
}
runTests();
