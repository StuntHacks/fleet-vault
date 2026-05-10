import { Link, useMatch, useParams } from 'react-router-dom';
import { clsx } from "clsx"
import styles from './galaxySelect.module.scss';
import data from '../../data.json';
import { useState, useRef, useEffect } from 'react';
import { useAdminSession } from '../../lib/hooks';

export interface SelectItem {
  label: string;
  value: number;
}

export default function GalaxySelect({ className, isSelect, selected, callback, items, placeholder = 'Select Galaxy' }: { className?: string; isSelect?: boolean; selected?: number; callback?: (id: number) => void; items?: SelectItem[]; placeholder?: string }) {
  const [shown, setShown] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const isAdmin = !!useAdminSession();

  const isAdvisorPage = !!useMatch('/advisors');
  const { galaxy } = useParams();
  let id = parseInt(galaxy || "1", 10);
  id = Math.min(Math.max(id, 1), data.galaxies.length);
  if (isNaN(id)) {
    id = 1;
  }

  const handleCallback = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    const galaxyId = parseInt(e.currentTarget.getAttribute('data-id') || "1", 10);
    if (callback) {
      callback(galaxyId);
      e.preventDefault();
    }
    setShown(false);
  }

  return (
    <div
      ref={ref}
      className={clsx(styles.galaxySelect, className, { [styles.shown]: shown })}
      onClick={() => setShown(!shown)}
    >
      {isSelect && (
        <span className={styles.current}>
          {items
            ? (selected ? items.find(i => i.value === selected)?.label ?? placeholder : placeholder)
            : (selected ? `Galaxy ${selected}` : placeholder)}
        </span>
      )}
      {!isSelect && <span className={styles.current}>{isAdvisorPage ? 'Advisor Explorer' : `Galaxy ${id}`}</span>}
      <div className={styles.dropdown}>
        {items
          ? items.filter(item => item.value !== selected).map((item) => (
              <Link data-id={item.value} key={item.value} to="#" className={styles.dropdownItem} onClick={(e) => handleCallback(e)}>
                {item.label}
              </Link>
            ))
          : data.galaxies.map((g, index) => (isSelect && index + 1 === selected) || (!isSelect && !isAdvisorPage && index + 1 === id) ? undefined : (
              <Link data-id={index + 1} key={index} to={`/g/${index + 1}`} className={styles.dropdownItem} onClick={(e) => handleCallback(e)}>
                Galaxy {index + 1}
              </Link>
            ))
        }
        {isAdmin && !isAdvisorPage && !isSelect && (
          <Link to="/advisors" className={styles.dropdownItem}>
            Advisor Explorer
          </Link>
        )}
      </div>
    </div>
  );
}
