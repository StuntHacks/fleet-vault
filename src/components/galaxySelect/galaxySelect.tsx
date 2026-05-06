import { Link, useMatch, useParams } from 'react-router-dom';
import { clsx } from "clsx"
import styles from './galaxySelect.module.scss';
import data from '../../data.json';
import { useState } from 'react';

export default function GalaxySelect() {
  const [shown, setShown] = useState(false);

  const isAdvisorPage = !!useMatch('/advisors');
  const { galaxy } = useParams();
  let id = parseInt(galaxy || "1", 10);
  id = Math.min(Math.max(id, 1), data.galaxies.length);
  if (isNaN(id)) {
    id = 1;
  }

  return (
    <div
      className={clsx(styles.galaxySelect, { [styles.shown]: shown })}
      onClick={() => setShown(!shown)}
    >
      {isAdvisorPage ? 'Advisor Explorer' : `Galaxy ${id}`}
      <div className={styles.dropdown}>
        {data.galaxies.map((g, index) => !isAdvisorPage && index + 1 === id ? undefined : (
          <Link key={index} to={`/g/${index + 1}`} className={clsx(styles.dropdownItem, { [styles.selected]: !isAdvisorPage && index + 1 === id })}>
            Galaxy {index + 1}
          </Link>
        ))}
      </div>
    </div>
  );
}
