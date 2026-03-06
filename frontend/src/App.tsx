import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { RequireAuth } from './components/auth/RequireAuth'
import { LoginPage } from './pages/LoginPage'
import { MigrationPage } from './pages/MigrationPage'
import { DashboardPage } from './pages/DashboardPage'
import { ClientsPage } from './pages/ClientsPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { TimeEntriesPage } from './pages/TimeEntriesPage'
import { InvoicesPage } from './pages/InvoicesPage'
import { InvoiceDetailPage } from './pages/InvoiceDetailPage'
import { ProfilePage } from './pages/ProfilePage'
import { ReportsPage } from './pages/ReportsPage'
import NotFoundPage from './pages/NotFoundPage'
import FoodCalorieAnalyzer from './pages/FoodCalorieAnalyzer'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/time-entries" element={<TimeEntriesPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/migrate" element={<MigrationPage />} />
        </Route>
      </Route>
      <Route path="/food-analyzer" element={<FoodCalorieAnalyzer />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
