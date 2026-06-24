import { NextResponse, NextRequest } from 'next/server';
import { supabaseAdminClient } from '@/lib/supabase';
import { logError } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdminClient.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can manage this module
    if (user.app_metadata?.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { action, startDate, endDate, id, rowData } = body;

    // GET / Fetch
    if (action === 'fetch') {
      let query = supabaseAdminClient.from('purchase_stock_entries').select('*').order('date', { ascending: false });
      
      if (startDate) query = query.gte('date', startDate);
      if (endDate) query = query.lte('date', endDate);

      const { data, error } = await query;
      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    // CREATE
    if (action === 'create') {
      const { error } = await supabaseAdminClient.from('purchase_stock_entries').insert([rowData]);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // UPDATE
    if (action === 'update') {
      const { error } = await supabaseAdminClient.from('purchase_stock_entries').update(rowData).eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // DELETE
    if (action === 'delete') {
      const { error } = await supabaseAdminClient.from('purchase_stock_entries').delete().eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    logError("PurchaseOfStocksAPI", error, { req: request });
    return NextResponse.json({ success: false, error: 'An unexpected error occurred. Please try again later.' }, { status: 500 });
  }
}
