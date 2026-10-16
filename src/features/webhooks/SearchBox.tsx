import { useEffect, useRef, useState } from 'react';

const DEBOUNCE_MS = 300;

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
}

/** Local draft for instant typing; the committed value (URL) is updated after a pause. */
export function SearchBox({ value, onChange }: SearchBoxProps) {
  const [draft, setDraft] = useState(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // The committed value changed from outside (back / forward navigation).
  useEffect(() => setDraft(value), [value]);

  useEffect(() => {
    if (draft === value) return;
    const timer = setTimeout(() => onChangeRef.current(draft), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, value]);

  return (
    <input
      type="search"
      className="search"
      placeholder="Пошук за назвою"
      aria-label="Пошук за назвою"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
    />
  );
}
