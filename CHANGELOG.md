# Changelog

## [Unreleased]

### Fixed
- Dashboard access for regular users
  - Changed Dashboard route in `App.tsx` from using `AdminRoute` to `ProtectedRoute`
  - Regular users (status: ATIVO) can now access the Dashboard
  - Admin-only routes (/admin/*) remain protected by `AdminRoute`
  - Navigation menu items remain consistent with access permissions

### Changed Files
1. `src/App.tsx`
   ```diff
   - <Route path="dashboard" element={
   -   <AdminRoute>
   -     <Dashboard />
   -   </AdminRoute>
   - } />
   + <Route path="dashboard" element={
   +   <ProtectedRoute>
   +     <Dashboard />
   +   </ProtectedRoute>
   + } />
   ```

### Access Control
- ADMIN users: Full access to all routes including administrative areas
- ATIVO users: Access to Dashboard and all non-administrative features
- INATIVO users: Redirected to pending approval page

### Components
- `ProtectedRoute`: Handles general route protection for authenticated users
- `AdminRoute`: Specifically protects administrative routes
- `Layout/Sidebar`: Shows navigation options based on user status
