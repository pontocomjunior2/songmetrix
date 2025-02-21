# Changelog

## [Unreleased]

### Fixed
- Dashboard access for regular users
  - Changed Dashboard route in `App.tsx` from using `AdminRoute` to `ProtectedRoute`
  - Regular users (status: ATIVO) can now access the Dashboard
  - Admin-only routes (/admin/*) remain protected by `AdminRoute`
  - Navigation menu items remain consistent with access permissions

- Default landing page after login
  - Changed navigation in `AuthContext.tsx` to always redirect to /dashboard
  - Removed conditional navigation that was sending regular users to /ranking
  - All active users (both ADMIN and ATIVO) now land on Dashboard after login

- User deletion functionality
  - Fixed removeUser function in AuthContext to properly delete users
  - Implemented proper sequence: delete from users table first, then from auth
  - Added better error handling and messages

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

2. `src/contexts/AuthContext.tsx`
   - Updated signIn function to always navigate to '/dashboard'
   - Removed conditional navigation based on user status
   - Fixed removeUser function to properly handle user deletion
   - Improved error handling for user management functions

### Access Control
- ADMIN users: Full access to all routes including administrative areas
- ATIVO users: Access to Dashboard and all non-administrative features
- INATIVO users: Redirected to pending approval page

### Components
- `ProtectedRoute`: Handles general route protection for authenticated users
- `AdminRoute`: Specifically protects administrative routes
- `Layout/Sidebar`: Shows navigation options based on user status

### Restore Points
1. Dashboard Access Fix: `ddc707da93b9d577d16448360f2e0b4d89c5eac8`
2. Default Landing Page Fix: `270dfe6`
3. CHANGELOG Update: `2b79717`
