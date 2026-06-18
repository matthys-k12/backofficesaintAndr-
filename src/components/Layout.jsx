import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'

export default function Layout() {
  return (
    <div className="flex min-h-screen" style={{ backgroundColor: '#F8F5F0' }}>
      <Sidebar />
      <div className="flex-1" style={{ marginLeft: '240px' }}>
        <Header />
        <main className="min-h-screen" style={{ paddingTop: '64px' }}>
          <div className="p-6 max-w-screen-2xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
