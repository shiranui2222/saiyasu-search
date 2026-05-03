import { useState, useEffect, useRef } from "react";

// ─── ユーティリティ ───────────────────────────────────────
const storage = {
  get: (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  },
  set: (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
};

const effectiveCat = (p) => (p.category?.trim() ? p.category.trim() : p.name?.trim() || "未分類");
const displayLabel = (p) => {
  const n = p.name?.trim(), c = p.category?.trim();
  if (n && c && n !== c) return { title: n, sub: c };
  return { title: n || c || "未分類", sub: null };
};
const matchQ = (p, q) => {
  if (!q) return true;
  const l = q.toLowerCase();
  return (p.name || "").toLowerCase().includes(l) || (p.category || "").toLowerCase().includes(l);
};

// ─── アイコン ─────────────────────────────────────────────
const Icon = ({ name, size = 20, className = "" }) => {
  const icons = {
    package: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10",
    store: "M3 9h18v10a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M3 9l2.45-4.9A2 2 0 017.24 3h9.52a2 2 0 011.8 1.1L21 9 M12 3v6",
    "bar-chart": "M18 20V10 M12 20V4 M6 20v-6",
    camera: "M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z M12 17a4 4 0 100-8 4 4 0 000 8z",
    barcode: "M3 5v14 M7 5v14 M11 5v14 M15 5v14 M19 5v14",
    search: "M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z",
    x: "M18 6L6 18 M6 6l12 12",
    trash: "M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6",
    edit: "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
    plus: "M12 5v14 M5 12h14",
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      className={className}>
      {icons[name]?.split(" M").map((d, i) => (
        <path key={i} d={i === 0 ? d : "M" + d} />
      ))}
    </svg>
  );
};

// ─── メインアプリ ─────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("products");
  const [stores, setStores] = useState(() => storage.get("sa_stores", []));
  const [products, setProducts] = useState(() => storage.get("sa_products", []));
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [barcodeMsg, setBarcodeMsg] = useState("");
  const [form, setForm] = useState({ id: null, name: "", category: "", price: "", amount: "", storeId: "", image: null });
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => { storage.set("sa_stores", stores); }, [stores]);
  useEffect(() => { storage.set("sa_products", products); }, [products]);

  // ─── バーコードスキャン ───────────────────────────────
  const stopScan = () => {
    setScanning(false);
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  };

  const startScan = async () => {
    setBarcodeMsg("");
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      const { BrowserMultiFormatReader } = await import("@zxing/library");
      const reader = new BrowserMultiFormatReader();
      const tick = async () => {
        if (!streamRef.current || !videoRef.current) return;
        try {
          const result = await reader.decodeOnce(videoRef.current);
          if (result) {
            const code = result.getText();
            stopScan();
            setBarcodeMsg("読み取り中… " + code);
            const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
            const data = await res.json();
            if (data.status === 1) {
              setForm(f => ({
                ...f,
                name: data.product.product_name || data.product.product_name_ja || "",
                amount: parseInt(data.product.product_quantity) || "",
                category: data.product.categories_tags?.[0]?.replace("ja:", "") || "",
              }));
              setBarcodeMsg("✓ 商品情報を取得しました");
            } else { setBarcodeMsg("商品が見つかりません。手動で入力してください。"); }
            return;
          }
        } catch { /* continue */ }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch { stopScan(); setBarcodeMsg("カメラにアクセスできません。"); }
  };

  // ─── 商品保存 ─────────────────────────────────────────
  const saveProduct = () => {
    if (!form.name && !form.category) return alert("商品名またはカテゴリを入力してください");
    if (!form.price) return alert("価格を入力してください");
    if (!form.storeId) return alert("店舗を選択してください");
    const price = parseFloat(form.price) || 0;
    const amount = parseFloat(form.amount) || 1;
    const entry = { ...form, id: form.id || Date.now().toString(), price, amount, unitPrice: price / amount };
    if (isEditing) setProducts(ps => ps.map(p => p.id === entry.id ? entry : p));
    else setProducts(ps => [entry, ...ps]);
    resetForm();
  };

  const resetForm = () => {
    setForm({ id: null, name: "", category: "", price: "", amount: "", storeId: "", image: null });
    setShowForm(false); setIsEditing(false); stopScan(); setBarcodeMsg("");
  };

  const editProduct = (p) => { setForm(p); setIsEditing(true); setShowForm(true); stopScan(); };
  const deleteProduct = (id) => { if (confirm("削除しますか？")) setProducts(ps => ps.filter(p => p.id !== id)); };
  const deleteStore = (id) => {
    if (confirm("削除しますか？")) { setStores(ss => ss.filter(s => s.id !== id)); setProducts(ps => ps.filter(p => p.storeId !== id)); }
  };

  const handlePhoto = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onloadend = () => setForm(f => ({ ...f, image: r.result }));
    r.readAsDataURL(file);
  };

  // ─── 価格比較データ ───────────────────────────────────
  const comparisonGroups = (() => {
    const groups = {};
    products.forEach(p => {
      const key = effectiveCat(p);
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    return Object.keys(groups).sort((a, b) => a.localeCompare(b, "ja")).reduce((acc, key) => {
      acc[key] = groups[key].sort((a, b) => a.unitPrice - b.unitPrice);
      return acc;
    }, {});
  })();

  const filteredCats = Object.keys(comparisonGroups).filter(cat =>
    cat.toLowerCase().includes(search.toLowerCase()) ||
    comparisonGroups[cat].some(p => (p.name || "").toLowerCase().includes(search.toLowerCase()))
  );

  const storeName = (id) => stores.find(s => s.id === id)?.name || "-";

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 pb-28 relative">
      {/* ヘッダー */}
      <header className="bg-blue-500 text-white px-5 py-4 sticky top-0 z-30 shadow-md rounded-b-2xl text-center">
        <h1 className="text-xl font-bold tracking-wider">最安サーチ</h1>
      </header>

      <main className="p-4 space-y-4">
        {/* 検索バー */}
        {tab !== "stores" && (
          <div className="flex bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm items-center gap-2">
            <Icon name="search" size={18} className="text-slate-400" />
            <input type="text" placeholder="商品名やカテゴリで探す"
              className="flex-1 outline-none bg-transparent text-sm"
              value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button onClick={() => setSearch("")} className="text-slate-300"><Icon name="x" size={16} /></button>}
          </div>
        )}

        {/* ── 店舗タブ ── */}
        {tab === "stores" && (
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
              <p className="text-xs font-bold text-slate-400 mb-3">店舗を登録</p>
              <div className="flex gap-2">
                <input id="sName" placeholder="店名を入力" className="flex-1 bg-slate-50 p-3 rounded-xl outline-none text-sm" />
                <button onClick={() => {
                  const v = document.getElementById("sName").value.trim();
                  if (v) { setStores(ss => [...ss, { id: Date.now().toString(), name: v }]); document.getElementById("sName").value = ""; }
                }} className="bg-blue-500 text-white px-5 rounded-xl font-bold text-sm">追加</button>
              </div>
            </div>
            {stores.length === 0 && <p className="text-center text-slate-400 text-sm py-8">まだ店舗が登録されていません</p>}
            {stores.map(s => (
              <div key={s.id} className="bg-white p-4 rounded-2xl flex justify-between shadow-sm items-center">
                <span className="font-medium text-slate-700">{s.name}</span>
                <button onClick={() => deleteStore(s.id)} className="text-red-400 p-2"><Icon name="trash" size={18} /></button>
              </div>
            ))}
          </div>
        )}

        {/* ── 商品タブ ── */}
        {tab === "products" && (
          <div className="space-y-4">
            {!showForm && (
              <button onClick={() => setShowForm(true)}
                className="w-full bg-blue-500 text-white py-4 rounded-3xl font-bold flex items-center justify-center gap-2 active:bg-blue-600 transition">
                <Icon name="plus" size={18} /> 商品を記録する
              </button>
            )}

            {/* 商品追加フォーム */}
            {showForm && (
              <div className="bg-white p-5 rounded-3xl shadow-xl border border-slate-100 relative">
                <button onClick={resetForm} className="absolute top-4 right-4 text-slate-300">
                  <Icon name="x" size={22} />
                </button>
                <p className="text-sm font-bold text-slate-600 mb-4">{isEditing ? "商品を編集" : "商品を記録"}</p>

                {/* カメラプレビュー */}
                {scanning && (
                  <div className="mb-4 rounded-2xl overflow-hidden h-44 bg-black relative">
                    <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                    <div className="absolute inset-x-8 top-1/2 h-0.5 bg-green-400 opacity-80 animate-pulse" />
                    <button onClick={stopScan} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1.5">
                      <Icon name="x" size={16} />
                    </button>
                  </div>
                )}
                {barcodeMsg && (
                  <p className={`text-xs px-3 py-2 rounded-xl mb-3 ${barcodeMsg.startsWith("✓") ? "bg-green-50 text-green-700" : "bg-slate-50 text-slate-500"}`}>
                    {barcodeMsg}
                  </p>
                )}

                {/* 写真・スキャンボタン */}
                <div className="flex gap-3 mb-4 items-center">
                  <label className="w-20 h-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center overflow-hidden cursor-pointer flex-shrink-0">
                    {form.image
                      ? <img src={form.image} className="w-full h-full object-cover" alt="商品" />
                      : <><Icon name="camera" size={22} className="text-slate-300" /><span className="text-[9px] text-slate-300 mt-1">写真</span></>
                    }
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                  </label>
                  <button onClick={scanning ? stopScan : startScan}
                    className={`flex-1 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition ${scanning ? "bg-red-50 text-red-500 border border-red-200" : "bg-blue-600 text-white"}`}>
                    <Icon name="barcode" size={16} />
                    {scanning ? "スキャン停止" : "バーコードをスキャン"}
                  </button>
                </div>

                {/* 入力フィールド */}
                <div className="space-y-2">
                  {[["商品名", "name", "text", "例：ゆかり"], ["カテゴリ", "category", "text", "例：ふりかけ"]].map(([label, key, type, ph]) => (
                    <div key={key}>
                      <p className="text-[10px] text-slate-400 ml-1 mb-1">{label}</p>
                      <input type={type} placeholder={ph}
                        className="w-full bg-slate-50 px-3 py-2.5 rounded-xl outline-none text-sm"
                        value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                    </div>
                  ))}
                  <div className="flex gap-2">
                    {[["価格(円)", "price"], ["内容量(g)", "amount"]].map(([ph, key]) => (
                      <div key={key} className="flex-1">
                        <p className="text-[10px] text-slate-400 ml-1 mb-1">{ph}</p>
                        <input type="number" placeholder={ph}
                          className="w-full bg-slate-50 px-3 py-2.5 rounded-xl outline-none text-sm"
                          value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 ml-1 mb-1">店舗</p>
                    <select className="w-full bg-slate-50 px-3 py-2.5 rounded-xl outline-none text-sm text-slate-600"
                      value={form.storeId} onChange={e => setForm(f => ({ ...f, storeId: e.target.value }))}>
                      <option value="">店舗を選択</option>
                      {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <button onClick={saveProduct}
                    className="w-full bg-blue-600 text-white py-3.5 rounded-2xl font-bold mt-2 active:bg-blue-700 transition">
                    {isEditing ? "変更を保存" : "記録を保存する"}
                  </button>
                </div>
              </div>
            )}

            {/* 商品一覧 */}
            {products.filter(p => matchQ(p, search)).length === 0 && !showForm && (
              <p className="text-center text-slate-400 text-sm py-8">まだ商品が登録されていません</p>
            )}
            {products.filter(p => matchQ(p, search)).map(p => {
              const { title } = displayLabel(p);
              return (
                <div key={p.id} className="bg-white p-4 rounded-2xl shadow-sm flex gap-3 items-start">
                  <div className="w-14 h-14 bg-slate-50 rounded-xl overflow-hidden flex-shrink-0 border border-slate-100">
                    {p.image
                      ? <img src={p.image} className="w-full h-full object-cover" alt={title} />
                      : <div className="w-full h-full flex items-center justify-center text-slate-200"><Icon name="camera" size={22} /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-700 truncate text-sm">{title}</p>
                        {p.category && p.name && p.category !== p.name && <p className="text-xs text-slate-400">{p.category}</p>}
                      </div>
                      <div className="flex gap-1 flex-shrink-0 ml-2">
                        <button onClick={() => editProduct(p)} className="text-blue-400 p-1.5"><Icon name="edit" size={16} /></button>
                        <button onClick={() => deleteProduct(p.id)} className="text-red-400 p-1.5"><Icon name="trash" size={16} /></button>
                      </div>
                    </div>
                    <div className="flex justify-between items-end mt-1">
                      <span className="text-base font-bold text-slate-600">
                        ¥{p.price}<span className="text-[10px] font-normal text-slate-400 ml-1">({p.amount}g)</span>
                      </span>
                      <span className="text-[10px] bg-slate-50 text-slate-400 px-2 py-1 rounded-lg">{storeName(p.storeId)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── 比較タブ ── */}
        {tab === "comparison" && (
          <div className="space-y-6">
            {filteredCats.length === 0 && (
              <p className="text-center text-slate-400 text-sm py-8">
                {search ? `「${search}」に一致する商品がありません` : "まず商品を登録してください"}
              </p>
            )}
            {filteredCats.map(cat => (
              <div key={cat}>
                <p className="text-[10px] font-bold text-slate-400 ml-2 mb-2 uppercase tracking-widest">{cat}</p>
                <div className="space-y-2">
                  {comparisonGroups[cat].map((p, i) => {
                    const { title } = displayLabel(p);
                    const medals = ["🥇", "🥈", "🥉"];
                    return (
                      <div key={p.id}
                        className={`p-4 rounded-3xl border flex items-center gap-3 ${i === 0 ? "bg-white border-amber-300 shadow-md" : "bg-white border-slate-100 shadow-sm"}`}>
                        {p.image
                          ? <img src={p.image} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" alt={title} />
                          : <div className="w-10 h-10 rounded-xl bg-slate-50 flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            {medals[i] && <span className="text-sm">{medals[i]}</span>}
                            <span className="font-bold text-slate-700 text-sm truncate">{title}</span>
                          </div>
                          <p className="text-[10px] text-slate-400">{storeName(p.storeId)}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-slate-700 text-sm">¥{p.price}</p>
                          <p className="text-rose-500 font-bold text-xs">{p.unitPrice.toFixed(1)}円/g</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ボトムナビ */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white/95 backdrop-blur border-t border-slate-100 flex justify-around h-20 rounded-t-3xl z-40 shadow-xl">
        {[
          { id: "products", label: "商品", icon: "package" },
          { id: "stores", label: "店舗", icon: "store" },
          { id: "comparison", label: "比較", icon: "bar-chart" },
        ].map(({ id, label, icon }) => (
          <button key={id} onClick={() => { setTab(id); setShowForm(false); stopScan(); setBarcodeMsg(""); }}
            className={`flex-1 flex flex-col items-center justify-center gap-1 transition ${tab === id ? "text-blue-600" : "text-slate-300"}`}>
            <Icon name={icon} size={24} />
            <span className="text-[10px] font-bold">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
