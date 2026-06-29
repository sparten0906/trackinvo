// ─── CATEGORIES ───────────────────────────────────────────────────────────────
export const initialCategories = [
  { id: 'cat-1', name: 'Electronics',       description: 'Electronic devices and accessories',   productCount: 0, createdAt: '2024-01-10' },
  { id: 'cat-2', name: 'Clothing',          description: 'Apparel and fashion items',             productCount: 0, createdAt: '2024-01-10' },
  { id: 'cat-3', name: 'Food & Beverages',  description: 'Consumable food products',             productCount: 0, createdAt: '2024-01-11' },
  { id: 'cat-4', name: 'Office Supplies',   description: 'Stationery and office equipment',       productCount: 0, createdAt: '2024-01-12' },
  { id: 'cat-5', name: 'Health & Beauty',   description: 'Personal care and wellness products',  productCount: 0, createdAt: '2024-01-15' },
];

// ─── SUPPLIERS ────────────────────────────────────────────────────────────────
export const initialSuppliers = [
  { id: 'sup-1', name: 'TechWorld Distributors', email: 'contact@techworld.com',   phone: '+91-9876543210', address: '123 Electronics Hub, Whitefield',   city: 'Bengaluru', state: 'Karnataka',    country: 'India', taxId: '29AABCT1234M1Z5', notes: 'Primary electronics supplier', status: 'active',   createdAt: '2024-01-05' },
  { id: 'sup-2', name: 'Fashion Hub Co.',         email: 'orders@fashionhub.com',   phone: '+91-9876543211', address: '456 Textile Market, Dharavi',        city: 'Mumbai',    state: 'Maharashtra',  country: 'India', taxId: '27AABCF2345N1Z3', notes: 'Main clothing supplier',       status: 'active',   createdAt: '2024-01-06' },
  { id: 'sup-3', name: 'Global Foods Inc.',       email: 'supply@globalfoods.com',  phone: '+91-9876543212', address: '789 APMC Market, Vashi',            city: 'Surat',     state: 'Gujarat',      country: 'India', taxId: '24AABCG3456P1Z1', notes: 'Food and beverage supplier',  status: 'active',   createdAt: '2024-01-07' },
  { id: 'sup-4', name: 'OfficeMax Wholesale',     email: 'wholesale@officemax.com', phone: '+91-9876543213', address: '321 Industrial Estate, Baner',      city: 'Pune',      state: 'Maharashtra',  country: 'India', taxId: '27AABCO4567Q1Z9', notes: 'Office supplies distributor', status: 'inactive', createdAt: '2024-01-08' },
];

// ─── CUSTOMERS ────────────────────────────────────────────────────────────────
export const initialCustomers = [
  { id: 'cust-1', name: 'John Anderson',  email: 'john@example.com',       phone: '+1-555-1001', address: '10 Maple Street',   city: 'Boston',   country: 'USA', taxId: '',             notes: 'Regular customer',               status: 'active',   createdAt: '2024-01-15' },
  { id: 'cust-2', name: 'Sarah Mitchell', email: 'sarah@example.com',      phone: '+1-555-1002', address: '22 Oak Avenue',     city: 'Seattle',  country: 'USA', taxId: '',             notes: '',                               status: 'active',   createdAt: '2024-01-18' },
  { id: 'cust-3', name: 'Acme Corp Ltd.', email: 'billing@acmecorp.com',   phone: '+1-555-1003', address: '500 Business Park', city: 'Dallas',   country: 'USA', taxId: 'ACME-TX-001', notes: 'B2B client — bulk orders',       status: 'active',   createdAt: '2024-01-20' },
  { id: 'cust-4', name: 'Emily Chen',     email: 'emily.chen@example.com', phone: '+1-555-1004', address: '7 Elm Road',        city: 'Portland', country: 'USA', taxId: '',             notes: '',                               status: 'active',   createdAt: '2024-02-01' },
  { id: 'cust-5', name: 'Marcus Johnson', email: 'marcus@example.com',     phone: '+1-555-1005', address: '88 Pine Lane',      city: 'Denver',   country: 'USA', taxId: '',             notes: 'Prefers email communication',    status: 'inactive', createdAt: '2024-02-10' },
];

// ─── PRODUCTS ─────────────────────────────────────────────────────────────────
export const initialProducts = [
  { id: 'prod-1',  name: 'Wireless Bluetooth Headphones',    sku: 'WBH-001', barcode: '1234567890123', categoryId: 'cat-1', brand: 'SoundMax',    unit: 'pcs',    purchasePrice: 45.00,  sellingPrice: 89.99,  taxPercent: 8,  stock: 42,  minStock: 10, supplierId: 'sup-1', status: 'active',   description: 'Over-ear wireless headphones with ANC',  createdAt: '2024-01-20' },
  { id: 'prod-2',  name: 'USB-C Charging Cable 2m',          sku: 'UCC-002', barcode: '1234567890124', categoryId: 'cat-1', brand: 'CablePro',    unit: 'pcs',    purchasePrice: 4.50,   sellingPrice: 12.99,  taxPercent: 8,  stock: 8,   minStock: 20, supplierId: 'sup-1', status: 'active',   description: '2-meter braided USB-C cable',            createdAt: '2024-01-21' },
  { id: 'prod-3',  name: "Men's Casual T-Shirt (L)",         sku: 'MCT-003', barcode: '1234567890125', categoryId: 'cat-2', brand: 'ComfortWear', unit: 'pcs',    purchasePrice: 8.00,   sellingPrice: 24.99,  taxPercent: 5,  stock: 120, minStock: 30, supplierId: 'sup-2', status: 'active',   description: '100% cotton casual tee',                 createdAt: '2024-01-22' },
  { id: 'prod-4',  name: 'Premium Coffee Beans 1kg',         sku: 'PCB-004', barcode: '1234567890126', categoryId: 'cat-3', brand: 'RoastMaster', unit: 'kg',     purchasePrice: 12.00,  sellingPrice: 28.50,  taxPercent: 0,  stock: 5,   minStock: 15, supplierId: 'sup-3', status: 'active',   description: 'Arabica premium roast',                  createdAt: '2024-01-23' },
  { id: 'prod-5',  name: 'A4 Copy Paper (500 sheets)',       sku: 'ACP-005', barcode: '1234567890127', categoryId: 'cat-4', brand: 'PaperPlus',   unit: 'ream',   purchasePrice: 3.50,   sellingPrice: 8.99,   taxPercent: 5,  stock: 200, minStock: 50, supplierId: 'sup-4', status: 'active',   description: '80gsm A4 copy paper',                    createdAt: '2024-01-24' },
  { id: 'prod-6',  name: 'Moisturizing Face Cream',          sku: 'MFC-006', barcode: '1234567890128', categoryId: 'cat-5', brand: 'GlowSkin',    unit: 'pcs',    purchasePrice: 9.00,   sellingPrice: 22.99,  taxPercent: 5,  stock: 3,   minStock: 10, supplierId: 'sup-3', status: 'active',   description: '50ml hydrating face cream',               createdAt: '2024-01-25' },
  { id: 'prod-7',  name: 'Mechanical Keyboard TKL',          sku: 'MKT-007', barcode: '1234567890129', categoryId: 'cat-1', brand: 'KeyMaster',   unit: 'pcs',    purchasePrice: 55.00,  sellingPrice: 129.99, taxPercent: 8,  stock: 18,  minStock: 5,  supplierId: 'sup-1', status: 'active',   description: 'TKL mechanical keyboard with RGB',       createdAt: '2024-01-26' },
  { id: 'prod-8',  name: "Women's Running Shoes (Size 8)",   sku: 'WRS-008', barcode: '1234567890130', categoryId: 'cat-2', brand: 'SpeedFoot',   unit: 'pair',   purchasePrice: 35.00,  sellingPrice: 79.99,  taxPercent: 5,  stock: 25,  minStock: 8,  supplierId: 'sup-2', status: 'active',   description: 'Lightweight running shoes',               createdAt: '2024-01-27' },
  { id: 'prod-9',  name: 'Energy Drink 250ml (24-pack)',     sku: 'EDB-009', barcode: '1234567890131', categoryId: 'cat-3', brand: 'PowerBoost',  unit: 'pack',   purchasePrice: 18.00,  sellingPrice: 36.00,  taxPercent: 12, stock: 40,  minStock: 10, supplierId: 'sup-3', status: 'active',   description: '24-can energy drink pack',               createdAt: '2024-01-28' },
  { id: 'prod-10', name: 'Ballpoint Pens (Box of 50)',       sku: 'BPB-010', barcode: '1234567890132', categoryId: 'cat-4', brand: 'WriteRight',  unit: 'box',    purchasePrice: 5.00,   sellingPrice: 11.99,  taxPercent: 5,  stock: 75,  minStock: 20, supplierId: 'sup-4', status: 'active',   description: 'Blue ink ballpoint pens',                createdAt: '2024-01-29' },
  { id: 'prod-11', name: 'Vitamin C Supplements (60 tabs)', sku: 'VCS-011', barcode: '1234567890133', categoryId: 'cat-5', brand: 'HealthPlus',  unit: 'bottle', purchasePrice: 6.50,   sellingPrice: 16.99,  taxPercent: 0,  stock: 55,  minStock: 15, supplierId: 'sup-3', status: 'active',   description: '500mg Vitamin C tablets',                createdAt: '2024-01-30' },
  { id: 'prod-12', name: '27" 4K Monitor',                  sku: 'MON-012', barcode: '1234567890134', categoryId: 'cat-1', brand: 'ViewPro',     unit: 'pcs',    purchasePrice: 220.00, sellingPrice: 399.99, taxPercent: 8,  stock: 7,   minStock: 3,  supplierId: 'sup-1', status: 'active',   description: '27-inch 4K IPS display',                 createdAt: '2024-02-01' },
];

// ─── INVOICES ─────────────────────────────────────────────────────────────────
// paidAmount / balanceAmount / returnStatus added to all invoices
export const initialInvoices = [
  {
    id: 'inv-1', invoiceNumber: 'INV-2024-0001', customerId: 'cust-1', customerName: 'John Anderson',
    date: '2024-02-10', dueDate: '2024-02-25',
    items: [
      { productId: 'prod-1', productName: 'Wireless Bluetooth Headphones', sku: 'WBH-001', quantity: 2, unitPrice: 89.99, taxPercent: 8, discount: 0 },
      { productId: 'prod-7', productName: 'Mechanical Keyboard TKL',       sku: 'MKT-007', quantity: 1, unitPrice: 129.99, taxPercent: 8, discount: 0 },
    ],
    subtotal: 309.97, discountAmount: 0, taxAmount: 24.80, grandTotal: 334.77,
    discountType: 'fixed', discountValue: 0,
    paidAmount: 334.77, balanceAmount: 0,
    paymentMethod: 'card', paymentStatus: 'paid',
    returnStatus: 'none', notes: '', createdAt: '2024-02-10',
  },
  {
    id: 'inv-2', invoiceNumber: 'INV-2024-0002', customerId: 'cust-3', customerName: 'Acme Corp Ltd.',
    date: '2024-02-12', dueDate: '2024-02-27',
    items: [
      { productId: 'prod-5',  productName: 'A4 Copy Paper (500 sheets)', sku: 'ACP-005', quantity: 20, unitPrice: 8.99,  taxPercent: 5, discount: 0 },
      { productId: 'prod-10', productName: 'Ballpoint Pens (Box of 50)', sku: 'BPB-010', quantity: 5,  unitPrice: 11.99, taxPercent: 5, discount: 0 },
    ],
    subtotal: 239.75, discountAmount: 0, taxAmount: 11.99, grandTotal: 251.74,
    discountType: 'fixed', discountValue: 0,
    paidAmount: 251.74, balanceAmount: 0,
    paymentMethod: 'bank_transfer', paymentStatus: 'paid',
    returnStatus: 'none', notes: 'Bulk order discount applied', createdAt: '2024-02-12',
  },
  {
    id: 'inv-3', invoiceNumber: 'INV-2024-0003', customerId: 'cust-2', customerName: 'Sarah Mitchell',
    date: '2024-02-15', dueDate: '2024-03-01',
    items: [
      { productId: 'prod-3', productName: "Men's Casual T-Shirt (L)",          sku: 'MCT-003', quantity: 3, unitPrice: 24.99, taxPercent: 5, discount: 0 },
      { productId: 'prod-8', productName: "Women's Running Shoes (Size 8)", sku: 'WRS-008', quantity: 1, unitPrice: 79.99, taxPercent: 5, discount: 0 },
    ],
    subtotal: 154.96, discountAmount: 0, taxAmount: 7.75, grandTotal: 162.71,
    discountType: 'fixed', discountValue: 0,
    paidAmount: 80.00, balanceAmount: 82.71,
    paymentMethod: 'cash', paymentStatus: 'partial',
    returnStatus: 'none', notes: 'Paid $80 upfront', createdAt: '2024-02-15',
  },
  {
    id: 'inv-4', invoiceNumber: 'INV-2024-0004', customerId: 'cust-4', customerName: 'Emily Chen',
    date: '2024-02-18', dueDate: '2024-03-04',
    items: [
      { productId: 'prod-6',  productName: 'Moisturizing Face Cream',          sku: 'MFC-006', quantity: 2, unitPrice: 22.99, taxPercent: 5, discount: 0 },
      { productId: 'prod-11', productName: 'Vitamin C Supplements (60 tabs)', sku: 'VCS-011', quantity: 1, unitPrice: 16.99, taxPercent: 0, discount: 0 },
    ],
    subtotal: 62.97, discountAmount: 0, taxAmount: 2.30, grandTotal: 65.27,
    discountType: 'fixed', discountValue: 0,
    paidAmount: 0, balanceAmount: 65.27,
    paymentMethod: 'cash', paymentStatus: 'unpaid',
    returnStatus: 'none', notes: '', createdAt: '2024-02-18',
  },
];

// ─── PURCHASES ────────────────────────────────────────────────────────────────
export const initialPurchases = [
  
];

// ─── SALES RETURNS ────────────────────────────────────────────────────────────
export const initialSalesReturns = [];

// ─── PURCHASE RETURNS ─────────────────────────────────────────────────────────
export const initialPurchaseReturns = [];

// ─── STOCK TRANSACTIONS ───────────────────────────────────────────────────────
// Pre-populated with opening stock entries for existing purchases
export const initialStockTransactions = [
  // Purchase 1 (PUR-2024-0001) stock-ins
  { id: 'stx-1', productId: 'prod-1', productName: 'Wireless Bluetooth Headphones', sku: 'WBH-001', transactionType: 'PURCHASE', referenceType: 'purchase', referenceId: 'pur-1', referenceNumber: 'PUR-2024-0001', quantityIn: 50, quantityOut: 0, previousStock: 0,  newStock: 50, note: 'Stock received via PUR-2024-0001', createdAt: '2024-01-20' },
  { id: 'stx-2', productId: 'prod-7', productName: 'Mechanical Keyboard TKL',       sku: 'MKT-007', transactionType: 'PURCHASE', referenceType: 'purchase', referenceId: 'pur-1', referenceNumber: 'PUR-2024-0001', quantityIn: 20, quantityOut: 0, previousStock: 0,  newStock: 20, note: 'Stock received via PUR-2024-0001', createdAt: '2024-01-20' },
  // Purchase 2 (PUR-2024-0002) stock-ins
  { id: 'stx-3', productId: 'prod-4', productName: 'Premium Coffee Beans 1kg',       sku: 'PCB-004', transactionType: 'PURCHASE', referenceType: 'purchase', referenceId: 'pur-2', referenceNumber: 'PUR-2024-0002', quantityIn: 30, quantityOut: 0, previousStock: 0,  newStock: 30, note: 'Stock received via PUR-2024-0002', createdAt: '2024-01-22' },
  { id: 'stx-4', productId: 'prod-9', productName: 'Energy Drink 250ml (24-pack)',   sku: 'EDB-009', transactionType: 'PURCHASE', referenceType: 'purchase', referenceId: 'pur-2', referenceNumber: 'PUR-2024-0002', quantityIn: 50, quantityOut: 0, previousStock: 0,  newStock: 50, note: 'Stock received via PUR-2024-0002', createdAt: '2024-01-22' },
  // Invoice 1 (INV-2024-0001) stock-outs
  { id: 'stx-5', productId: 'prod-1', productName: 'Wireless Bluetooth Headphones',  sku: 'WBH-001', transactionType: 'SALE', referenceType: 'invoice', referenceId: 'inv-1', referenceNumber: 'INV-2024-0001', quantityIn: 0, quantityOut: 2, previousStock: 50, newStock: 48, note: 'Sold via INV-2024-0001', createdAt: '2024-02-10' },
  { id: 'stx-6', productId: 'prod-7', productName: 'Mechanical Keyboard TKL',        sku: 'MKT-007', transactionType: 'SALE', referenceType: 'invoice', referenceId: 'inv-1', referenceNumber: 'INV-2024-0001', quantityIn: 0, quantityOut: 1, previousStock: 20, newStock: 19, note: 'Sold via INV-2024-0001', createdAt: '2024-02-10' },
];

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
export const initialSettings = {
  // Business
  businessName:    'TrackInvo Solutions',
  businessEmail:   'info@trackinvo.com',
  businessPhone:   '+91-98000-00000',
  businessAddress: '100, Commerce Street, Andheri East',
  businessCity:    'Mumbai',
  businessState:   'Maharashtra',
  businessPinCode: '400 069',
  businessCountry: 'India',

  // GST / Tax identity
  taxNumber:    '',          // GSTIN (legacy field kept for compatibility)
  gstin:        '',          // 15-char GSTIN e.g. 27AAACR1234M1Z5
  pan:          '',          // PAN e.g. AAACR1234M
  msme:         '',          // MSME/Udyam registration (optional)
  gstType:      'regular',   // regular | composition | exempt

  // GST settings
  placeOfSupply:    'Maharashtra',   // default state for invoices
  stateCode:        '27',            // 2-digit GST state code
  transactionType:  'intrastate',    // intrastate | interstate

  // Timezone
  businessTimezone: 'Asia/Kolkata',

  // Currency
  currency:        'INR',
  currencySymbol:  '₹',

  // Tax / stock
  taxRate:           18,
  lowStockThreshold: 10,

  // Invoice numbering
  invoicePrefix:   'INV',
  purchasePrefix:  'PUR',
  returnPrefix:    'RET',
  purReturnPrefix: 'PRR',

  // Invoice content
  invoiceFooter: 'Thank you for your business!',
  invoiceTerms:  'Goods once sold will not be taken back or exchanged. E. & O.E.',

  // Logo
  logoUrl: '',

  // Banking (shown on invoice)
  bankName:        '',
  bankAccount:     '',
  bankIfsc:        '',
  bankBranch:      '',
  bankAccountType: 'current',
  upiId:           '',

  userProfile: {
    name:   'Admin User',
    email:  'admin@trackinvo.com',
    role:   'Administrator',
    avatar: '',
  },

  // PO / Purchase document defaults
  poTerms:             'All prices are in Indian Rupees and exclusive of applicable taxes.\nGoods must be delivered within the expected delivery date.\nSupplier must provide a tax invoice/bill for all deliveries.\nDamaged, defective, or rejected goods will be returned at the supplier\'s cost.\nPayment will be processed within the agreed credit period after receipt and acceptance of goods.',
  poPaymentTerms:      'Net 30 days',
  poDeliveryTerms:     'Delivery at buyer\'s warehouse',
  poFooterNote:        'This is a computer-generated purchase order.',
  authorizedSignatory: '',
  showTermsOnSlip:     true,

  // Pricing strategy
  pricingStrategy:      'manual',
  includeFreightInCost: false,
  defaultMarginPercent: 30,
};

export const initialPurchaseOrders  = [];
export const initialPurchaseReceipts = [];
