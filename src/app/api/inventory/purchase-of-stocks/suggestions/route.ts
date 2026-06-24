import { NextResponse, NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logError } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const serverAdmin = getSupabaseAdmin();
    
    // Fetch all distinct sellers, products and their last-used rates
    const { data, error } = await serverAdmin
      .from('purchase_stock_entries')
      .select('seller, description_of_goods, rate, gst_percent, mrp, discount_percent')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Build unique sellers list (preserving order of most recently used)
    const seenSellers = new Set<string>();
    const sellers: string[] = [];
    data.forEach(row => {
      if (row.seller && !seenSellers.has(row.seller)) {
        seenSellers.add(row.seller);
        sellers.push(row.seller);
      }
    });

    // Build unique products + last-used hint info per product
    const seenProducts = new Set<string>();
    const products: { name: string; lastRate: number; lastGst: number; lastMrp: number; lastSeller: string }[] = [];
    data.forEach(row => {
      if (row.description_of_goods && !seenProducts.has(row.description_of_goods)) {
        seenProducts.add(row.description_of_goods);
        products.push({
          name: row.description_of_goods,
          lastRate: row.rate,
          lastGst: row.gst_percent,
          lastMrp: row.mrp,
          lastSeller: row.seller,
        });
      }
    });

    return NextResponse.json({ success: true, sellers, products });

  } catch (error: any) {
    logError("PurchaseOfStocksSuggestions", error, { req: request });
    return NextResponse.json({ success: false, error: 'Failed to load suggestions.' }, { status: 500 });
  }
}
