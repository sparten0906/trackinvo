import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Categories from './pages/Categories';
import Suppliers from './pages/Suppliers';
import Customers from './pages/Customers';
import Billing from './pages/Billing';
import Invoices from './pages/Invoices';
import Purchases from './pages/Purchases';
import PurchaseOrders from './pages/PurchaseOrders';
import Reports from './pages/Reports';
import SalesReturns from './pages/SalesReturns';
import PurchaseReturns from './pages/PurchaseReturns';
import StockTransactions from './pages/StockTransactions';
import StockMovement from './pages/StockMovement';
import DamagedStock from './pages/DamagedStock';
import SettingsPage from './pages/Settings';
import SupplierPayments from './pages/SupplierPayments';

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />

      {/* Protected — all app routes wrapped in a single gate */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"  element={<Dashboard />} />
        <Route path="products"   element={<Products />} />
        <Route path="categories" element={<Categories />} />
        <Route path="suppliers"  element={<Suppliers />} />
        <Route path="customers"  element={<Customers />} />
        <Route path="billing"    element={<Billing />} />
        <Route path="invoices"   element={<Invoices />} />
        <Route path="purchases"         element={<Purchases />} />
        <Route path="purchase-orders"      element={<PurchaseOrders />} />
        <Route path="supplier-payments"   element={<SupplierPayments />} />
        <Route path="sales-returns"     element={<SalesReturns />} />
        <Route path="purchase-returns"  element={<PurchaseReturns />} />
        <Route path="stock-transactions" element={<StockTransactions />} />
        <Route path="stock-movement"     element={<StockMovement />} />
        <Route path="damaged-stock"      element={<DamagedStock />} />
        <Route path="reports"           element={<Reports />} />
        <Route path="settings"   element={<SettingsPage />} />
        <Route path="*"          element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
