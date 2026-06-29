import { NextResponse } from "next/server";
// Just writing out the chunk to be injected.
export const newActions = `
    // ── NEW WAREHOUSE ACTIONS ──────────────────────────────
    if (action === "receive_stock") {
      const { productId, quantity, notes } = body;
      const numQty = parseInt(quantity, 10);
      if (!productId || isNaN(numQty) || numQty <= 0) return NextResponse.json({ success: false, error: "Invalid parameters" }, { status: 400 });

      const { data: serviceData } = await adminSupabase.from("services").select("total_received").eq("id", productId).single();
      const currentTotal = serviceData?.total_received || 0;
      await adminSupabase.from("services").update({ total_received: currentTotal + numQty }).eq("id", productId);

      let { data: branchInv } = await adminSupabase.from("branch_inventory").select("id, current_stock").eq("service_id", productId).eq("branch", "Warehouse").maybeSingle();
      if (!branchInv) {
        await adminSupabase.from("branch_inventory").insert({ service_id: productId, branch: "Warehouse", current_stock: numQty, minimum_stock: 5 });
      } else {
        await adminSupabase.from("branch_inventory").update({ current_stock: branchInv.current_stock + numQty }).eq("id", branchInv.id);
      }

      await adminSupabase.from("inventory_transactions").insert({
        product_id: productId, branch: "Warehouse", transaction_type: "RECEIVE", quantity: numQty, source: "Supplier", destination: "Warehouse", created_by: user.email, notes
      });

      return NextResponse.json({ success: true });
    }

    if (action === "allocate_stock") {
      const { productId, targetBranch, quantity, notes } = body;
      const numQty = parseInt(quantity, 10);
      if (!productId || !targetBranch || isNaN(numQty) || numQty <= 0) return NextResponse.json({ success: false, error: "Invalid parameters" }, { status: 400 });

      let { data: whInv } = await adminSupabase.from("branch_inventory").select("id, current_stock").eq("service_id", productId).eq("branch", "Warehouse").maybeSingle();
      if (!whInv || whInv.current_stock < numQty) return NextResponse.json({ success: false, error: "Insufficient unallocated warehouse stock." }, { status: 400 });

      await adminSupabase.from("branch_inventory").update({ current_stock: whInv.current_stock - numQty }).eq("id", whInv.id);

      let { data: branchInv } = await adminSupabase.from("branch_inventory").select("id, current_stock").eq("service_id", productId).eq("branch", targetBranch).maybeSingle();
      if (!branchInv) {
        await adminSupabase.from("branch_inventory").insert({ service_id: productId, branch: targetBranch, current_stock: numQty, minimum_stock: 5 });
      } else {
        await adminSupabase.from("branch_inventory").update({ current_stock: branchInv.current_stock + numQty }).eq("id", branchInv.id);
      }

      let { data: allocData } = await adminSupabase.from("product_allocations").select("id, allocated_quantity").eq("product_id", productId).eq("branch", targetBranch).maybeSingle();
      if (!allocData) {
        await adminSupabase.from("product_allocations").insert({ product_id: productId, branch: targetBranch, allocated_quantity: numQty });
      } else {
        await adminSupabase.from("product_allocations").update({ allocated_quantity: allocData.allocated_quantity + numQty }).eq("id", allocData.id);
      }

      await adminSupabase.from("inventory_transactions").insert({
        product_id: productId, branch: targetBranch, transaction_type: "ALLOCATE", quantity: numQty, source: "Warehouse", destination: targetBranch, created_by: user.email, notes
      });
      return NextResponse.json({ success: true });
    }

    if (action === "transfer_stock") {
      const { productId, sourceBranch, targetBranch, quantity, notes } = body;
      const numQty = parseInt(quantity, 10);
      if (!productId || !sourceBranch || !targetBranch || isNaN(numQty) || numQty <= 0) return NextResponse.json({ success: false, error: "Invalid parameters" }, { status: 400 });

      let { data: srcInv } = await adminSupabase.from("branch_inventory").select("id, current_stock").eq("service_id", productId).eq("branch", sourceBranch).maybeSingle();
      if (!srcInv || srcInv.current_stock < numQty) return NextResponse.json({ success: false, error: "Insufficient stock in source branch." }, { status: 400 });

      await adminSupabase.from("branch_inventory").update({ current_stock: srcInv.current_stock - numQty }).eq("id", srcInv.id);

      let { data: destInv } = await adminSupabase.from("branch_inventory").select("id, current_stock").eq("service_id", productId).eq("branch", targetBranch).maybeSingle();
      if (!destInv) {
        await adminSupabase.from("branch_inventory").insert({ service_id: productId, branch: targetBranch, current_stock: numQty, minimum_stock: 5 });
      } else {
        await adminSupabase.from("branch_inventory").update({ current_stock: destInv.current_stock + numQty }).eq("id", destInv.id);
      }

      // Do NOT modify product_allocations as per user's required change!

      await adminSupabase.from("inventory_transactions").insert({
        product_id: productId, branch: targetBranch, transaction_type: "TRANSFER", quantity: numQty, source: sourceBranch, destination: targetBranch, created_by: user.email, notes
      });
      return NextResponse.json({ success: true });
    }

    if (action === "return_stock") {
      const { productId, sourceBranch, quantity, notes } = body;
      const numQty = parseInt(quantity, 10);
      if (!productId || !sourceBranch || isNaN(numQty) || numQty <= 0) return NextResponse.json({ success: false, error: "Invalid parameters" }, { status: 400 });

      let { data: srcInv } = await adminSupabase.from("branch_inventory").select("id, current_stock").eq("service_id", productId).eq("branch", sourceBranch).maybeSingle();
      if (!srcInv || srcInv.current_stock < numQty) return NextResponse.json({ success: false, error: "Insufficient stock in source branch." }, { status: 400 });

      await adminSupabase.from("branch_inventory").update({ current_stock: srcInv.current_stock - numQty }).eq("id", srcInv.id);

      let { data: whInv } = await adminSupabase.from("branch_inventory").select("id, current_stock").eq("service_id", productId).eq("branch", "Warehouse").maybeSingle();
      if (!whInv) {
        await adminSupabase.from("branch_inventory").insert({ service_id: productId, branch: "Warehouse", current_stock: numQty, minimum_stock: 5 });
      } else {
        await adminSupabase.from("branch_inventory").update({ current_stock: whInv.current_stock + numQty }).eq("id", whInv.id);
      }

      // Do NOT modify product_allocations as per user's required change!

      await adminSupabase.from("inventory_transactions").insert({
        product_id: productId, branch: "Warehouse", transaction_type: "RETURN", quantity: numQty, source: sourceBranch, destination: "Warehouse", created_by: user.email, notes
      });
      return NextResponse.json({ success: true });
    }
`;
