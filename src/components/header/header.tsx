import { Link, useMatch, useNavigate, useParams } from "react-router-dom";
import { clsx } from "clsx";
import logo from "../../assets/logo.png";
import data from '../../data.json';
import { adminLogin, adminLogout } from "../../lib/api";
import { useAdminSession, useFlaggedCount, useGalaxyAccess } from "../../lib/hooks";
import { Button } from "../button/button";
import GalaxySelect from "../galaxySelect/galaxySelect";
import styles from './header.module.scss';

export default function Header({ galaxy: current }: { galaxy?: number }) {
  const session = useAdminSession();
  const isAdmin = !!session;
  const navigate = useNavigate();
  const { galaxy } = useParams();
  const id = current ?? parseInt(galaxy || "1", 10);
  const flaggedCount = useFlaggedCount(isAdmin);
  const isFlaggedPage = !!useMatch('/flagged');
  const isAdvisorPage = !!useMatch('/advisors');
  const isAuditPage = !!useMatch('/audit');
  const access = useGalaxyAccess();

  const galaxyIds = data.galaxies.map((_, i) => i + 1).filter(g => access.canView(g));
  const prev = galaxyIds.filter(g => g < id).pop();
  const next = galaxyIds.find(g => g > id);
  const showArrows = !isFlaggedPage && !isAdvisorPage && !isAuditPage;

  const arrow = (target: number | undefined, dir: 'prev' | 'next') => target ? (
    <Link className={clsx(styles.arrow, styles[dir])} to={`/g/${target}`} />
  ) : (
    <span className={clsx(styles.arrow, styles[dir], styles.disabled)} />
  );

  return (
    <header className={styles.header}>
      <Link className={styles.title} to={`/g/${id}`}>
        <img src={logo} className={styles.logo} alt="logo" />
        <h1>FleetVault</h1>
      </Link>
      <div className={styles.galaxy}>
        {showArrows && arrow(prev, 'prev')}
        <GalaxySelect className={styles.select} selected={current} />
        {showArrows && arrow(next, 'next')}
      </div>
      <div className={styles.login}>
        {flaggedCount > 0 && !isFlaggedPage && (
          <Button variant="flag" onClick={() => navigate('/flagged')}>
            {flaggedCount} flagged<span>{flaggedCount === 1 ? 'solution' : 'solutions'} pending</span>
          </Button>
        )}
        {isAdmin ?
          <Button variant="secondary" onClick={() => adminLogout()}>Logout</Button> :
          <Button variant="secondary" onClick={() => {adminLogin(window.prompt() || "").catch(() => alert("Invalid token"))}}>Login</Button>
        }
        <Button onClick={() => navigate(`/g/${id}/submit`)}>
          Submit
          <span>(Ctrl + V)</span>
        </Button>
      </div>
    </header>
  );
}
