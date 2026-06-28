import { expect, test, describe } from 'vitest';
import { recalculateInvoiceTotals } from '../lib/invoiceUtils';

describe('Invoice Calculation Engine - GST Inclusive', () => {

  test('Single Service - 5% GST (No Discount)', () => {
    const items = [
      { category: 'Service', quantity: 1, unit_price: 105, tax_rate: '5' }
    ];
    
    // Selling Price = 105. Quantity = 1. Line Total = 105.
    // Base Amount = 105 / 1.05 = 100
    // Tax Amount = 105 - 100 = 5
    const result = recalculateInvoiceTotals(items, 0, 0);
    
    expect(result.subtotal).toBeCloseTo(100);
    expect(result.service_tax).toBeCloseTo(5);
    expect(result.retail_tax).toBeCloseTo(0);
    expect(result.total_tax).toBeCloseTo(5);
    expect(result.grand_total).toBeCloseTo(105);
  });

  test('Single Retail Product - 18% GST (No Discount)', () => {
    const items = [
      { category: 'Retail', quantity: 2, unit_price: 118, tax_rate: '0.18' }
    ];
    
    // Line Total = 2 * 118 = 236
    // Base Amount = 236 / 1.18 = 200
    // Tax Amount = 236 - 200 = 36
    const result = recalculateInvoiceTotals(items, 0, 0);
    
    expect(result.subtotal).toBeCloseTo(200);
    expect(result.service_tax).toBeCloseTo(0);
    expect(result.retail_tax).toBeCloseTo(36);
    expect(result.total_tax).toBeCloseTo(36);
    expect(result.grand_total).toBeCloseTo(236);
  });

  test('Mixed Services and Products (No Discount)', () => {
    const items = [
      { category: 'Service', quantity: 1, unit_price: 105, tax_rate: '0.05' },
      { category: 'Product', quantity: 1, unit_price: 118, tax_rate: '0.18' }
    ];
    
    // Total Line Total = 223
    // Service Base = 100, Tax = 5
    // Product Base = 100, Tax = 18
    // Subtotal = 200
    // Total Tax = 23
    // Grand Total = 223
    const result = recalculateInvoiceTotals(items, 0, 0);
    
    expect(result.subtotal).toBeCloseTo(200);
    expect(result.service_tax).toBeCloseTo(5);
    expect(result.retail_tax).toBeCloseTo(18);
    expect(result.total_tax).toBeCloseTo(23);
    expect(result.grand_total).toBeCloseTo(223);
  });

  test('Single Service with Manual Discount (GST calculated on discounted amount)', () => {
    const items = [
      { category: 'Service', quantity: 1, unit_price: 600, tax_rate: '0.05' }
    ];
    const manualDiscount = 60; 
    
    // Line Total = 600
    // Discount = 60
    // Remaining Payable = 540
    // Base Amount = 540 / 1.05 = 514.29
    // Tax Amount = 540 - 514.29 = 25.71
    // Grand Total = 540
    
    const result = recalculateInvoiceTotals(items, manualDiscount, 0);
    
    expect(result.discount).toBe(60);
    expect(result.subtotal).toBeCloseTo(514.29);
    expect(result.service_tax).toBeCloseTo(25.71);
    expect(result.total_tax).toBeCloseTo(25.71);
    expect(result.grand_total).toBeCloseTo(540);
  });

  test('Mixed Items with Loyalty Points (Proportional Discount)', () => {
    const items = [
      { category: 'Service', quantity: 1, unit_price: 105, tax_rate: '0.05' }, // Base 100, Tax 5
      { category: 'Retail', quantity: 1, unit_price: 118, tax_rate: '0.18' }   // Base 100, Tax 18
    ];
    const pointsRedeemed = 22.3; // 10% discount
    
    // Total Line Total = 223
    // Total Discount = 22.3
    // Proportion = 1 - (22.3 / 223) = 0.9
    // Remaining Payable = 200.7
    
    // Service Discounted Payable = 105 * 0.9 = 94.5
    // Service Base = 94.5 / 1.05 = 90
    // Service Tax = 94.5 - 90 = 4.5
    
    // Retail Discounted Payable = 118 * 0.9 = 106.2
    // Retail Base = 106.2 / 1.18 = 90
    // Retail Tax = 106.2 - 90 = 16.2
    
    // Subtotal = 180
    // Total Tax = 20.7
    // Grand Total = 200.7
    
    const result = recalculateInvoiceTotals(items, 0, pointsRedeemed);
    
    expect(result.points_redeemed).toBe(22.3);
    expect(result.subtotal).toBeCloseTo(180);
    expect(result.service_tax).toBeCloseTo(4.5);
    expect(result.retail_tax).toBeCloseTo(16.2);
    expect(result.total_tax).toBeCloseTo(20.7);
    expect(result.grand_total).toBeCloseTo(200.7);
  });

  test('Handles old tax_rate integer values (e.g. 5 instead of 0.05)', () => {
    const items = [
      { category: 'Service', quantity: 1, unit_price: 105, tax_rate: '5' }
    ];
    const result = recalculateInvoiceTotals(items, 0, 0);
    
    // Should behave exactly like 0.05
    expect(result.subtotal).toBeCloseTo(100);
    expect(result.service_tax).toBeCloseTo(5);
    expect(result.grand_total).toBeCloseTo(105);
  });

});
