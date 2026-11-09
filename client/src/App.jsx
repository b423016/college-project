import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from './store';
import Layout from './components/Layout';
import Login from './pages/Login';
import Home from './pages/Home';
import Menu from './pages/Menu';
import Attendance from './pages/Attendance';
import Notices from './pages/Notices';
import Community from './pages/Community';
import Coupons from './pages/Coupons';
import SpeakUp from './pages/SpeakUp';
import Leaderboard from './pages/Leaderboard';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import { Chai } from './crayon/Doodles';

// Pages slide in like a sheet of paper being put down on the table.
const Page = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 30, rotate: 1.2 }}
    animate={{ opacity: 1, y: 0, rotate: 0 }}
    exit={{ opacity: 0, y: -16, rotate: -1 }}
    transition={{ type: 'spring', stiffness: 220, damping: 26 }}
  >
    {children}
  </motion.div>
);

export default function App() {
  const { user, booting } = useApp();
  const loc = useLocation();

  if (booting) return <div className="boot"><Chai size={120} boil /><p>brewing chai…</p></div>;
  if (!user) return <Login />;

  const routes = [
    ['/', Home], ['/menu', Menu], ['/attendance', Attendance], ['/notices', Notices], ['/community', Community],
    ['/coupons', Coupons], ['/speak-up', SpeakUp], ['/leaderboard', Leaderboard], ['/profile', Profile],
  ];
  if (user.role === 'admin') routes.push(['/admin', Admin]);

  return (
    <Layout>
      <AnimatePresence mode="wait">
        <Routes location={loc} key={loc.pathname}>
          {routes.map(([path, C]) => <Route key={path} path={path} element={<Page><C /></Page>} />)}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </Layout>
  );
}
