-- Create the dedicated table that mirrors the Excel sheet
CREATE TABLE purchase_stock_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE,
    seller TEXT,
    invoice_no TEXT,
    description_of_goods TEXT,
    mrp NUMERIC DEFAULT 0,
    quantity INTEGER DEFAULT 0,
    rate NUMERIC DEFAULT 0,
    total NUMERIC DEFAULT 0,
    discount_percent NUMERIC DEFAULT 0,
    amount NUMERIC DEFAULT 0,
    gst_percent NUMERIC DEFAULT 0,
    gst_amount NUMERIC DEFAULT 0,
    grand_total NUMERIC DEFAULT 0,
    branch TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE purchase_stock_entries ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read and write (We will enforce Admin-only on the API side)
CREATE POLICY "Allow authenticated access for purchase_stock_entries" 
ON purchase_stock_entries FOR ALL TO authenticated USING (true);
