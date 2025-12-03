/* app.js - Satata Feed Shop (Updated, responsive, Excel export) */

const STORAGE_KEY = "feedshop_v2_xlsx";

/* ---------- initial DB ---------- */
let DB = {
  products: [],
  customers: [],
  sales: [],
  users: [],
  settings: { shopName: "সততা ফিড হাউজ", shopLogo: "", lowThreshold: 10 }
};

const companies = ["Kazi","Nahar","Paragon","Aftab","CP","Mega","Other"];

/* ---------- helpers ---------- */
const qs = s => document.querySelector(s);
const qsa = s => Array.from(document.querySelectorAll(s));

function loadDB(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw) DB = JSON.parse(raw);
    else seedDefaults();
  }catch(e){ console.error(e); seedDefaults(); }
}
function saveDB(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(DB)); renderAll(); }
async function sha256(str){
  const enc = new TextEncoder(); const data = enc.encode(str);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

/* ---------- seed defaults ---------- */
function seedDefaults(){
  (async ()=>{
    const ownerHash = await sha256("owner123");
    const staffHash = await sha256("staff123");
    DB.users = [{email:"owner@shop", pass: ownerHash, role:"owner"}, {email:"staff@shop", pass: staffHash, role:"staff"}];
    DB.products = [];
    DB.customers = [];
    DB.sales = [];
    saveDB();
  })();
}

/* ---------- load ---------- */
loadDB();

/* ---------- UI init ---------- */
function initUI(){
  // fill company select for add product
  const compSel = qs("#p_company");
  compSel.innerHTML = "";
  companies.forEach(c => compSel.insertAdjacentHTML('beforeend', `<option>${c}</option>`));

  // menu
  qsa(".menu-btn").forEach(b => b.addEventListener("click", ()=> showPage(b.dataset.show)));
  qs("#logoutBtn").addEventListener("click", logout);
  qs("#loginOpen")?.addEventListener("click", ()=> showPage("users"));
  qs("#saveThresholdBtn").addEventListener("click", ()=> {
    const v = parseFloat(qs("#globalThreshold").value || DB.settings.lowThreshold);
    DB.settings.lowThreshold = v; saveDB();
  });

  // buttons
  qs("#addProductBtn").addEventListener("click", addProduct);
  qs("#addCustomerBtn").addEventListener("click", addCustomer);
  qs("#recordSaleBtn").addEventListener("click", recordSale);
  qs("#addSampleBtn").addEventListener("click", addSampleData);
  qs("#createUserBtn").addEventListener("click", createUser);
  qs("#loginBtn").addEventListener("click", async ()=>{
    const email = qs("#u_email").value.trim(), pass = qs("#u_pass").value;
    try{ await login(email, pass); alert("Login successful"); showPage("dashboard"); } catch(e){ alert("Login failed"); }
  });

  // reports
  qs("#genDaily").addEventListener("click", generateDailyReport);
  qs("#exportDailyXLSX").addEventListener("click", ()=> exportReportExcel('daily'));
  qs("#genMonthly").addEventListener("click", generateMonthlyReport);
  qs("#exportMonthlyXLSX").addEventListener("click", ()=> exportReportExcel('monthly'));
  qs("#genPL").addEventListener("click", generatePL);
  qs("#exportPLXLSX").addEventListener("click", ()=> exportReportExcel('pl'));

  // CSV exports
  qs("#exportProdCSV").addEventListener("click", ()=> exportCSV(DB.products, ["id","name","company","cost","price","stock","threshold"], "products.csv"));
  qs("#exportSalesCSV").addEventListener("click", ()=> exportCSV(DB.sales.map(s=>({date:s.date, product:s.productName, customer:s.customerName, qty:s.qty, total:s.total, paid:s.paid, profit:s.profit})), ["date","product","customer","qty","total","paid","profit"], "sales.csv"));

  // backup/import
  qs("#exportBtn").addEventListener("click", exportJSON);
  qs("#downloadSample").addEventListener("click", downloadSample);
  qs("#importBtn").addEventListener("click", ()=> qs("#importFileHidden").click());
  qs("#importFileHidden").addEventListener("change", importJSONFile);

  // quick sell
  qs("#quickSellBtn").addEventListener("click", quickSell);

  // search sales
  qs("#searchSale").addEventListener("input", renderAll);

  // initial render
  renderAll();
}
initUI();

/* ---------- Navigation ---------- */
function showPage(id){
  qsa(".page").forEach(p => p.classList.add("hidden"));
  qs(`#${id}`).classList.remove("hidden");
  qsa(".menu-btn").forEach(b => b.classList.remove("active"));
  const btn = qsa(`.menu-btn[data-show="${id}"]`)[0];
  if(btn) btn.classList.add("active");
  qs("#pageTitle").innerText = id.charAt(0).toUpperCase() + id.slice(1);
}

/* ---------- Auth ---------- */
let currentUser = null;
async function login(email, pass){
  const h = await sha256(pass);
  const user = DB.users.find(u => u.email === email && u.pass === h);
  if(!user) throw "Invalid";
  currentUser = user;
  qs("#currentUser").innerText = `${user.email} (${user.role})`;
  qs("#logoutBtn").classList.remove("hidden");
  qs("#authArea").innerHTML = `<div class="small muted">Logged in as ${user.email} (${user.role})</div>`;
  qs("#userRoleBadge").innerText = user.role;
  renderAll();
}
function logout(){
  currentUser = null;
  qs("#currentUser").innerText = "Guest";
  qs("#logoutBtn").classList.add("hidden");
  qs("#authArea").innerHTML = `<button id="loginOpen" class="btn small">Login</button>`;
  initUI();
}

/* ---------- Products ---------- */
function addProduct(){
  const name = qs("#p_name").value.trim();
  const company = qs("#p_company").value;
  const cost = parseFloat(qs("#p_cost").value || 0);
  const price = parseFloat(qs("#p_price").value || 0);
  const stock = parseFloat(qs("#p_stock").value || 0);
  const threshold = parseFloat(qs("#p_threshold").value || 0);
  if(!name){ return alert("প্রোডাক্ট নাম দিন"); }
  const id = Date.now().toString(36);
  DB.products.push({id, name, company, cost, price, stock, threshold});
  saveDB();
  ["#p_name","#p_cost","#p_price","#p_stock","#p_threshold"].forEach(s=>qs(s).value="");
}
function editProduct(id){ /* in UI edit uses prompt for simplicity */ 
  const p = DB.products.find(x => x.id === id);
  if(!p) return;
  const name = prompt("Name", p.name); if(name===null) return;
  p.name = name;
  p.company = prompt("Company", p.company) || p.company;
  p.cost = parseFloat(prompt("Cost", p.cost) || p.cost);
  p.price = parseFloat(prompt("Price", p.price) || p.price);
  p.stock = parseFloat(prompt("Stock", p.stock) || p.stock);
  p.threshold = parseFloat(prompt("Threshold", p.threshold || "") || p.threshold);
  saveDB();
}
function promptAddStock(id){
  const p = DB.products.find(x=>x.id===id);
  const add = parseFloat(prompt("Add kg", 0) || 0);
  if(add>0){ p.stock = +(p.stock + add); saveDB(); }
}
function deleteProduct(id){
  if(!confirm("Delete this product?")) return;
  DB.products = DB.products.filter(p => p.id !== id); saveDB();
}

/* ---------- Customers ---------- */
function addCustomer(){
  const name = qs("#c_name").value.trim();
  const phone = qs("#c_phone").value.trim();
  const due = parseFloat(qs("#c_due").value || 0);
  if(!name) return alert("নাম দিন");
  DB.customers.push({id: Date.now().toString(36), name, phone, due});
  saveDB(); ["#c_name","#c_phone","#c_due"].forEach(s=>qs(s).value="");
}
function editCustomer(id){
  const c = DB.customers.find(x=>x.id===id);
  if(!c) return;
  const name = prompt("Name", c.name); if(name===null) return;
  c.name = name; c.phone = prompt("Phone", c.phone) || c.phone; saveDB();
}
function receivePayment(id){
  const c = DB.customers.find(x=>x.id===id);
  const amt = parseFloat(prompt("Receive amount", 0) || 0);
  if(amt>0){ c.due = Math.max(0, (c.due||0) - amt); saveDB(); alert("Received"); }
}

/* ---------- Sales ---------- */
function recordSale(){
  const pid = qs("#saleProduct").value;
  const cid = qs("#saleCustomer").value;
  const qty = parseFloat(qs("#saleQty").value || 0);
  const paid = qs("#salePaid").value;
  const date = qs("#saleDate").value || new Date().toISOString().slice(0,10);
  if(!pid || qty <= 0) return alert("Product & qty দিন");
  const prod = DB.products.find(p => p.id === pid);
  if(!prod) return alert("Invalid product");
  if(prod.stock < qty) return alert("স্টক পর্যাপ্ত নেই");
  const total = qty * prod.price;
  const profit = qty * (prod.price - (prod.cost || 0));
  prod.stock = +(prod.stock - qty);
  const cust = DB.customers.find(c=>c.id===cid) || {id:null, name:"Walk-in", phone:""};
  if(paid === "due" && cust.id) cust.due = +( (cust.due || 0) + total );
  const sale = { id: Date.now().toString(36), date, productId: prod.id, productName: prod.name, qty, total, customerId: cust.id, customerName: cust.name, paid, profit };
  DB.sales.push(sale); saveDB();
  alert("Sale recorded: ৳" + total.toFixed(2));
}
function quickSell(){
  const pid = qs("#quickProduct").value;
  const cid = qs("#quickCustomer").value;
  const qty = parseFloat(qs("#quickQty").value || 0);
  const paid = qs("#quickPaid").value;
  if(!pid || qty<=0) return alert("Product & qty দিন");
  qs("#saleProduct").value = pid; qs("#saleCustomer").value = cid || ""; qs("#saleQty").value = qty; qs("#salePaid").value = paid; qs("#saleDate").value = new Date().toISOString().slice(0,10);
  recordSale();
  const last = DB.sales[DB.sales.length-1]; printInvoice(last);
  qs("#quickQty").value = "";
}

/* ---------- Print Invoice ---------- */
function printInvoice(sale){
  if(!sale) return alert("No sale to print");
  const html = `
    <div style="font-family:Arial;padding:12px">
      <h2>${DB.settings.shopName}</h2>
      <div>Date: ${sale.date}</div>
      <div>Invoice ID: ${sale.id}</div>
      <hr/>
      <div><strong>Product:</strong> ${sale.productName}</div>
      <div><strong>Qty (kg):</strong> ${sale.qty}</div>
      <div><strong>Total:</strong> ৳ ${sale.total.toFixed(2)}</div>
      <div><strong>Customer:</strong> ${sale.customerName || 'Walk-in'}</div>
      <hr/>
      <div>Thanks for buying!</div>
    </div>
  `;
  const w = window.open("","_blank"); w.document.write(html); w.document.close(); w.print();
}

/* ---------- Reports (generate & render) ---------- */
function generateDailyReport(){
  const date = qs("#r_date").value || new Date().toISOString().slice(0,10);
  const rows = DB.sales.filter(s => s.date === date);
  const area = qs("#dailyReportArea");
  if(rows.length === 0){ area.innerHTML = `<div class="small muted">No sales on ${date}</div>`; return; }
  let html = `<table><thead><tr><th>Date</th><th>Product</th><th>Qty</th><th>Total</th><th>Profit</th></tr></thead><tbody>`;
  let tot=0, pr=0;
  rows.forEach(r => { html += `<tr><td>${r.date}</td><td>${r.productName}</td><td>${r.qty}</td><td>৳${r.total.toFixed(2)}</td><td>৳${r.profit.toFixed(2)}</td></tr>`; tot += r.total; pr += r.profit; });
  html += `</tbody></table><div style="margin-top:8px"><strong>Total: ৳${tot.toFixed(2)}</strong>&nbsp;<strong>Profit: ৳${pr.toFixed(2)}</strong></div>`;
  area.innerHTML = html;
}

function generateMonthlyReport(){
  const v = qs("#r_month").value;
  if(!v) return alert("Select month");
  const [y,m] = v.split("-");
  const rows = DB.sales.filter(s => { const d = new Date(s.date); return d.getFullYear() === +y && (d.getMonth()+1) === +m; });
  let html = `<table><thead><tr><th>Date</th><th>Product</th><th>Qty</th><th>Total</th></tr></thead><tbody>`;
  let tot = 0;
  rows.forEach(r => { html += `<tr><td>${r.date}</td><td>${r.productName}</td><td>${r.qty}</td><td>৳${r.total.toFixed(2)}</td></tr>`; tot += r.total; });
  html += `</tbody></table><div style="margin-top:8px"><strong>Monthly Total: ৳${tot.toFixed(2)}</strong></div>`;
  qs("#monthlyReportArea").innerHTML = html;
}

function generatePL(){
  const from = qs("#pl_from").value; const to = qs("#pl_to").value;
  if(!from || !to) return alert("Select from & to");
  const rows = DB.sales.filter(s => s.date >= from && s.date <= to);
  let salesTotal = 0, profitTotal = 0;
  rows.forEach(r => { salesTotal += r.total; profitTotal += r.profit; });
  qs("#plArea").innerHTML = `<div class="small muted">From ${from} to ${to}</div><div style="margin-top:8px"><strong>Sales: ৳${salesTotal.toFixed(2)}</strong>&nbsp;<strong>Profit: ৳${profitTotal.toFixed(2)}</strong></div>`;
}

/* ---------- Excel Export (SheetJS) ---------- */
function exportReportExcel(type){
  try{
    if(typeof XLSX === "undefined"){ return alert("Excel library not loaded"); }
    let ws, wb = XLSX.utils.book_new();
    if(type === 'daily'){
      const date = qs("#r_date").value || new Date().toISOString().slice(0,10);
      const rows = DB.sales.filter(s => s.date === date);
      if(rows.length === 0) return alert("No sales for selected date");
      const data = rows.map(r => ({Date: r.date, Product: r.productName, Qty: r.qty, Total: r.total, Profit: r.profit}));
      ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, `Daily-${date}`);
      XLSX.writeFile(wb, `daily-report-${date}.xlsx`);
    } else if(type === 'monthly'){
      const v = qs("#r_month").value;
      if(!v) return alert("Select month");
      const [y,m] = v.split("-");
      const rows = DB.sales.filter(s => { const d = new Date(s.date); return d.getFullYear()===+y && (d.getMonth()+1)===+m; });
      const data = rows.map(r => ({Date:r.date, Product:r.productName, Qty:r.qty, Total:r.total, Profit:r.profit}));
      ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, `Monthly-${v}`);
      XLSX.writeFile(wb, `monthly-report-${v}.xlsx`);
    } else if(type === 'pl'){
      const from = qs("#pl_from").value; const to = qs("#pl_to").value;
      if(!from||!to) return alert("Select from & to");
      const rows = DB.sales.filter(s => s.date >= from && s.date <= to);
      const data = rows.map(r => ({Date:r.date, Product:r.productName, Qty:r.qty, Total:r.total, Profit:r.profit}));
      ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, `PL-${from}-to-${to}`);
      XLSX.writeFile(wb, `pl-report-${from}-to-${to}.xlsx`);
    }
  }catch(err){ console.error(err); alert("Export failed: "+err.message); }
}

/* ---------- CSV Export helper ---------- */
function exportCSV(rows, headers, filename){
  const esc = v => `"${String(v===null||v===undefined?"":v).replace(/"/g,'""')}"`;
  const csv = headers.join(",") + "\n" + rows.map(r => headers.map(h => esc(r[h])).join(",")).join("\n");
  const blob = new Blob([csv], {type: "text/csv"});
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}

/* ---------- JSON export/import ---------- */
function exportJSON(){
  const data = { products: DB.products, customers: DB.customers, sales: DB.sales, users: DB.users, settings: DB.settings, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json"});
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `feedshop-backup-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`; a.click();
}
function downloadSample(){
  const sample = { products:[{id:"s1",name:"Sample Feed",company:"Kazi",cost:30,price:40,stock:100,threshold:10}], customers:[{id:"sc1",name:"Sample Cust",phone:"01700000000",due:0}], sales:[], users:[{email:"owner@shop",pass:"",role:"owner"}], settings:DB.settings};
  const blob = new Blob([JSON.stringify(sample,null,2)], {type:"application/json"});
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "feedshop-sample.json"; a.click();
}
function importJSONFile(e){
  const f = e.target.files[0];
  if(!f) return;
  const reader = new FileReader();
  reader.onload = function(ev){
    try{
      const imported = JSON.parse(ev.target.result);
      if(imported.products) DB.products = DB.products.concat(imported.products.map(p => ({ ...p, id: p.id || Date.now().toString(36) })));
      if(imported.customers) DB.customers = DB.customers.concat(imported.customers.map(c => ({ ...c, id: c.id || Date.now().toString(36) })));
      if(imported.sales) DB.sales = DB.sales.concat(imported.sales.map(s => ({ ...s, id: s.id || Date.now().toString(36) })));
      if(imported.users) {
        imported.users.forEach(u => { if(!DB.users.find(x => x.email === u.email)) DB.users.push(u); });
      }
      saveDB(); alert("Import complete");
    }catch(err){ alert("Invalid file"); }
  };
  reader.readAsText(f);
}

/* ---------- Utility: edit/render lists ---------- */
function renderAll(){
  // header
  qs("#shopName").innerText = DB.settings.shopName || "Feed Shop";

  // stats
  qs("#statCount").innerText = DB.products.length;
  const totalStock = DB.products.reduce((a,p)=>a + (p.stock||0), 0);
  qs("#statStock").innerText = totalStock.toFixed(2) + " kg";
  const today = new Date().toISOString().slice(0,10);
  const todaySales = DB.sales.filter(s=>s.date===today).reduce((a,s)=>a + s.total, 0);
  qs("#statToday").innerText = "৳" + todaySales.toFixed(2);
  const totalDue = DB.customers.reduce((a,c)=>a + (c.due||0), 0);
  qs("#statDue").innerText = "৳" + totalDue.toFixed(2);

  // products table
  const tbody = qs("#productsTable tbody"); tbody.innerHTML = "";
  const filter = qs("#filterCompany").value.trim().toLowerCase();
  DB.products.filter(p=> !filter || p.company.toLowerCase().includes(filter) || p.name.toLowerCase().includes(filter)).forEach(p=>{
    const tr = document.createElement("tr");
    const low = (p.threshold && p.stock <= p.threshold) || (DB.settings.lowThreshold && p.stock <= DB.settings.lowThreshold);
    if(low) tr.classList.add("low-stock");
    tr.innerHTML = `<td>${p.name}</td><td>${p.company}</td><td>${(p.stock||0).toFixed(2)}</td><td>৳${(p.price||0).toFixed(2)}</td><td>${p.threshold||DB.settings.lowThreshold}</td>
      <td>
        <button class="btn small" onclick="editProduct('${p.id}')">Edit</button>
        <button class="btn secondary small" onclick="promptAddStock('${p.id}')">Add Stock</button>
        <button class="btn small" onclick="deleteProduct('${p.id}')">Delete</button>
      </td>`;
    tbody.appendChild(tr);
  });

  // product selects
  const fillProductSelect = sel => {
    if(!qs(sel)) return;
    qs(sel).innerHTML = "<option value=''>--Select--</option>";
    DB.products.forEach(p => qs(sel).insertAdjacentHTML('beforeend', `<option value="${p.id}">${p.name} (${p.company}) - ${p.stock}kg</option>`));
  };
  fillProductSelect("#saleProduct"); fillProductSelect("#quickProduct");

  // customers table/selects
  const ctbody = qs("#customersTable tbody"); ctbody.innerHTML = "";
  DB.customers.forEach(c => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${c.name}</td><td>${c.phone}</td><td>৳${(c.due||0).toFixed(2)}</td>
      <td><button class="btn small" onclick="receivePayment('${c.id}')">Receive</button> <button class="btn secondary small" onclick="editCustomer('${c.id}')">Edit</button></td>`;
    ctbody.appendChild(tr);
  });
  const fillCust = sel => {
    if(!qs(sel)) return;
    qs(sel).innerHTML = "<option value=''>Walk-in</option>";
    DB.customers.forEach(c => qs(sel).insertAdjacentHTML('beforeend', `<option value="${c.id}">${c.name} (${c.phone})</option>`));
  };
  fillCust("#saleCustomer"); fillCust("#quickCustomer");

  // sales table (search)
  const stbody = qs("#salesTable tbody"); stbody.innerHTML = "";
  const q = qs("#searchSale").value.trim().toLowerCase();
  DB.sales.slice().reverse().filter(s => {
    if(!q) return true;
    return s.productName.toLowerCase().includes(q) || (s.customerName || "").toLowerCase().includes(q);
  }).forEach(s => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${s.date}</td><td>${s.productName}</td><td>${s.customerName||'Walk-in'}</td><td>${s.qty}</td><td>৳${s.total.toFixed(2)}</td><td>${s.paid}</td><td>৳${s.profit.toFixed(2)}</td>`;
    stbody.appendChild(tr);
  });

  // users
  const ul = qs("#usersList"); if(ul){ ul.innerHTML = "<div class='small muted'>Existing users:</div>"; DB.users.forEach(u=> ul.innerHTML += `<div class="small">${u.email} — <em>${u.role}</em></div>`); }

  // low list
  const lowDiv = qs("#lowList");
  const lows = DB.products.filter(p => { const t = p.threshold || DB.settings.lowThreshold; return t && p.stock <= t; });
  lowDiv.innerHTML = lows.length ? lows.map(p => `${p.name} (${p.stock}kg)`).join("<br>") : "<div class='small muted'>No low stock</div>";
}

/* ---------- Users ---------- */
async function createUser(){
  const email = qs("#new_email").value.trim();
  const pass = qs("#new_pass").value;
  const role = qs("#new_role").value;
  if(!email || !pass) return alert("Email & password লাগবে");
  if(DB.users.find(u => u.email === email)) return alert("User exists");
  const h = await sha256(pass);
  DB.users.push({email, pass: h, role});
  saveDB();
  qs("#new_email").value=""; qs("#new_pass").value="";
}

/* ---------- Sample data ---------- */
function addSampleData(){
  if(DB.products.length > 0 && !confirm("Already have products. Add sample anyway?")) return;
  DB.products.push(
    {id: "p1", name:"Kazi Grower", company:"Kazi", cost:30, price:38, stock:150, threshold:20},
    {id: "p2", name:"Nahar Starter", company:"Nahar", cost:28, price:35, stock:90, threshold:15},
    {id: "p3", name:"Paragon Layer", company:"Paragon", cost:32, price:40, stock:60, threshold:10}
  );
  DB.customers.push({id:"c1",name:"Rahim",phone:"01710000000",due:0});
  DB.customers.push({id:"c2",name:"Karim",phone:"01720000000",due:200});
  saveDB();
}

/* ---------- import file binding ---------- */
function importJSONFileEvent(e){ importJSONFile(e); qs("#importFileHidden").value = ""; }

/* attach change listener for hidden input */
qs("#importFileHidden").addEventListener("change", importJSONFileEvent);

/* Initialize first view */
renderAll();
showPage('dashboard');

/* Expose some for dev */
window.DB = DB;
window.saveDB = saveDB;
