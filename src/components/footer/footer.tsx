import { useEffect, useState } from "react";
import { useAdminSession, useUsername } from "../../lib/hooks";
import styles from './footer.module.scss';

export default function Footer() {
  const session = useAdminSession();
  const username = useUsername();
  const [ darkMode, setDarkMode ] = useState(() => {
    const stored = localStorage.getItem('fleetvault_darkmode')
    if (stored !== null) return stored === 'true'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
   
  useEffect(() => {
    const body = document.body
    localStorage.setItem('fleetvault_darkmode', String(darkMode))
    if (darkMode) {
      body.classList.add('dark')
      body.classList.remove('light')
    } else {
      body.classList.add('light')
      body.classList.remove('dark')
    }
  }, [darkMode])
  
  return (
    <div className={styles.footer}>
      <label className={styles.darkMode}>
        <input type="checkbox" checked={darkMode} onChange={() => setDarkMode((d) => !d)} />
        Dark Mode
      </label>
      {username && !!session ? `| Logged in as ${username}` : ''}
      <span className={styles.version}>
        v{process.env.REACT_APP_VERSION} - report bugs in #wiki-stuff on the discord
      </span>
    </div>
  );
}
