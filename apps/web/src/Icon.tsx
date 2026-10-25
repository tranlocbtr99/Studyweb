const paths:Record<string,string>={
 bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',
 home:'m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
 book:'M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H3V4zm16 0h-4a3 3 0 0 0-3 3m0 14a4 4 0 0 1 4-2h4V4z',
 file:'M6 3h8l4 4v14H6z M14 3v5h4 M9 12h6 M9 16h6',
 clock:'M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
 grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
 users:'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3 M13 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M22 21v-3a4 4 0 0 0-3-4 M17 2a4 4 0 0 1 0 8',
 layers:'m12 3 10 5-10 5L2 8z M2 12l10 5 10-5 M2 16l10 5 10-5',
 cap:'m2 8 10-5 10 5-10 5z M6 10v7c4 3 8 3 12 0v-7 M22 8v8',
 search:'M20 20l-5-5 M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
 arrow:'M4 12h16 m-6-6 6 6-6 6',
 refresh:'M20 7a9 9 0 1 0 1 8 M20 3v5h-5',
 scales:'M12 3v18 M6 21h12 M3 7h18 M6 7l-4 8h8z M18 7l-4 8h8z',
 building:'m3 8 9-5 9 5z M3 21h18 M5 10v8 M10 10v8 M15 10v8 M20 10v8',
 chart:'M4 3v18h17 M8 16v-4 M13 16V8 M18 16V5'
};
export default function Icon({name}:{name:string}){return <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]??paths.file}/></svg>}
