import { useAdminSession } from "../../lib/hooks";
import styles from './footer.module.scss';

export default function Footer() {
  const session = useAdminSession();
  const isAdmin = !!session;

  console.log(session?.user.user_metadata)
  
  return (
    <div className={styles.footer}>
      {process.env.REACT_APP_VERSION}
    </div>
  );
}
