const fs = require('fs');

let page = fs.readFileSync('src/app/admin/inventory/page.tsx', 'utf8');

// 1. Add state variables
const stateInject = `  // Warehouse Allocation system
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [whModal, setWhModal] = useState<{ type: 'RECEIVE'|'ALLOCATE'|'TRANSFER'|'RETURN', product: any } | null>(null);
  const [whData, setWhData] = useState({ quantity: "", notes: "", sourceBranch: "", targetBranch: "" });
  const [whLoading, setWhLoading] = useState(false);

  const toggleRow = (id: string) => setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));

`;

page = page.replace('  const [userRole, setUserRole] = useState<string | null>(null);', stateInject + '  const [userRole, setUserRole] = useState<string | null>(null);');

// 2. Add Handler
const handlerInject = `
  const handleWhSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionToken || !whModal) return;
    setWhLoading(true);
    try {
      const payload = {
        action: whModal.type.toLowerCase() + "_stock",
        productId: whModal.product.productId,
        quantity: whData.quantity,
        notes: whData.notes,
        sourceBranch: whData.sourceBranch,
        targetBranch: whData.targetBranch
      };

      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: \`Bearer \${sessionToken}\` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setWhModal(null);
        setWhData({ quantity: "", notes: "", sourceBranch: "", targetBranch: "" });
        loadReport();
      } else {
        alert(data.error || "Operation failed.");
      }
    } catch (err) {
      alert("Something went wrong.");
    } finally {
      setWhLoading(false);
    }
  };
`;

page = page.replace('  const handleAdjustSubmit = async', handlerInject + '\n  const handleAdjustSubmit = async');

// 3. Update table rendering for expandable rows
const tableRowEndTarget = `                  </td>
                </tr>`;

const expandableRow = `                  </td>
                </tr>
                {/* Warehouse Panel */}
                {expandedRows[p.productId] && userRole === "admin" && (
                  <tr className="bg-luxury-black/50 border-b border-white/5">
                    <td colSpan={6} className="p-4">
                      <div className="grid grid-cols-4 gap-6 bg-white/[0.02] border border-white/5 p-4 rounded">
                        <div className="col-span-1 border-r border-white/5 pr-4">
                          <h4 className="text-xs uppercase tracking-widest text-gold-primary mb-3">Master Warehouse</h4>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs text-ivory/50">Total Received:</span>
                            <span className="text-sm text-white font-bold">{p.totalReceived || 0}</span>
                          </div>
                          <div className="flex justify-between items-center mb-4">
                            <span className="text-xs text-ivory/50">Available:</span>
                            <span className="text-sm text-green-400 font-bold">
                              {p.rawBranchInventory?.find((b:any)=>b.branch==="Warehouse")?.current_stock || 0}
                            </span>
                          </div>
                          <button onClick={() => setWhModal({ type: 'RECEIVE', product: p })} className="w-full bg-white/5 hover:bg-white/10 text-white text-[10px] uppercase tracking-wider py-1.5 rounded transition">
                            Receive Stock
                          </button>
                        </div>
                        
                        <div className="col-span-3">
                          <h4 className="text-xs uppercase tracking-widest text-gold-primary mb-3 flex items-center justify-between">
                            <span>Branch Allocations</span>
                            <div className="flex gap-2">
                              <button onClick={() => setWhModal({ type: 'ALLOCATE', product: p })} className="text-[10px] bg-gold-primary/10 text-gold-primary px-2 py-1 hover:bg-gold-primary/20 rounded transition">Allocate</button>
                              <button onClick={() => setWhModal({ type: 'TRANSFER', product: p })} className="text-[10px] bg-white/5 text-white px-2 py-1 hover:bg-white/10 rounded transition">Transfer</button>
                              <button onClick={() => setWhModal({ type: 'RETURN', product: p })} className="text-[10px] bg-red-500/10 text-red-400 px-2 py-1 hover:bg-red-500/20 rounded transition">Return</button>
                            </div>
                          </h4>
                          <div className="grid grid-cols-3 gap-4">
                            {BRANCHES.map(branch => {
                              const currentStock = p.rawBranchInventory?.find((b:any)=>b.branch===branch)?.current_stock || 0;
                              const allocated = p.productAllocations?.find((a:any)=>a.branch===branch)?.allocated_quantity || 0;
                              return (
                                <div key={branch} className="bg-black/30 p-3 border border-white/5 rounded">
                                  <div className="text-xs font-bold text-white mb-2">{branch}</div>
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="text-[10px] text-ivory/40 uppercase">Live Stock:</span>
                                    <span className="text-xs text-white">{currentStock}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-ivory/40 uppercase">Total Allocated:</span>
                                    <span className="text-xs text-ivory/60">{allocated}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}`;

page = page.replace(tableRowEndTarget, expandableRow);

// 4. Make row clickable/toggleable
page = page.replace('<tr key={p.productId} className="border-b border-white/5 hover:bg-white/[0.01]">', '<tr key={p.productId} className="border-b border-white/5 hover:bg-white/[0.01] cursor-pointer group" onClick={(e) => { if ((e.target as HTMLElement).tagName !== "BUTTON") toggleRow(p.productId); }}>');

// 5. Add Modals
const whModals = `
      {whModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-luxury-black border border-white/10 p-6 w-full max-w-md">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4">
              {whModal.type.replace('_', ' ')} - {whModal.product.productName}
            </h3>
            <form onSubmit={handleWhSubmit} className="space-y-4">
              {(whModal.type === 'TRANSFER' || whModal.type === 'RETURN') && (
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-ivory/50 mb-2">Source Branch</label>
                  <select required value={whData.sourceBranch} onChange={e => setWhData({ ...whData, sourceBranch: e.target.value })} className="w-full bg-white/[0.02] border border-white/10 p-2.5 text-xs text-white outline-none">
                    <option value="">Select Source</option>
                    {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              )}
              
              {(whModal.type === 'ALLOCATE' || whModal.type === 'TRANSFER') && (
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-ivory/50 mb-2">Target Branch</label>
                  <select required value={whData.targetBranch} onChange={e => setWhData({ ...whData, targetBranch: e.target.value })} className="w-full bg-white/[0.02] border border-white/10 p-2.5 text-xs text-white outline-none">
                    <option value="">Select Target</option>
                    {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[10px] uppercase tracking-widest text-ivory/50 mb-2">Quantity</label>
                <input required type="number" min="1" step="1" value={whData.quantity} onChange={e => setWhData({ ...whData, quantity: e.target.value })} className="w-full bg-white/[0.02] border border-white/10 p-2.5 text-xs text-white outline-none" />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-widest text-ivory/50 mb-2">Notes (Optional)</label>
                <input type="text" value={whData.notes} onChange={e => setWhData({ ...whData, notes: e.target.value })} className="w-full bg-white/[0.02] border border-white/10 p-2.5 text-xs text-white outline-none" />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button type="button" onClick={() => setWhModal(null)} className="text-xs text-ivory/60 hover:text-white px-4 py-2 uppercase tracking-wider">Cancel</button>
                <button type="submit" disabled={whLoading} className="bg-gold-primary text-black text-xs font-bold uppercase tracking-widest px-6 py-2 hover:bg-gold-dark disabled:opacity-50">
                  {whLoading ? "Processing..." : "Confirm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
`;

page = page.replace('      {/* Adjust Modal */}', whModals + '\n      {/* Adjust Modal */}');

fs.writeFileSync('src/app/admin/inventory/page.tsx', page);
console.log('UI updated successfully');
