import { Link, useMatch, useNavigate, useParams } from "react-router-dom";
import logo from "../../assets/logo.png";
import { adminLogin, adminLogout } from "../../lib/api";
import { useAdminSession, useFlaggedCount } from "../../lib/hooks";
import { Button } from "../button/button";
import GalaxySelect from "../galaxySelect/galaxySelect";
import styles from './header.module.scss';

export default function Header() {
  const session = useAdminSession();
  const isAdmin = !!session;
  const navigate = useNavigate();
  const { galaxy } = useParams();
  const id = parseInt(galaxy || "1", 10);
  const flaggedCount = useFlaggedCount(isAdmin);
  const isFlaggedPage = !!useMatch('/flagged');

  return (
    <header className={styles.header}>
      <Link className={styles.title} to={`/g/${id}`}>
        <img src={logo} className={styles.logo} alt="logo" />
        <h1>FleetVault</h1>
      </Link>
      <div className={styles.galaxy}>
        <GalaxySelect />
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
