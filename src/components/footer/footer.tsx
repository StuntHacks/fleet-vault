import { useAdminSession, useUsername } from "../../lib/hooks";
import styles from './footer.module.scss';

export default function Footer() {
  const session = useAdminSession();
  const username = useUsername();
  
  return (
    <div className={styles.footer}>
      {username && !!session ? `Logged in as ${username} ` : ''}
      <span className={styles.version}>
        v{process.env.REACT_APP_VERSION} - report bugs in #wiki-stuff on the discord
      </span>
    </div>
  );
}
